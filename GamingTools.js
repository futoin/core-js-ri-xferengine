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

            if ( do_transit ) {
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
            .set( 'reserved', dbxfer.expr( 'balance' ) )
            .where( 'uuidb64', xfer.src_account );

        dbxfer.select( DB_ACCOUNTS_VIEW, { selected: 1, result: true } )
            .where( 'uuidb64', xfer.src_account );

        dbxfer.executeAssoc( as );

        as.add( ( as, res ) => {
            const info = res[0].rows[0];

            xfer.amount = AmountTools.fromStorage( info.balance, info.dec_places );
            xfer.force = true;

            if ( !AmountTools.isZero( xfer.amount ) ) {
                this.processXfer( as, xfer );
            }
        } );
    }

    reserveBet( as, xfer, _main, bonus_accounts ) {
        if ( bonus_accounts.length <= 0 ) {
            return;
        }

        const db = this._ccm.db( 'xfer' );
        const dbxfer = db.newXfer();
        const helpers = db.helpers();
        const dec_places = bonus_accounts[0].dec_places;
        const amt_q = db.escape( AmountTools.toStorage( xfer.amount, dec_places ) );

        // Make sure there are no previous reservations
        dbxfer.select( DB_RESERVATIONS_TABLE, { selected: 0 } )
            .where( 'ext_id', xfer.ext_id );

        let prev_q;

        for ( let a of bonus_accounts ) {
            const sq = dbxfer.select( DB_ACCOUNTS_TABLE, { result: true } );
            sq.where( 'uuidb64', a.uuidb64 ).forUpdate();

            const leftover = prev_q ? sq.backref( prev_q, 'leftover' ) : amt_q;
            const part = `GREATEST(LEAST((balance-reserved), ${leftover}), 0)`;
            sq.get( 'leftover', `(${leftover} - ${part})` );
            sq.get( 'part', part );
            sq.get( 'account', 'uuidb64' );

            //---
            const uq = dbxfer.update( DB_ACCOUNTS_TABLE );
            uq.where( 'uuidb64', a.uuidb64 );

            const new_reserved = helpers.expr( `reserved + ${uq.backref( sq, 'part' )}` );
            uq.set( 'reserved', new_reserved );
            uq.where( 'balance >=', new_reserved );

            //---
            const reserve_q = dbxfer.insert( DB_RESERVATIONS_TABLE );
            reserve_q.set( {
                ext_id: xfer.ext_id,
                account: a.uuidb64,
                currency_id: a.currency_id,
                amount: xfer.amount,
            } );

            //---
            prev_q = sq;
        }

        as.add(
            ( as ) => dbxfer.executeAssoc( as ),
            ( as, err ) => {
                if ( err === 'XferCondition' ) {
                    db.select( DB_RESERVATIONS_TABLE )
                        .get( 'part', 'amount' )
                        .get( 'account' )
                        .where( 'ext_id', xfer.ext_id )
                        .execute( as );
                }
            }
        );
        as.add( ( as, result ) => {
            const bonus_parts = [];
            xfer.misc_data.bonus_parts = bonus_parts;

            for ( let r of result ) {
                r = r.rows[0];
                bonus_parts.push( {
                    id: r.account,
                    part: AmountTools.fromStorage( r.part, dec_places ),
                } );
            }
        } );
    }

    //-----------------------
    _dbGameBalance( dbxfer, xfer ) {
        // NOTE: always get actual balance
        let acct_info;

        switch ( xfer.type ) {
        case 'Bet':
            acct_info = xfer.src_info;

            xfer.bonus_part = AmountTools.fromStorage(
                '0', acct_info.dec_places
            );
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

    _checkCancelRoundXfer( dbxfer, xfer ) {
        // forbid cancel bet after win
        if ( xfer.status !== this.ST_CANCELED ) {
            dbxfer.select( DB_XFERS_TABLE, { selected: 0 } )
                .where( 'ext_id IN',
                    dbxfer.lface()
                        .select( DB_ROUND_XFERS_TABLE )
                        .get( 'ext_id' )
                        .where( 'round_id', xfer.misc_data.round_id )
                )
                .where( 'xfer_type', 'Win' );
        }
    }

    //-----------------------

    _domainDbStep( as, dbxfer, xfer ) {
        this._dbGameBalance( dbxfer, xfer );

        if ( !xfer.repeat ) {
            this._recordRoundXfer( as, dbxfer, xfer );
        }
    }

    _domainDbResult( as, xfer, result ) {
        this._handleGameBalance( as, xfer, result[0] );
    }

    //-----------------------
    _domainDbCancelStep( as, dbxfer, xfer ) {
        this._dbGameBalance( dbxfer, xfer );
        this._checkCancelRoundXfer( dbxfer, xfer );
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
            // re-use external
            round_id: xfer.misc_data.round_id,
            ext_id: xfer.ext_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance, bonus_part } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
            xfer.game_balance_ext = balance;
            xfer.bonus_part = AmountTools.add(
                xfer.bonus_part, bonus_part, acct_info.dec_places
            );
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
            // re-use external
            round_id: xfer.misc_data.round_id,
            ext_id: xfer.ext_id,
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
            // re-use external
            round_id: xfer.misc_data.round_id,
            ext_id: xfer.ext_id,
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
