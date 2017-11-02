'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
const { DB_IFACEVER, EVTGEN_IFACEVER } = require( './main' );

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
        const spec_dirs = [ Face.spec(), PingFace.spec( Face.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );

        as.add( ( as ) => {
            const mjr = ver.split( '.' )[0];
            impl._iface_info = executor._ifaces[ifacename][mjr];

            const ccm = executor.ccm();
            ccm.assertIface( '#db.xfer', DB_IFACEVER );
            ccm.assertIface( 'xfer.evtgen', EVTGEN_IFACEVER );

            if ( !( ccm.iface( 'xfer.evtgen' ) instanceof DBGenFace ) ) {
                as.error( 'InternalError', 'CCM xfet.evtgen must be instance of DBGenFace' );
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
