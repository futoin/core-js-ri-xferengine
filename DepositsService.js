'use strict';

const BaseService = require( './BaseService' );
const DepositsFace = require( './DepositsFace' );

/**
 * Deposits Service
 */
class DepositsService extends BaseService {
    static get IFACE_IMPL() {
        return DepositsFace;
    }

    /**
     * Register futoin.xfers.limits interface with Executor
     * @alias DepositsService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {DepositsService} instance
     */
}

module.exports = DepositsService;
