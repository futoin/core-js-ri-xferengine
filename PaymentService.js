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
const PaymentFace = require( './PaymentFace' );
const PaymentTools = require( './PaymentTools' );

/**
 * Payments Service
 */
class PaymentService extends BaseService {
    static get IFACE_IMPL() {
        return PaymentFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new PaymentTools( ccm );
    }

    _param2outbound( xt, reqinfo ) {
        const p = reqinfo.params();

        const p_fee = p.extra_fee;
        let extra_fee = null;

        if ( p_fee ) {
            extra_fee = {
                dst_account: p_fee.rel_account,
                amount: p_fee.amount,
                currency: p_fee.currency,
                misc_data: {
                    info : {
                        reason: p_fee.reason,
                    },
                },
            };
        }

        return {
            id : p.xfer_id ? p.xfer_id : null,
            type: 'Generic',
            src_limit_domain: 'Payments',
            src_limit_prefix: 'outbound',
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

    _param2inbound( xt, reqinfo ) {
        const p = reqinfo.params();

        const p_fee = p.xfer_fee;
        let xfer_fee = null;

        if ( p_fee ) {
            xfer_fee = {
                dst_account: p_fee.rel_account,
                amount: p_fee.amount,
                currency: p_fee.currency,
                misc_data: {
                    info : {
                        reason: p_fee.reason,
                    },
                },
            };
        }

        return {
            type: 'Generic',
            src_limit_domain: 'Payments',
            src_limit_prefix: 'outbound',
            dst_limit_domain: 'Payments',
            dst_limit_prefix: 'inbound',
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
            ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
            orig_ts: p.orig_ts,
            misc_data: { info: p.ext_info },
            xfer_fee,
        };
    }

    startOutbound( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._param2outbound( xt, reqinfo );

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

    confirmOutbound( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._param2outbound( xt, reqinfo );

        xfer.user_confirm = true;

        xt.processXfer( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    rejectOutbound( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._param2outbound( xt, reqinfo );

        xfer.reject_mode = true;
        xfer.misc_data.cancel_reason = 'Rejected by user';

        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    onInbound( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._param2inbound( xt, reqinfo );

        xt.processXfer( as, xfer );
        as.add( ( as, xfer_id ) => reqinfo.result( xfer_id ) );
    }

    /**
     * Register futoin.xfers.direct interface with Executor
     * @alias PaymentService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {PaymentService} instance
     */
}

module.exports = PaymentService;
