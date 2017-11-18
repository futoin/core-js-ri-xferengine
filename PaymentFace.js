'use strict';

const BaseFace = require( './BaseFace' );

/**
 * Payments Face
 */
class PaymentFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.xfer.direct';
    }

    /**
     * CCM registration helper
     *
     * @function PaymentFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = PaymentFace;
