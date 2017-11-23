'use strict';

const XferTools = require( './XferTools' );
const AmountTools = require( './AmountTools' );

const {
    DB_ACCOUNTS_TABLE,
    DB_ACCOUNTS_VIEW,
} = require( './main' );


/**
 * XferTools with focus on Gaming use case
 */
class GamingTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Gaming' );
    }

    findAccount( as, user_ext_id, currency ) {
        const acctface = this._ccm.iface( 'xfer.accounts' );
        acctface.getAccountHolderExt( as, user_ext_id );

        as.add( ( as, holder ) => acctface.listAccounts( as, holder.id ) );
        as.add( ( as, accounts ) => {
            const bonus = [];
            let main;

            for ( let a of accounts ) {
                if ( ( a.currency === currency ) && a.enabled ) {
                    if ( a.type === this.ACCT_BONUS ) {
                        bonus.push( a.id );
                    } else if ( !main ) {
                        main = a.id;
                    } else {
                        as.error( 'InternalError', 'More than one currency account' );
                    }
                }
            }

            if ( main ) {
                as.success( main, bonus );
            } else {
                as.error( 'CurrencyMismatch' );
            }
        } );
    }

    getGameBalance( as, user_ext_id, currency ) {
        const currface = this._ccm.iface( 'currency.info' );
        let currency_info;

        currface.getCurrency( as, currency );
        as.add( ( as, res ) => currency_info = res );

        const acctface = this._ccm.iface( 'xfer.accounts' );
        acctface.getAccountHolderExt( as, user_ext_id );

        as.add( ( as, holder ) => acctface.listAccounts( as, holder.id ) );
        as.add( ( as, accounts ) => {
            let game_balance = '0';
            let main;
            let do_transit = false;

            for ( let a of accounts ) {
                if ( ( a.currency === currency ) && a.enabled ) {
                    if ( a.type === this.ACCT_BONUS ) {
                        // pass
                    } else if ( !main ) {
                        main = a;
                    } else {
                        as.error( 'InternalError', 'More than one currency account' );
                    }

                    if ( a.type === this.ACCT_TRANSIT ) {
                        do_transit = true;
                    } else {
                        game_balance = AmountTools.add(
                            game_balance,
                            a.balance,
                            currency_info.dec_places
                        );
                        game_balance = AmountTools.add(
                            game_balance,
                            a.overdraft,
                            currency_info.dec_places
                        );
                        game_balance = AmountTools.subtract(
                            game_balance,
                            a.reserved,
                            currency_info.dec_places
                        );
                    }
                }
            }

            if ( do_transit ) {
                this._ccm.xferIface( as, 'futoin.xfer.gaming', main.rel_id );
                as.add( ( as, iface ) => iface.gameBalance( as, user_ext_id, currency ) );
                as.add( ( as, { balance } ) => {
                    game_balance = AmountTools.add(
                        game_balance,
                        balance,
                        currency_info.dec_places
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

    _calcGameBalance( xfer ) {
        let acct_info;

        // Optimistic actual balance, not the post-xfer one!
        switch ( xfer.type ) {
        case 'Bet':
            acct_info = xfer.src_info;
            xfer.game_balance = AmountTools.subtract(
                acct_info.available_balance,
                xfer.amount,
                acct_info.dec_places
            );
            xfer.bonus_part = AmountTools.fromStorage(
                '0', acct_info.dec_places
            );
            break;

        case 'Win':
            acct_info = xfer.dst_info;
            xfer.game_balance = AmountTools.add(
                acct_info.available_balance,
                xfer.amount,
                acct_info.dec_places
            );
            xfer.bonus_part = AmountTools.fromStorage(
                '0', acct_info.dec_places
            );
            break;
        }
    }

    _domainDbStep( as, _dbxfer, xfer ) {
        this._calcGameBalance( xfer );
    }

    _domainDbCancelStep( as, _dbxfer, xfer ) {
        this._calcGameBalance( xfer );

        // TODO: forbid cancel bet after win
    }

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
            ext_id: xfer.ext_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance, bonus_part } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
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
            ext_id: xfer.ext_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
        } );
    }

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
            rel_bet: xfer.misc_data.rel_ext_bet,
            ext_id: xfer.ext_id,
            ext_info: xfer.misc_data.info,
            orig_ts: xfer.misc_data.orig_ts,
        } ) );
        as.add( ( as, { balance, bonus_part } ) => {
            // add local amounts
            xfer.game_balance = AmountTools.add(
                xfer.game_balance, balance, acct_info.dec_places
            );
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
}

module.exports = GamingTools;
