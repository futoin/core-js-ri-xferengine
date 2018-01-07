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

const UUIDToolBase = require( 'futoin-uuid' );
const { DB_UUID_HISTORY_TABLE } = require( './main' );

/**
 * Extended UUIDTool with focus on collision safety in whole history
 * of particular instance.
 */
class UUIDTool extends UUIDToolBase {
    /**
     * Call on xfer to ensure whole history uniqueness (just in case)
     *
     * @param {XferBuilder} xfer - xfer builder object
     * @param {string} val - UUID in Base64 format without padding
     */
    static addXfer( xfer, val ) {
        xfer.insert( DB_UUID_HISTORY_TABLE, { affected: 1 } )
            .set( 'uuidb64', val );
    }

    /**
     * Generate UUID v4 in scope of transaction
     *
     * @param {XferBuilder} xfer - xfer builder object
     * @returns {string} UUID encoded in Base64 without padding
     */
    static genXfer( xfer ) {
        const val = this.genB64();
        this.addXfer( xfer, val );
        return val;
    }
}

module.exports = UUIDTool;
