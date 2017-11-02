'use strict';

const LimitsFace = require( './LimitsFace' );

/**
 * Efficient cached LimitsFace with event-based cache invalidation
 *
 * Keeps local cache of limits and invalidates based on LIVE events.
 */
class CachedLimitsFace extends LimitsFace {
    // TODO

    /**
     * CCM registration helper
     *
     * @function CachedLimitsFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = CachedLimitsFace;
