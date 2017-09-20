'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const LimitsFace = require( './LimitsFace' );
const { DB_IFACEVER, DB_LIMIT_GROUPS_TABLE, DB_DOMAIN_LIMITS_TABLE } = require( '../main' );

/**
 * Limits Service
 */
class LimitsService extends PingService
{
    /**
     * Register futoin.currency.manage interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {ManageService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.xfer.limits:' + LimitsFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ LimitsFace.spec(), PingFace.spec( LimitsFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.ccm().assertIface( '#db.xfer', DB_IFACEVER );

        return impl;
    }

    todo()
    {
        void DB_LIMIT_GROUPS_TABLE;
        void DB_DOMAIN_LIMITS_TABLE;
    }
}

module.exports = LimitsService;
