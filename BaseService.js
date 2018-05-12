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

const PingService = require( 'futoin-executor/PingService' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
const { DB_IFACEVER, EVTGEN_IFACEVER, EVTGEN_ALIAS } = require( './main' );

/**
 * Base Service with common registration logic
 */
class BaseService extends PingService {
    /**
     * Interface name - to be overridden
     * @alias BaseFace.IFACE_IMPL
     * @property {object}
     */

    /**
     * Register futoin.xfers.limits interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {LimitsService} instance
     */
    static register( as, executor, options={} ) {
        const Face = this.IFACE_IMPL;
        const ifacename = Face.IFACE_NAME;
        const ver = Face.LATEST_VERSION;
        const ifacever = `${ifacename}:${ver}`;
        const impl = new this( options );
        const spec_dirs = Face.spec();

        executor.register( as, ifacever, impl, spec_dirs );

        as.add( ( as ) => {
            const mjr = ver.split( '.' )[0];
            impl._iface_info = executor._ifaces[ifacename][mjr];

            const ccm = executor.ccm();
            ccm.assertIface( '#db.xfer', DB_IFACEVER );
            ccm.assertIface( EVTGEN_ALIAS, EVTGEN_IFACEVER );

            if ( !( ccm.iface( EVTGEN_ALIAS ) instanceof DBGenFace ) ) {
                as.error( 'InternalError', `CCM ${EVTGEN_ALIAS} must be instance of DBGenFace` );
            }
        } );

        return impl;
    }

    /**
     * Check value against type in spec of implemented interface
     *
     * @param {string} type - name of defined type
     * @param {*} val - value to check
     * @returns {boolean} result of check
     */
    _checkType( type, val ) {
        return SpecTools.checkType( this._iface_info, type, val );
    }
}

module.exports = BaseService;
