'use strict';

const BaseService = require( './BaseService' );
const DepositFace = require( './DepositFace' );
const DepositTools = require( './DepositTools' );

/**
 * Deposits Service
 */
class DepositService extends BaseService {
    static get IFACE_IMPL() {
        return DepositFace;
    }

    preDepositCheck( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const xt = new DepositTools( ccm );
        const p = reqinfo.params();

        xt.processXfer( as, {
            noop: true,
            type: 'Deposit',
            src_limit_prefix: false,
            dst_limit_prefix: 'deposit',
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
        } );

        as.add( ( as ) => reqinfo.result( true ) );
    }

    onDeposit( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const xt = new DepositTools( ccm );
        const p = reqinfo.params();

        const p_fee = p.fee;
        let xfer_fee = null;

        if ( p_fee ) {
            xfer_fee = {
                dst_account: p_fee.rel_account,
                amount: p_fee.amount,
                currency: p_fee.currency,
                misc_data: {
                    reason: p_fee.reason,
                },
            };
        }

        xt.processXfer( as, {
            type: 'Deposit',
            src_limit_prefix: false,
            dst_limit_prefix: 'deposit',
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
            ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
            orig_ts: p.orig_ts,
            misc_data: { ext_info: p.ext_info },
            xfer_fee,
        } );

        as.add( ( as, id ) => reqinfo.result( id ) );
    }

    /**
     * Register futoin.xfers.deposit interface with Executor
     * @alias DepositService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {DepositService} instance
     */
}

module.exports = DepositService;
