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

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new DepositTools( ccm );
    }

    _params2xfer( xt, reqinfo ) {
        const p = reqinfo.params();
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
            src_limit_domain: 'Deposits',
            src_limit_prefix: 'withdrawal',
            dst_limit_domain: 'Payments',
            dst_limit_prefix: 'inbound',
            src_account: p.account,
            dst_account: p.rel_account,
            amount: p.amount,
            currency: p.currency,
            ext_id: p.ext_id ? xt.makeExtId( p.account, p.ext_id ) : null,
            orig_ts: p.orig_ts,
            misc_data: p.ext_info ? { info: p.ext_info } : {},
            extra_fee,
        };
    }

    startWithdrawal( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo );

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
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo );

        xfer.user_confirm = true;

        xt.processXfer( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    rejectWithdrawal( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo );

        xfer.reject_mode = true;
        xfer.misc_data.cancel_reason = 'Rejected by user';

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
