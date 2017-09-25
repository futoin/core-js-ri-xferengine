'use strict';

const AccountsFace = require( './AccountsFace' );

/**
 * Efficient cached AccountsFace with event-based cache invalidation
 * 
 * Keeps local cache of limits and invalidates based on LIVE events.
 */
class CachedAccountsFace extends AccountsFace {
    // TODO

    /**
     * CCM registration helper
     * 
     * @function CachedAccountsFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = CachedAccountsFace;
