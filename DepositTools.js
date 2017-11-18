'use strict';

const XferTools = require( './XferTools' );

/**
 * XferTools with focus on Deposits use case
 */
class DepositTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Deposits' );
    }

    _domainDbCancelStep( as, _dbxfer, xfer ) {
        if ( xfer.type === 'Deposit' ) {
            as.error( 'NotAllowed' );
        }
    }

    _rawExtOut( as, xfer ) {
        if ( xfer.type === 'Deposit' ) {
            this._ccm.xferIface( as, 'futoin.xfer.deposit', xfer.dst_account );
            as.add( ( as, iface ) => iface.call( as, 'onDeposit', {
                account : xfer.src_info.ext_acct_id,
                rel_account : xfer.dst_info.ext_acct_id,
                currency : xfer.src_info.currency,
                amount : xfer.src_amount,
                ext_id : xfer.id,
                ext_info :  xfer.misc_data.info || {},
                orig_ts : xfer.created,
            } ) );
        } else {
            super._rawExtOut( as, xfer );
        }
    }

    _rawCancelExtOut( as, xfer ) {
        if ( xfer.type === 'Deposit' ) {
            as.error( 'NotAllowed' );
        } else {
            super._rawCancelExtOut( as, xfer );
        }
    }
}

module.exports = DepositTools;
