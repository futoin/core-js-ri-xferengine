'use strict';

const uuidv4 = require( 'uuid/v4' );
const { DB_UUID_HISTORY_TABLE } = require( './main' );

/**
 * Common tool for UUID generation and use in transactions
 */
class UUIDTool {
    /**
     * Generate UUID v4
     * 
     * @returns {Buffer} buffer of 16 items
     */
    static genBin() {
        const bin_uuid = Buffer.alloc( 16 );
        return uuidv4( null, bin_uuid, 0 );
    }

    /**
     * Generate UUID v4 encoded in Base64 without padding
     * 
     * @returns {string} 22 characters
     */
    static genB64() {
        return this.genBin().toString( 'base64' ).substr( 0, 22 );
    }

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
