'use strict';

const BaseFace = require( '../BaseFace' );

/**
 * Currency Management Face
 */
class ManageFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.currency.manage';
    }
}

module.exports = ManageFace;
