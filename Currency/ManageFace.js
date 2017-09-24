'use strict';

const BaseFace = require( '../BaseFace' );

/**
 * Currency Management Face
 * @alias CurrencyManageFace
 */
class ManageFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.currency.manage';
    }

    /**
     * CCM registration helper
     * 
     * @function CurrencyManageFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = ManageFace;
