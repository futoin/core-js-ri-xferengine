'use strict';

const BaseFace = require( './BaseFace' );

/**
 * Peer Face
 */
class PeerFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.xfer.peer';
    }

    /**
     * CCM registration helper
     *
     * @function PeerFace.register
     * @param {AsyncSteps} as - steps interface
     * @param {AdvancedCCM} ccm - CCM instance
     * @param {string} name - CCM registration name
     * @param {*} endpoint - see AdvancedCCM#register
     * @param {*} [credentials=null] - see AdvancedCCM#register
     * @param {object} [options={}] - interface options
     * @param {string} [options.version=<latest>] - interface version to use
     */
}

module.exports = PeerFace;
