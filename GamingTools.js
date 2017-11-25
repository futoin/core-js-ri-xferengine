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

const {
    DB_ACCOUNTS_TABLE,
    DB_ACCOUNTS_VIEW,
    DB_ROUNDS_TABLE,
    DB_XFERS_TABLE,
} = require( './main' );


/**
 * XferTools with focus on Gaming use case
 */
class GamingTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Gaming' );
    }

    findAccount( as, user_ext_id, currency, forced=false ) {
        const db = this._ccm.db( 'xfer' );

        const q = db.select( DB_ACCOUNTS_VIEW )
            .where( {
                ext_holder_id: user_ext_id,
                currency: currency,
                account_enabled: 'Y',
            } )
            .order( 'account_created' );

        if ( forced ) {
            q.where( {
                'acct_type <>': this.ACCT_BONUS,
            } );
        } else {
            q.where( {
                holder_enabled: 'Y',
            } );
        }

        q.executeAssoc( as );

        as.add( ( as, accounts ) => {
            const bonus = [];
            let main_id;

            for ( let a of accounts ) {
                if ( a.acct_type === this.ACCT_BONUS ) {
                    bonus.push( a );
                } else if ( !main_id ) {
                    main_id = a.uuidb64;
                } else {
                    as.error( 'InternalError', 'More than one currency account' );
                }
            }

            if ( main_id ) {
                as.success( main_id, bonus );
            } else {
                as.error( 'CurrencyMismatch' );
            }
        } );
    }

    getGameBalance( as, user_ext_id, currency ) {
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
                as.add( ( as, iface ) => iface.gameBalance( as, user_ext_id, currency ) );
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

    //-----------------------
    _dbGameBalance( dbxfer, xfer ) {
        // NOTE: always get actual balance
        let acct_info;

        switch ( xfer.type ) {
        case 'Bet':
            acct_info = xfer.src_info;
            break;

        case 'Win':
            acct_info = xfer.dst_info;
            break;
        }

        if ( acct_info ) {
            xfer.bonus_part = AmountTools.fromStorage(
                '0', acct_info.dec_places
            );

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

    _recordRoundXfer( as, dbxfer, xfer ) {
        switch ( xfer.type ) {
        case 'Bet':
        case 'Win':
            dbxfer.insert( DB_ROUNDS_TABLE, { affected: 1 } )
                .set( {
                    round_id : xfer.misc_data.round_id,
                    ext_id : xfer.ext_id,
                } );
            break;
        }
    }

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

        // forbid cancel bet after win
        //---
        if ( !xfer.repeat ) {
            dbxfer.select( DB_XFERS_TABLE, { selected: 0 } )
                .where( 'xfer_id IN',
                    dbxfer.lface( DB_ROUNDS_TABLE )
                        .where( 'round_id', xfer.misc_data.round_id )
                )
                .where( 'xfer_type', 'Win' );
        }
        //---
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
                        xfer.currency
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
