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
const GenericFace = require( './GenericFace' );
const XferTools = require( './XferTools' );

/**
 * Generic Service
 */
class GenericService extends BaseService {
    static get IFACE_IMPL() {
        return GenericFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new XferTools( ccm );
    }

    fee( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();
        const xfer = {
            type: 'Fee',
            src_limit_prefix: false,
            dst_limit_prefix: false,
            src_account: p.account,
            dst_account: p.rel_account,
            amount: p.amount,
            currency: p.currency,
            ext_id: xt.makeExtId( p.account, p.ext_id ),
            orig_ts: p.orig_ts,
            misc_data: {
                info: Object.assign(
                    {},
                    p.ext_info,
                    { reason: p.reason }
                ),
            },
            force: p.force,
        };
        xt.processXfer( as, xfer );
        as.add( ( as, xfer_id ) => reqinfo.result( xfer_id ) );
    }

    settle( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();
        const xfer = {
            type: 'Settle',
            src_limit_prefix: false,
            dst_limit_prefix: false,
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
            ext_id: xt.makeExtId( p.account, p.ext_id ),
            orig_ts: p.orig_ts,
            misc_data: {
                info: Object.assign(
                    {},
                    p.ext_info,
                    { reason: p.reason }
                ),
            },
            force: true,
        };
        xt.processXfer( as, xfer );
        as.add( ( as, xfer_id ) => reqinfo.result( xfer_id ) );
    }

    cancel( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();
        const p_xfer_fee = p.xfer_fee;
        const p_extra_fee = p.extra_fee;

        let xfer_fee = null;
        let extra_fee = null;

        if ( p_xfer_fee ) {
            xfer_fee = {
                dst_account: p_xfer_fee.rel_account,
                amount: p_xfer_fee.amount,
                currency: p_xfer_fee.currency,
                misc_data: {
                    info : {
                        reason: p_xfer_fee.reason,
                    },
                },
            };
        }

        if ( p_extra_fee ) {
            extra_fee = {
                dst_account: p_extra_fee.rel_account,
                amount: p_extra_fee.amount,
                currency: p_extra_fee.currency,
                misc_data: {
                    info : {
                        reason: p_extra_fee.reason,
                    },
                },
            };
        }

        const xfer = {
            id: p.xfer_id,
            type: p.type,
            src_limit_prefix: false,
            dst_limit_prefix: false,
            src_account: p.src_account,
            dst_account: p.dst_account,
            amount: p.amount,
            currency: p.currency,
            orig_ts: p.orig_ts,
            misc_data: {
                cancel_reason: p.reason,
            },
            xfer_fee,
            extra_fee,
            force: true,
        };
        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    /**
     * Register futoin.xfers.generic interface with Executor
     * @alias GenericService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {GenericService} instance
     */
}

module.exports = GenericService;
