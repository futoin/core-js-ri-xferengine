'use strict';

const InfoFace = require( './InfoFace' );

/**
 * An efficient version of Currency/InfoFace.
 * 
 * Keeps local cache of currencies and exchange rates.
 * Listens on related event stream for changes as LIVE component.
 */
class CacheInfoFace extends InfoFace {
    // TODO
}

module.exports = CacheInfoFace;
