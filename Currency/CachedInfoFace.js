'use strict';

const InfoFace = require( './InfoFace' );

/**
 * An efficient version of Currency/InfoFace.
 * 
 * Keeps local cache of currencies and exchange rates.
 * Listens on related event stream for changes as LIVE component.
 * 
 * @alias CurrencyCacheInfoFace
 */
class CacheInfoFace extends InfoFace {
    // TODO
    
    
    /**
     * CCM registration helper
     * 
     * @function CurrencyCacheInfoFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = CacheInfoFace;
