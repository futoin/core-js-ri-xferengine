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
const RetailFace = require( './RetailFace' );
const RetailTools = require( './RetailTools' );

/**
 * Retail Service
 */
class RetailService extends BaseService {
    static get IFACE_IMPL() {
        return RetailFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new RetailTools( ccm );
    }

    //---------------------------------
    _params2xfer( xt, reqinfo, preauth=false ) {
        const p = reqinfo.params();
        const p_fee = p.fee;
        let xfer_fee = null;

        if ( p_fee ) {
            xfer_fee = {
                dst_account: p_fee.rel_account,
                amount: p_fee.amount,
                currency: p_fee.currency,
                misc_data: {
                    info: {
                        reason: p_fee.reason,
                    },
                },
            };
        }

        const xfer = {
            id : p.xfer_id ? p.xfer_id : null,
            src_limit_domain: 'Retail',
            src_limit_prefix: false,
            dst_limit_domain: 'Payments',
            dst_limit_prefix: false,
            src_account: p.account,
            dst_account: p.rel_account,
            amount: p.amount,
            currency: p.currency,
            ext_id: p.ext_id ? xt.makeExtId( p.rel_account, p.ext_id ) : null,
            orig_ts: p.orig_ts,
            misc_data: {
                info: p.ext_info,
            },
            xfer_fee: xfer_fee,
            use_preauth: p.rel_preauth || null,
        };

        if ( preauth ) {
            xfer.type = 'PreAuth';
            xfer.src_limit_prefix = 'preauth';
            xfer.dst_limit_extra = {
                inbound_daily_cnt : 1,
                inbound_weekly_cnt : 1,
                inbound_monthly_cnt : 1,
            };
        } else {
            xfer.type = 'Purchase';
            xfer.src_limit_prefix = 'retail';
            xfer.dst_limit_prefix = 'inbound';
        }

        return xfer;
    }

    purchase( as, reqinfo ) {
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

    cancelPurchase( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo );

        xfer.misc_data.cancel_reason = reqinfo.params().reason;

        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    confirmPurchase( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo );

        xfer.user_confirm = true;

        xt.processXfer( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    rejectPurchase( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo );

        xfer.reject_mode = true;
        xfer.misc_data.cancel_reason = 'Rejected by user';

        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    //---------------------------------
    refund( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();
        const xfer = {
            type: 'Refund',
            src_limit_domain: 'Payments',
            src_limit_prefix: 'outbound',
            dst_limit_domain: 'Payments',
            dst_limit_prefix: 'inbound',
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
            ext_id: p.ext_id ? xt.makeExtId( p.rel_account, p.ext_id ) : null,
            orig_ts: p.orig_ts,
            misc_data: {
                info: p.ext_info,
                purchase_id: p.purchase_id,
                purchase_ts: p.purchase_ts,
            },
        };

        xt.processXfer( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    //---------------------------------
    preAuth( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo, true );

        xfer.preauth = true;

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

    clearPreAuth( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo, true );

        xfer.preauth = true;

        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    confirmPreAuth( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo, true );

        xfer.preauth = true;
        xfer.user_confirm = true;

        xt.processXfer( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    rejectPreAuth( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._params2xfer( xt, reqinfo, true );

        xfer.preauth = true;
        xfer.reject_mode = true;
        xfer.misc_data.cancel_reason = 'Rejected by user';

        xt.processCancel( as, xfer );
        as.add( ( as ) => reqinfo.result( true ) );
    }

    /**
     * Register futoin.xfers.retail interface with Executor
     * @alias RetailService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {RetailService} instance
     */
}

module.exports = RetailService;
