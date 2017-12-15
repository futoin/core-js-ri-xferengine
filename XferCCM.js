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

const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const moment = require( 'moment' );

const DepositFace = require( './DepositFace' );
const WithdrawFace = require( './WithdrawFace' );
const GamingFace = require( './GamingFace' );
const PeerFace = require( './PeerFace' );

const {
    FTN19_VERSION,
} = require( './main' );

/**
 * Special CCM implementation for XferCore
 */
class XferCCM extends AdvancedCCM {
    constructor( ...args ) {
        super( ...args );

        this._on_demand_callbacks = {};

        this.registerOnDemand(
            DepositFace.IFACE_NAME,
            'default',
            ( as, ccm, alias, api ) => {
                DepositFace.register(
                    as,
                    ccm,
                    alias,
                    api.endpoint,
                    api.credentials,
                    api.options
                );
            }
        );
        this.registerOnDemand(
            GamingFace.IFACE_NAME,
            'default',
            ( as, ccm, alias, api ) => {
                GamingFace.register(
                    as,
                    ccm,
                    alias,
                    api.endpoint,
                    api.credentials,
                    api.options
                );
            }
        );
        this.registerOnDemand(
            PeerFace.IFACE_NAME,
            'default',
            ( as, ccm, alias, api ) => {
                PeerFace.register(
                    as,
                    ccm,
                    alias,
                    api.endpoint,
                    api.credentials,
                    api.options
                );
            }
        );
        this.registerOnDemand(
            WithdrawFace.IFACE_NAME,
            'default',
            ( as, ccm, alias, api ) => {
                WithdrawFace.register(
                    as,
                    ccm,
                    alias,
                    api.endpoint,
                    api.credentials,
                    api.options
                );
            }
        );
    }

    /**
     * Register all services required for operation
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - internal protected executor
     */
    registerServices( as, executor ) {
        this.registerEventServices( as, executor );
        this.registerCurrencyServices( as, executor );
        this.registerLimitServices( as, executor );
        this.registerAccountServices( as, executor );
    }

    /**
     * Register event services required for operation
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - internal protected executor
     */
    registerEventServices( as, executor ) {
        const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
        const DBGenService = require( 'futoin-eventstream/DBGenService' );

        DBGenService.register( as, executor );
        DBGenFace.register( as, this, 'xfer.evtgen', executor );
    }

    /**
     * Register currency services required for operation
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - internal protected executor
     */
    registerCurrencyServices( as, executor ) {
        const InfoFace = require( './Currency/InfoFace' );
        const InfoService = require( './Currency/InfoService' );

        const ManageFace = require( './Currency/ManageFace' );
        const ManageService = require( './Currency/ManageService' );

        InfoService.register( as, executor );
        InfoFace.register( as, this, 'currency.info', executor );

        ManageService.register( as, executor );
        ManageFace.register( as, this, 'currency.manage', executor );
    }

    /**
     * Register limit services required for operation
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - internal protected executor
     */
    registerLimitServices( as, executor ) {
        const LimitsFace = require( './LimitsFace' );
        const LimitsService = require( './LimitsService' );

        LimitsService.register( as, executor );
        LimitsFace.register( as, this, 'xfer.limits', executor );
    }

    /**
     * Register account services required for operation
     * @param {AsyncSteps} as - async step interface
     * @param {Executor} executor - internal protected executor
     */
    registerAccountServices( as, executor ) {
        const AccountsFace = require( './AccountsFace' );
        const AccountsService = require( './AccountsService' );

        AccountsService.register( as, executor );
        AccountsFace.register( as, this, 'xfer.accounts', executor );
    }

    /**
     * Get manual alias for specific iface & key combination
     * @param {string} iface - interface identifier
     * @param {string} key - arbitrary key, typically account #
     * @returns {string} - manual key to be used with registerOnDemand()
     */
    makeManualAlias( iface, key ) {
        return `#manual_${iface}_${key}`;
    }

    /**
     * Register callback for on-demand interface creation
     * @param {string} iface - full iface identifier
     * @param {string} flavour - a type of interface implementation
     * @param {callable} callback - callback to register interface
     */
    registerOnDemand( iface, flavour, callback ) {
        const on_demand_cbs = this._on_demand_callbacks;

        on_demand_cbs[iface] = on_demand_cbs[iface] || {};
        on_demand_cbs[iface][flavour] = callback;
    }

    /**
     * Get interface with on-demand logic
     * @param {AsyncSteps} as - async step interface
     * @param {string} iface - full iface identifier
     * @param {string} account - related account ID
     */
    xferIface( as, iface, account ) {
        //---
        const manual = this.makeManualAlias( iface, account );

        try {
            const iface_obj = this.iface( manual );
            as.add( ( as ) => as.success( iface_obj ) );
            return;
        } catch ( _ ) {
            // pass
        }

        //---
        this._cleanup();

        const alias = `#auto_${iface}_${account}`;

        try {
            const iface_obj = this.iface( alias );
            iface_obj._xfer_last_used = moment.utc();
            as.add( ( as ) => as.success( iface_obj ) );
            return;
        } catch ( _ ) {
            // pass
        }

        //---
        const xferacct = this.iface( 'xfer.accounts' );

        xferacct.getAccount( as, account );
        as.add( ( as, account_info ) => {
            xferacct.getAccountHolder( as, account_info.holder );
            as.add( ( as, holder_info ) => as.success( { account_info, holder_info } ) );
        } );
        as.add( ( as, { account_info, holder_info } ) => {
            const api = ( holder_info.internal.api || {} )[iface];

            if ( !api ) {
                as.error( 'XferError', `No API config for ${holder_info.id}` );
            }

            const flavour = api.flavour || 'default';

            const on_demand_cbs = this._on_demand_callbacks;
            const cb = ( on_demand_cbs[iface] || {} )[flavour];

            if ( !cb ) {
                as.error( 'XferError', `No API creation callback for ${iface}/${flavour}` );
            }

            api.iface = iface;
            api.version = api.version || FTN19_VERSION;
            api.account_info = account_info;
            api.holder_info = holder_info;

            cb( as, this, alias, api );
            as.add( ( as ) => as.success( this.iface( alias ) ) );
        } );
    }

    _cleanup() {
        // no real use case yet, can be implemented in derived class
    }
}

module.exports = XferCCM;
