'use strict';

const BaseFace = require( '../BaseFace' );

/**
 * Currency Information Face
 */
class InfoFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.currency.info';
    }

    // TODO: client-side caching + listening on event stream for updates
}

module.exports = InfoFace;
