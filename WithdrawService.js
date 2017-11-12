'use strict';

const BaseService = require( './BaseService' );
const WithdrawFace = require( './WithdrawFace' );
//const XferTools = require( './XferTools' );

/**
 * Withdrawals Service
 */
class WithdrawService extends BaseService {
    static get IFACE_IMPL() {
        return WithdrawFace;
    }

    startWithdrawal( as, _reqinfo ) {
    }

    confirmWithdrawal( as, _reqinfo ) {
    }

    cancelWithdrawal( as, _reqinfo ) {
    }

    /**
     * Register futoin.xfers.withdraw interface with Executor
     * @alias WithdrawService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {WithdrawService} instance
     */
}

module.exports = WithdrawService;
