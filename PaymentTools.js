'use strict';

const XferTools = require( './XferTools' );

/**
 * XferTools with focus on Payments use case
 */
class PaymentTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Payments' );
    }
}

module.exports = PaymentTools;
