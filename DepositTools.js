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

const XferTools = require( './XferTools' );

/**
 * XferTools with focus on Deposits use case
 */
class DepositTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Deposits' );
    }

    _domainDbCancelStep( as, _dbxfer, xfer ) {
        if ( xfer.type === 'Deposit' ) {
            as.error( 'NotAllowed' );
        }
    }

    _rawExtOut( as, xfer ) {
        if ( xfer.type === 'Deposit' ) {
            this._ccm.xferIface( as, 'futoin.xfer.deposit', xfer.dst_account );
            as.add( ( as, iface ) => iface.call( as, 'onDeposit', {
                account : xfer.src_info.ext_acct_id,
                rel_account : xfer.dst_info.ext_acct_id,
                currency : xfer.src_info.currency,
                amount : xfer.src_amount,
                ext_id : xfer.id,
                ext_info :  xfer.misc_data.info || {},
                orig_ts : xfer.created,
            } ) );
        } else {
            super._rawExtOut( as, xfer );
        }
    }

    _rawCancelExtOut( as, xfer ) {
        if ( xfer.type === 'Deposit' ) {
            as.error( 'NotAllowed' );
        } else {
            super._rawCancelExtOut( as, xfer );
        }
    }
}

module.exports = DepositTools;
