'use strict';

const _defaults = require( 'lodash/defaults' );
const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const ManageFace = require( './ManageFace' );
const { DB_CURRENCY_TABLE, DB_EXRATE_TABLE } = require( '../main' );

/**
 * Currency Manage Service
 */
class InfoService extends PingService
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
        const ifacever = 'futoin.currency.manage:' + ManageFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ ManageFace.spec(), PingFace.spec( ManageFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );

        return impl;
    }
}

module.exports = InfoService;
