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

const _defaults = require( 'lodash/defaults' );
const PingFace = require( 'futoin-invoker/PingFace' );
const invokerSpecDirs = require( 'futoin-invoker' ).specDirs;

const { FTN19_VERSION, PING_VERSION, specDirs } = require( './main' );


/**
 * Base Face with neutral common registration functionality
 *
 * @note Not official API
 */
class BaseFace extends PingFace {
    /**
     * Latest supported FTN17 version
     */
    static get LATEST_VERSION() {
        return FTN19_VERSION;
    }

    /**
     * Latest supported FTN4 version
     */
    static get PING_VERSION() {
        return PING_VERSION;
    }

    /**
     * Interface name - to be overridden
     * @property {string}
     * @alias BaseFace.IFACE_NAME
     */

    /**
     * CCM registration helper
     *
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=1.0] - interface version to use
     */
    static register( as, ccm, name, endpoint, credentials=null, options={} ) {
        const ifacever = options.version || this.LATEST_VERSION;

        _defaults( options, {
            nativeImpl: this,
            specDirs: this.spec(),
            sendOnBehalfOf: false,
        } );

        ccm.register(
            as,
            name,
            `${this.IFACE_NAME}:${ifacever}`,
            endpoint,
            credentials,
            options
        );
    }

    static spec() {
        return [
            specDirs,
            invokerSpecDirs,
            PingFace.spec( this.PING_VERSION ),
        ];
    }
}

module.exports = BaseFace;
