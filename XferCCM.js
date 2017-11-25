'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
