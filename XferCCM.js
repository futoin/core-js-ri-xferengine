'use strict';

const AdvancedCCM = require( 'futoin-invoker/AdvancedCCM' );
const moment = require( 'moment' );

/**
 * Special CCM implementation for XferCore
 */
class XferCCM extends AdvancedCCM {
    xferIface( as, iface, account ) {
        //---
        const manual = `#manual_${iface}_${account}`;

        try {
            const iface = this.iface( manual );
            as.success( iface );
            return;
        } catch ( _ ) {
            // pass
        }

        //---
        this._cleanup();

        const alias = `#auto_${iface}_${account}`;

        try {
            const iface = this.iface( alias );
            iface._xfer_last_used = moment.utc();
            as.success( iface );
            return;
        } catch ( _ ) {
            // pass
        }

        // TODO: get peer API config & register dynamically
        as.error( 'NotImplemented', 'Dynamic API endpoint configuration' );
    }

    _cleanup() {
    }
}

module.exports = XferCCM;
