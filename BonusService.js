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
const BonusFace = require( './BonusFace' );
const GamingTools = require( './GamingTools' );
const AmountTools = require( './AmountTools' );

/**
 * Bonus Service
 */
class BonusService extends BaseService {
    static get IFACE_IMPL() {
        return BonusFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new GamingTools( ccm );
    }

    claimBonus( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const acctface = ccm.iface( 'xfer.accounts' );
        const p = reqinfo.params();

        const xt = this._xferTools( reqinfo );
        const ext_id = xt.makeExtId( p.rel_account, p.bonus_id );

        acctface.getAccountHolderExt( as, p.user );

        // Prepare bonus account
        as.add( ( as, holder ) => {
            as.add(
                ( as ) => {
                    acctface.addAccount( as,
                        holder.id,
                        xt.ACCT_BONUS,
                        p.currency,
                        p.alias,
                        true,
                        ext_id,
                        p.rel_account
                    );
                },
                ( as, err ) => {
                    if ( err !== 'Duplicate' ) {
                        return;
                    }

                    acctface.getAccountExt( as, holder.id, ext_id );
                    as.add( ( as, info ) => {
                        if ( ( info.currency !== p.currency ) ||
                             ( info.alias !== p.alias )
                        ) {
                            as.error( 'OriginalMismatch' );
                        }

                        as.success( info.id );
                    } );
                }
            );
        } );
        // Add bonus amount
        as.add( ( as, account_id ) => {
            const xfer = {
                type: 'Bonus',
                src_limit_domain: 'Payments',
                src_limit_prefix: 'outbound',
                dst_limit_prefix: false,
                src_account: p.rel_account,
                dst_account: account_id,
                amount: p.amount,
                currency: p.currency,
                ext_id: ext_id,
                orig_ts: p.orig_ts,
                misc_data: {
                    info: p.ext_info,
                    orig_ts: p.orig_ts,
                },
            };

            xt.processXfer( as, xfer );

            as.add( ( as ) => reqinfo.result( true ) );
        } );
    }

    clearBonus( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const acctface = ccm.iface( 'xfer.accounts' );
        const p = reqinfo.params();

        const xt = this._xferTools( reqinfo );
        const ext_id = xt.makeExtId( p.rel_account, p.bonus_id );

        acctface.getAccountHolderExt( as, p.user );

        as.add( ( as, holder ) => acctface.getAccountExt( as, holder.id, ext_id ) );
        as.add( ( as, info ) => {
            if ( !info.enabled && AmountTools.isZero( info.balance ) ) {
                if ( info.rel_id !== p.rel_account ) {
                    as.error( 'AlreadyReleased' );
                }
            } else {
                const xfer = {
                    type: 'CancelBonus',
                    src_limit_prefix: false,
                    dst_limit_prefix: false,
                    src_account: info.id,
                    dst_account: p.rel_account,
                    currency: info.currency,
                };

                xt.closeBonus( as, xfer );
            }
        } );

        as.add( ( as ) => reqinfo.result( true ) );
    }

    releaseBonus( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const acctface = ccm.iface( 'xfer.accounts' );
        const p = reqinfo.params();

        const xt = this._xferTools( reqinfo );
        const ext_id = xt.makeExtId( p.rel_account, p.bonus_id );

        acctface.getAccountHolderExt( as, p.user );

        as.add( ( as, holder ) => acctface.getAccountExt( as, holder.id, ext_id ) );
        as.add( ( as, info ) => {
            if ( !info.enabled && AmountTools.isZero( info.balance ) ) {
                if ( info.rel_id === p.rel_account ) {
                    as.error( 'AlreadyCanceled' );
                }
            } else {
                xt.findAccount( as, p.user, info.currency );

                as.add( ( as, main_account ) => {
                    const xfer = {
                        type: 'ReleaseBonus',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        src_account: info.id,
                        dst_account: main_account,
                        currency: info.currency,
                    };

                    xt.closeBonus( as, xfer );
                } );
            }
        } );

        as.add( ( as ) => reqinfo.result( true ) );
    }

    /**
     * Register futoin.xfers.bonus interface with Executor
     * @alias BonusService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {BonusService} instance
     */
}

module.exports = BonusService;
