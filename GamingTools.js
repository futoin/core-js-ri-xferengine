'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const XferTools = require( './XferTools' );
const AmountTools = require( './AmountTools' );
const UUIDTool = require( './UUIDTool' );

const {
    DB_ACCOUNTS_TABLE,
    DB_ACCOUNTS_VIEW,
    DB_CURRENCY_TABLE,
    DB_RESERVATIONS_TABLE,
    DB_ROUNDS_TABLE,
    DB_ROUND_XFERS_TABLE,
    DB_XFERS_TABLE,
} = require( './main' );


/**
 * XferTools with focus on Gaming use case
 */
class GamingTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Gaming' );
    }

    findAccounts( as, user_ext_id, currency, _info ) {
        const db = this._ccm.db( 'xfer' );

        const q = db.select( DB_ACCOUNTS_VIEW )
            .where( {
                ext_holder_id: user_ext_id,
                currency: currency,
                account_enabled: 'Y',
            } )
            .order( 'account_created' );

        q.executeAssoc( as );

        as.add( ( as, accounts ) => {
            const bonus = [];
            let main;

            for ( let a of accounts ) {
                if ( a.acct_type === this.ACCT_BONUS ) {
                    bonus.push( a );
                } else if ( !main ) {
                    main = a;
                } else {
                    as.error( 'InternalError', 'More than one currency account' );
                }
            }

            if ( main ) {
                as.success( main, bonus );
            } else {
                as.error( 'CurrencyMismatch' );
            }
        } );
    }

    getGameBalance( as, user_ext_id, currency, info ) {
        const db = this._ccm.db( 'xfer' );

        db.select( DB_ACCOUNTS_VIEW )
            .where( {
                ext_holder_id: user_ext_id,
                currency: currency,
                account_enabled: 'Y',
                holder_enabled: 'Y',
            } )
            .executeAssoc( as );

        as.add( ( as, accounts ) => {
            let game_balance = '0';
            let main;
            let do_transit = false;

            for ( let a of accounts ) {
                if ( a.acct_type === this.ACCT_BONUS ) {
                    // pass
                } else if ( !main ) {
                    main = a;
                } else {
                    as.error( 'InternalError', 'More than one currency account' );
                }

                if ( a.acct_type === this.ACCT_TRANSIT ) {
                    do_transit = true;
                } else {
                    AmountTools.accountFromStorage( a );
                    game_balance = AmountTools.add(
                        game_balance,
                        a.available_balance,
                        a.dec_places
                    );
                }
            }

            if ( !main ) {
                as.error( 'CurrencyMismatch' );
            } else if ( do_transit ) {
                this._ccm.xferIface( as, 'futoin.xfer.gaming', main.rel_uuidb64 );
                as.add( ( as, iface ) => iface.gameBalance( as, user_ext_id, currency, info ) );
                as.add( ( as, { balance } ) => {
                    game_balance = AmountTools.add(
                        game_balance,
                        balance,
                        main.dec_places
                    );
                    as.success( game_balance );
                } );
            } else {
                as.success( game_balance );
            }
        } );
    }

    //-----------------------
    closeBonus( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
            .set( 'rel_uuidb64', xfer.dst_account )
            .set( 'enabled', 'N' )
            .where( 'uuidb64', xfer.src_account );

        dbxfer.select( DB_ACCOUNTS_VIEW, { selected: 1, result: true } )
            .where( 'uuidb64', xfer.src_account );

        dbxfer.executeAssoc( as );

        as.add( ( as, res ) => {
            const info = res[0].rows[0];

            AmountTools.accountFromStorage( info );
            xfer.amount = info.available_balance;
            xfer.force = true;

            if ( !AmountTools.isZero( xfer.amount ) ) {
                this.processXfer( as, xfer );
            }
        } );
    }

    reserveBet( as, xfer, main, bonus_accounts ) {
        if ( main.acct_type === this.ACCT_TRANSIT ) {
            // TODO: support bonus accounts in transit system
            return;
        }

        if ( bonus_accounts.length <= 0 ) {
            return;
        }

        const accounts = [ main, ...bonus_accounts ];

        // fail early
        {
            let total_balance = '0';

            accounts.forEach( ( a ) => {
                AmountTools.accountFromStorage( a );
                total_balance = AmountTools.add(
                    total_balance, a.available_balance, a.dec_places );
            } );

            if ( AmountTools.isLess( total_balance, xfer.amount ) ) {
                // Let if fail through default path
                return;
            }
        }

        const db = this._ccm.db( 'xfer' );
        const dbxfer = db.newXfer();
        const helpers = db.helpers();
        const dec_places = bonus_accounts[0].dec_places;
        const amt_q = helpers.expr( helpers.escape(
            AmountTools.toStorage( xfer.amount, dec_places )
        ) );

        // Make sure there are no previous reservations or xfers
        dbxfer.select( DB_RESERVATIONS_TABLE, { selected: 0 } )
            .where( 'ext_id', xfer.ext_id )
            .forUpdate();
        dbxfer.select( DB_XFERS_TABLE, { selected: 0 } )
            .where( 'ext_id', xfer.ext_id )
            .forUpdate();

        //---
        let prev_q;

        for ( let a of accounts ) {
            const sq = dbxfer.select( DB_ACCOUNTS_TABLE, { result: true } );
            sq.where( {
                uuidb64: a.uuidb64,
                enabled: 'Y',
            } );
            sq.forUpdate();

            const leftover = helpers.cast(
                prev_q ? sq.backref( prev_q, 'leftover' ) : amt_q,
                `DECIMAL(${AmountTools.MAX_DIGITS},0)`
            );

            const part = helpers.greatest(
                helpers.least( helpers.expr( '(balance - reserved)' ), leftover ),
                0
            );

            sq.get( 'leftover', `(${leftover} - ${part})` );
            sq.get( 'part', helpers.cast( helpers.expr( part ), 'TEXT' ) );
            sq.get( 'account', 'uuidb64' );

            //---
            const uq = dbxfer.update( DB_ACCOUNTS_TABLE );
            uq.where( 'uuidb64', a.uuidb64 );

            const new_reserved = helpers.expr( `reserved + ${uq.backref( sq, 'part' )}` );
            uq.set( 'reserved', new_reserved );
            uq.where( 'balance >=', new_reserved );

            this._recordBalance( dbxfer, null, a.uuidb64, null, dec_places );

            //---
            const reserve_q = dbxfer.insert( DB_RESERVATIONS_TABLE );
            reserve_q.set( {
                ext_id: xfer.ext_id,
                account: a.uuidb64,
                currency_id: a.currency_id,
                amount: reserve_q.backref( sq, 'part' ),
                created: helpers.now(),
            } );

            //---
            prev_q = sq;
        }

        as.add(
            ( as ) => {
                dbxfer.executeAssoc( as );
                as.add( ( as, result ) => {
                    as.success( result.map( ( v ) => v.rows[0] ) );
                } );
            },
            ( as, err ) => {
                // already reserved
                if ( err === 'XferCondition' ) {
                    db.select( DB_RESERVATIONS_TABLE )
                        .get( 'part', 'amount' )
                        .get( 'account' )
                        .where( 'ext_id', xfer.ext_id )
                        .executeAssoc( as );
                }
            }
        );
        as.add( ( as, rows ) => {
            let total = '0';

            for ( let r of rows ) {
                const part = AmountTools.fromStorage( r.part, dec_places );
                total = AmountTools.add( total, part, dec_places );
            }

            // Make sure amounts exactly match (e.g. handle repeats)
            if ( AmountTools.isEqual( total, xfer.amount ) ) {
                xfer.use_preauth = xfer.ext_id;
            } else if ( !AmountTools.isZero( total ) ) {
                // clear reservaton and let it fail through standard path
                this.clearReservedBet( as, xfer, rows );
            }
        } );
    }

    clearReservedBet( as, xfer, rows=null ) {
        const db = this._ccm.db( 'xfer' );

        if ( !rows ) {
            db.select( [ DB_RESERVATIONS_TABLE, 'R' ] )
                .innerJoin( [ DB_ACCOUNTS_TABLE, 'A' ], 'A.uuidb64 = R.account' )
                .innerJoin( [ DB_CURRENCY_TABLE, 'C' ], 'C.id = R.currency_id' )
                .get( 'account', 'R.account' )
                .get( 'enabled', 'A.enabled' )
                .get( 'rel_uuidb64' )
                .get( 'dec_places' )
                .where( 'R.ext_id', xfer.ext_id )
                .executeAssoc( as );
            as.add( ( as, r ) => rows = r );
        }

        as.add( ( as ) => {
            const dbxfer = db.newXfer();

            for ( let r of rows ) {
                // get actual & lock in DB xfer
                const sq = dbxfer.select( DB_RESERVATIONS_TABLE, { selected: 1 } );
                sq.get( 'amount' );
                sq.where( {
                    ext_id: xfer.ext_id,
                    account: r.account,
                } );
                sq.forUpdate();

                // clear reservation itself
                const urq = dbxfer.update( DB_RESERVATIONS_TABLE, { affected: 1 } );
                urq.set( 'amount', urq.expr( `amount - ${urq.backref( sq, 'amount' )}` ) );
                urq.where( {
                    ext_id: xfer.ext_id,
                    account: r.account,
                    'amount >=': urq.backref( sq, 'amount' ),
                } );

                // release account
                const uaq = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );
                const amt_q = uaq.backref( sq, 'amount' );
                uaq.set( 'reserved', uaq.expr( `reserved - ${amt_q}` ) );

                this._recordBalance( dbxfer, null, r.account, null, r.dec_places );

                if ( r.enabled === 'Y' ) {
                    uaq.where( {
                        uuidb64: r.account,
                        enabled: 'Y',
                        'reserved >=': amt_q,
                    } );
                } else {
                    uaq.set( 'balance', uaq.expr( `balance - ${amt_q}` ) );
                    uaq.where( {
                        uuidb64: r.account,
                        enabled: 'N',
                        'reserved >=': amt_q,
                        'balance >=': amt_q,
                    } );

                    // Move to passthrough target
                    const dst_uaq = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );
                    dst_uaq.set( 'balance',
                        dst_uaq.expr( `balance - ${dst_uaq.backref( sq, 'amount' )}` ) );
                    dst_uaq.where( 'uuidb64', r.rel_uuidb64 );

                    this._recordBalance( dbxfer, null, r.rel_uuidb64, null, r.dec_places );
                }
            }
        } );
    }

    _dsitributeBonusWin( as, dbxfer, xfer ) {
        const db = dbxfer.lface();
        db.select( DB_XFERS_TABLE )
            .get( 'misc_data' )
            .where( {
                'ext_id IN': db.select( DB_ROUND_XFERS_TABLE )
                    .get( 'ext_id' )
                    .where( 'round_id', xfer.misc_data.round_id ),
                xfer_type: 'Bet',
                xfer_status: this.ST_DONE,
            } )
            .executeAssoc( as );

        as.add( ( as, rows ) => {
            // Fail if new bets arrive in the middle of processing
            //---
            dbxfer.select( DB_XFERS_TABLE, { selected: rows.length } )
                .get( 'misc_data' )
                .where( {
                    'ext_id IN': db.select( DB_ROUND_XFERS_TABLE )
                        .get( 'ext_id' )
                        .where( 'round_id', xfer.misc_data.round_id ),
                    xfer_type: 'Bet',
                    xfer_status: this.ST_DONE,
                } );

            //---
            let distrib = false;
            const dst_info = xfer.dst_info;
            const dec_places = dst_info.dec_places;
            const contribs = {};

            // Find out bonus contributions
            //---
            for ( let r of rows ) {
                const used_amounts = JSON.parse( r.misc_data ).used_amounts;

                if ( used_amounts ) {
                    distrib = true;

                    for ( let a in used_amounts ) {
                        if ( a in contribs ) {
                            contribs[a] = AmountTools.add(
                                contribs[a],
                                used_amounts[a],
                                dec_places
                            );
                        } else {
                            contribs[a] = used_amounts[a];
                        }
                    }
                }
            }

            if ( !distrib ) {
                return;
            }

            //---
            const helpers = dbxfer.helpers();

            distrib = AmountTools.distributeWin(
                contribs, xfer.dst_amount, dec_places );

            {
                const amt = AmountTools.toStorage( xfer.dst_amount, dec_places );

                dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                    .set( 'balance',
                        helpers.expr( `balance - ${helpers.escape( amt )}` ) )
                    .where( {
                        uuidb64: xfer.dst_account,
                        // extra safety
                        currency_id: dst_info.currency_id,
                        holder: dst_info.holder,
                    } );
                this._recordBalance( dbxfer, null, xfer.dst_account, null, dec_places );

                xfer.misc_data.win_distrib = distrib;
                this._updateMiscData( dbxfer, xfer );
            }

            for ( let account in distrib ) {
                const amt = AmountTools.toStorage( distrib[account], dec_places );
                const account_q = this._bonusAccountTarget( dbxfer, account );

                const upd_q = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                    .set( 'balance',
                        helpers.expr( `balance + ${helpers.escape( amt )}` ) );
                upd_q.where( {
                    uuidb64: upd_q.backref( account_q, 'account' ),
                    // extra safety
                    enabled: 'Y', // only for Bonus here
                    currency_id: dst_info.currency_id,
                } );
                this._recordBalance( dbxfer, null, account_q, null, dec_places );
            }
        } );
    }

    _cancelBonusContrib( dbxfer, xfer ) {
        const used_amounts = xfer.misc_data.used_amounts;

        if ( ( xfer.type !== 'Bet' ) ||
             !used_amounts ||
             ( xfer.status === this.ST_CANCELED )
        ) {
            return;
        }

        const src_info = xfer.src_info;
        const dec_places = src_info.dec_places;
        const helpers = dbxfer.helpers();
        let total_contrib = '0';

        for ( let account in used_amounts ) {
            if ( account === xfer.src_account ) {
                continue;
            }

            const amount = AmountTools.toStorage( used_amounts[ account ], dec_places );
            total_contrib = AmountTools.add( total_contrib, amount, 0 );
            const account_q = this._bonusAccountTarget( dbxfer, account );

            const upd_q = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                .set( 'balance',
                    helpers.expr( `balance + ${helpers.escape( amount )}` ) );
            upd_q.where( {
                uuidb64: upd_q.backref( account_q, 'account' ),
                // extra safety
                enabled: 'Y', // only for Bonus here
                currency_id: src_info.currency_id,
            } );
            this._recordBalance( dbxfer, null, account_q, null, dec_places );
        }

        if ( !AmountTools.isZero( total_contrib ) ) {
            dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                .set( 'balance',
                    helpers.expr( `balance - ${helpers.escape( total_contrib )}` ) )
                .where( {
                    uuidb64: xfer.src_account,
                    // extra safety
                    currency_id: src_info.currency_id,
                    holder: src_info.holder,
                } );
            this._recordBalance( dbxfer, null, xfer.src_account, null, dec_places );
        }
    }

    _bonusAccountTarget( dbxfer, account ) {
        const q = dbxfer.select( DB_ACCOUNTS_TABLE, { selected: 1 } )
            .get( 'account', dbxfer.expr(
                // TODO: move to DB helpers
                `CASE WHEN enabled=${dbxfer.escape( 'Y' )} THEN uuidb64 ELSE rel_uuidb64 END` ) )
            .where( 'uuidb64', account );

        return q;
    }

    //-----------------------
    _dbGameBalance( dbxfer, xfer ) {
        // NOTE: always get actual balance
        let acct_info;

        switch ( xfer.type ) {
        case 'Bet':
            acct_info = xfer.src_info;

            if ( !xfer.misc_data.bonus_part ) {
                xfer.misc_data.bonus_part = AmountTools.fromStorage(
                    '0', acct_info.dec_places
                );
            }

            break;

        case 'Win':
            acct_info = xfer.dst_info;
            break;
        }

        if ( acct_info ) {
            dbxfer.select( DB_ACCOUNTS_VIEW, { result: true } )
                .get( 'game_balance', 'COALESCE(SUM(balance + COALESCE(overdraft, 0) - reserved), 0)' )
                .where( {
                    holder: acct_info.holder,
                    holder_enabled: 'Y',
                    account_enabled: 'Y',
                } );
            xfer.game_balance_dec_places = acct_info.dec_places;
        }
    }

    _handleGameBalance( as, xfer, result ) {
        if ( xfer.game_balance_dec_places ) {
            xfer.game_balance = AmountTools.fromStorage(
                result.rows[0]['game_balance'],
                xfer.game_balance_dec_places
            );
        }
    }
    //-----------------------

    genRoundID( as, xfer, ext_round_id ) {
        const db = this._ccm.db( 'xfer' );

        const ext_info = xfer.misc_data.info;
        ext_info.orig_round_id = ext_info.orig_round_id || ext_round_id;

        // TODO: caching
        as.add(
            ( as ) => {
                const dbxfer = db.newXfer();
                const round_id = xfer.misc_data.round_id = UUIDTool.genB64();

                dbxfer.insert( DB_ROUNDS_TABLE, { affected: 1 } )
                    .set( { round_id, ext_round_id } );
                UUIDTool.addXfer( dbxfer, round_id ); // minimize locking of global UUID table
                dbxfer.execute( as );
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    db.select( DB_ROUNDS_TABLE )
                        .get( 'round_id' )
                        .where( { ext_round_id } )
                        .execute( as );
                    as.add( ( as, { rows } ) => {
                        xfer.misc_data.round_id = rows[0][0];
                    } );
                }
            }
        );
    }

    _recordRoundXfer( as, dbxfer, xfer ) {
        switch ( xfer.type ) {
        case 'Bet':
        case 'Win':
            dbxfer.insert( DB_ROUND_XFERS_TABLE, { affected: 1 } )
                .set( {
                    round_id : xfer.misc_data.round_id,
                    ext_id : xfer.ext_id,
                } );
            break;
        }
    }

    _checkNoRoundWin( dbxfer, xfer ) {
        const round_id = xfer.misc_data.round_id;

        if ( !round_id || xfer.repeat || ( xfer.type === this.ST_CANCELED ) ) {
            // allow phantom cancel and repeats
            return;
        }

        dbxfer.select( DB_XFERS_TABLE, { selected: 0 } )
            .where( 'ext_id IN',
                dbxfer.lface()
                    .select( DB_ROUND_XFERS_TABLE )
                    .get( 'ext_id' )
                    .where( 'round_id', xfer.misc_data.round_id )
            )
            .where( 'xfer_type', 'Win' );
    }

    //-----------------------

    _domainDbStep( as, dbxfer, xfer ) {
        if ( !xfer.repeat ) {
            this._recordRoundXfer( as, dbxfer, xfer );

            switch ( xfer.type ) {
            case 'Bet':
                this._checkNoRoundWin( dbxfer, xfer );
                break;

            case 'Win':
                this._dsitributeBonusWin( as, dbxfer, xfer );
                break;
            }
        }

        // Must be the last after all sub-steps
        as.add( ( as ) => this._dbGameBalance( dbxfer, xfer ) );
    }

    _domainDbResult( as, xfer, result ) {
        this._handleGameBalance( as, xfer, result[0] );
    }

    //-----------------------
    _domainDbCancelStep( as, dbxfer, xfer ) {
        this._cancelBonusContrib( dbxfer, xfer );
        this._dbGameBalance( dbxfer, xfer );
        this._checkNoRoundWin( dbxfer, xfer );
    }

    _domainDbCancelResult( as, xfer, result ) {
        this._handleGameBalance( as, xfer, result[0] );
    }

    //-----------------------
    _domainExtIn( as, xfer ) {
        if ( xfer.type !== 'Bet' ) {
            return super._domainExtIn( as, xfer );
        }

        const in_xfer = xfer.in_xfer;
        const acct_info = in_xfer.dst_info;

        this._ccm.xferIface( as, 'futoin.xfer.gaming', in_xfer.src_account );

        as.add( ( as, iface ) => iface.call( as, 'bet', {
            user : acct_info.ext_holder_id,
            rel_account: in_xfer.src_info.ext_acct_id,
            currency: in_xfer.currency,
            amount: in_xfer.amount,
            ext_id: xfer.id,
            round_id: xfer.misc_data.round_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance, bonus_part } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
            xfer.game_balance_ext = balance;

            if ( !AmountTools.isZero( bonus_part ) ) {
                xfer.misc_data.bonus_part = AmountTools.add(
                    xfer.misc_data.bonus_part, bonus_part, acct_info.dec_places
                );
                xfer.update_misc_data = true;
            }
        } );
    }

    _domainCancelExtIn( as, xfer ) {
        if ( xfer.type !== 'Bet' ) {
            return super._domainCancelExtIn( as, xfer );
        }

        const in_xfer = xfer.in_xfer;
        const acct_info = in_xfer.dst_info;

        this._ccm.xferIface( as, 'futoin.xfer.gaming', in_xfer.src_account );

        as.add( ( as, iface ) => iface.call( as, 'cancelBet', {
            user : acct_info.ext_holder_id,
            rel_account: in_xfer.src_info.ext_acct_id,
            currency: in_xfer.currency,
            amount: in_xfer.amount,
            ext_id: xfer.id,
            round_id: xfer.misc_data.round_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
            xfer.game_balance_ext = balance;
        } );
    }

    //-----------------------
    _domainExtOut( as, xfer ) {
        if ( xfer.type !== 'Win' ) {
            return super._domainExtOut( as, xfer );
        }

        const out_xfer = xfer.out_xfer;
        const acct_info = out_xfer.src_info;

        this._ccm.xferIface( as, 'futoin.xfer.gaming', out_xfer.dst_account );

        as.add( ( as, iface ) => iface.call( as, 'win', {
            user : acct_info.ext_holder_id,
            rel_account: out_xfer.dst_info.ext_acct_id,
            currency: out_xfer.currency,
            amount: out_xfer.amount,
            ext_id: xfer.id,
            round_id: xfer.misc_data.round_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
            xfer.game_balance_ext = balance;
        } );
    }

    _domainCancelExtOut( as, xfer ) {
        if ( xfer.type !== 'Win' ) {
            return super._domainCancelExtOut( as, xfer );
        }

        as.error( 'InternalError', 'Win cancellation is not allowed' );
    }
    //-----------------------
    _domainPostExternal( as, xfer ) {
        if ( ( xfer.type === 'Bet' || xfer.type === 'Win' ) &&
             !xfer.game_balance_ext
        ) {
            const acct_info = ( xfer.type === 'Bet' ) ? xfer.src_info : xfer.dst_info;

            if ( acct_info.acct_type === this.ACCT_TRANSIT ) {
                this._ccm.xferIface( as, 'futoin.xfer.gaming', acct_info.rel_uuidb64 );

                as.add( ( as, iface ) => {
                    iface.gameBalance(
                        as,
                        acct_info.ext_holder_id,
                        xfer.currency,
                        xfer.misc_data.info
                    );
                } );
                as.add( ( as, { balance } ) => {
                    xfer.game_balance = AmountTools.add(
                        xfer.game_balance,
                        balance,
                        xfer.game_balance_dec_places
                    );
                } );
            }
        }
    }
}

module.exports = GamingTools;
