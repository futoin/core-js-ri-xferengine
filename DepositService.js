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
const DepositFace = require( './DepositFace' );
const DepositTools = require( './DepositTools' );

/**
 * Deposits Service
 */
class DepositService extends BaseService {
    static get IFACE_IMPL() {
        return DepositFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new DepositTools( ccm );
    }

    preDepositCheck( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();

        xt.processXfer( as, {
            noop: true,
            type: 'Deposit',
            src_limit_domain: 'Payments',
            src_limit_prefix: 'outbound',
            dst_limit_domain: 'Deposits',
            dst_limit_prefix: 'deposit',
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
        } );

        as.add( ( as ) => reqinfo.result( true ) );
    }

    onDeposit( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const p = reqinfo.params();

        const p_fee = p.fee;
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

        xt.processXfer( as, {
            type: 'Deposit',
            src_limit_domain: 'Payments',
            src_limit_prefix: 'outbound',
            dst_limit_domain: 'Deposits',
            dst_limit_prefix: 'deposit',
            src_account: p.rel_account,
            dst_account: p.account,
            amount: p.amount,
            currency: p.currency,
            ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
            orig_ts: p.orig_ts,
            misc_data: { info: p.ext_info },
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
