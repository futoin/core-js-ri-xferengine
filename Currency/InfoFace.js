'use strict';

const BaseFace = require( '../BaseFace' );

/**
 * Currency Information Face
 * @alias CurrencyInfoFace
 */
class InfoFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.currency.info';
    }

    // TODO: client-side caching + listening on event stream for updates
    
    /**
     * CCM registration helper
     * 
     * @function CurrencyInfoFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = InfoFace;
