'use strict';

const LimitsFace = require( './LimitsFace' );

/**
 * Efficient cached LimitsFace with event-based cache invalidation
 * 
 * Keeps local cache of limits and invalidates based on LIVE events.
 */
class CachedLimitsFace extends LimitsFace {
    // TODO
}

module.exports = CachedLimitsFace;
