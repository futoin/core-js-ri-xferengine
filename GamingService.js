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
const GamingFace = require( './GamingFace' );
const GamingTools = require( './GamingTools' );

/**
 * Gaming Service
 */
class GamingService extends BaseService {
    static get IFACE_IMPL() {
        return GamingFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new GamingTools( ccm );
    }

    bet( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );

        xt.findAccounts( as, p.user, p.currency, p.ext_info );

        as.add( ( as, main, _bonus_accounts ) => {
            const xfer = {
                type: 'Bet',
                src_limit_domain: 'Gaming',
                src_limit_prefix: 'bet',
                dst_limit_domain: 'Payments',
                dst_limit_prefix: 'inbound',
                src_account: main.uuidb64,
                dst_account: p.rel_account,
                amount: p.amount,
                currency: p.currency,
                ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
                orig_ts: p.orig_ts,
                misc_data: {
                    info: Object.assign(
                        { orig_ext_id: p.ext_id },
                        p.ext_info
                    ),
                    orig_ts: p.orig_ts,
                },
            };

            xt.genRoundID( as, xfer, xt.makeExtId( p.rel_account, p.round_id ) );
            //xt.reserveBet( as, xfer, main, bonus_accounts );
            xt.processXfer( as, xfer );

            as.add( ( as, xfer_id ) => {
                reqinfo.result( {
                    xfer_id,
                    balance: xfer.game_balance,
                    bonus_part: xfer.bonus_part,
                } );
            } );
        } );
    }

    cancelBet( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );

        xt.findAccounts( as, p.user, p.currency, p.ext_info );

        as.add( ( as, main ) => {
            const xfer = {
                type: 'Bet',
                src_limit_domain: 'Gaming',
                src_limit_prefix: 'bet',
                dst_limit_domain: 'Payments',
                dst_limit_prefix: 'inbound',
                src_account: main.uuidb64,
                dst_account: p.rel_account,
                amount: p.amount,
                currency: p.currency,
                ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
                orig_ts: p.orig_ts,
                misc_data: {
                    info: Object.assign(
                        { orig_ext_id: p.ext_id },
                        p.ext_info
                    ),
                    orig_ts: p.orig_ts,
                },
            };

            xt.genRoundID( as, xfer, xt.makeExtId( p.rel_account, p.round_id ) );
            xt.processCancel( as, xfer );

            xt.getGameBalance( as, p.user, p.currency, p.ext_info );
            as.add( ( as, balance ) => reqinfo.result( { balance } ) );
        } );
    }

    win( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );

        xt.findAccounts( as, p.user, p.currency, p.ext_info );

        as.add( ( as, main ) => {
            const xfer = {
                type: 'Win',
                src_limit_domain: 'Payments',
                src_limit_prefix: 'outbound',
                dst_limit_domain: 'Gaming',
                dst_limit_prefix: 'win',
                src_account: p.rel_account,
                dst_account: main.uuidb64,
                amount: p.amount,
                currency: p.currency,
                ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
                orig_ts: p.orig_ts,
                misc_data: {
                    info: Object.assign(
                        { orig_ext_id: p.ext_id },
                        p.ext_info
                    ),
                    orig_ts: p.orig_ts,
                },
            };

            xt.genRoundID( as, xfer, xt.makeExtId( p.rel_account, p.round_id ) );
            xt.processXfer( as, xfer );

            as.add( ( as, xfer_id ) => {
                reqinfo.result( {
                    xfer_id,
                    balance: xfer.game_balance,
                } );
            } );
        } );
    }

    gameBalance( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );
        xt.getGameBalance( as, p.user, p.currency, p.ext_info );
        as.add( ( as, balance ) => reqinfo.result( { balance } ) );
    }


    /**
     * Register futoin.xfers.gaming interface with Executor
     * @alias GamingService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {GamingService} instance
     */
}

module.exports = GamingService;
