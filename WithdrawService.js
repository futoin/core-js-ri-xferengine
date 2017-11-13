'use strict';

const BaseService = require( './BaseService' );
const WithdrawFace = require( './WithdrawFace' );
const DepositTools = require( './DepositTools' );

/**
 * Withdrawals Service
 */
class WithdrawService extends BaseService {
    static get IFACE_IMPL() {
        return WithdrawFace;
    }

    _params2xfer( p ) {
        const p_extra_fee = p.extra_fee;
        let extra_fee = null;

        if ( p_extra_fee ) {
            extra_fee = {
                dst_account: p_extra_fee.rel_account,
                amount: p_extra_fee.amount,
                currency: p_extra_fee.currency,
                misc_data: {
                    info: {
                        reason: p_extra_fee.reason,
                    },
                },
            };
        }

        return {
            id : p.xfer_id ? p.xfer_id : null,
            type: 'Withdrawal',
            src_limit_prefix: 'withdrawal',
            dst_limit_prefix: false,
            src_account: p.account,
            dst_account: p.rel_account,
            amount: p.amount,
            currency: p.currency,
            orig_ts: p.orig_ts ? p.orig_ts : null,
            extra_fee,
        };
    }

    startWithdrawal( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const xt = new DepositTools( ccm );
        const p = reqinfo.params();

        const xfer = this._params2xfer( p );

        as.add(
            ( as ) => {
                xt.processXfer( as, xfer );
            },
            ( as, err ) => {
                if ( err === 'WaitUser' ) {
                    as.success( xfer.id, true );
                }
            }
        );
        as.add( ( as, xfer_id, wait_user=false ) => {
            reqinfo.result( { xfer_id, wait_user } );
        } );
    }

    confirmWithdrawal( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const xt = new DepositTools( ccm );
        const p = reqinfo.params();

        const xfer = this._params2xfer( p );
        xfer.user_confirm = true;
        xt.processXfer( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    rejectWithdrawal( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const xt = new DepositTools( ccm );
        const p = reqinfo.params();

        const xfer = this._params2xfer( p );
        xfer.reject_mode = true;
        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    /**
     * Register futoin.xfers.withdraw interface with Executor
     * @alias WithdrawService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {WithdrawService} instance
     */
}

module.exports = WithdrawService;
