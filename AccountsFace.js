'use strict';

const BaseFace = require( './BaseFace' );

/**
 * Accounts Face
 */
class AccountsFace extends BaseFace {
    static get IFACE_NAME() {
        return 'futoin.xfer.accounts';
    }
}

module.exports = AccountsFace;
