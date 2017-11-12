'use strict';

const BaseFace = require( './BaseFace' );

/**
 * Witdrawals Face
 */
class WithdrawFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.xfer.withdraw';
    }

    /**
     * CCM registration helper
     *
     * @function WithdrawFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = WithdrawFace;
