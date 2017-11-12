'use strict';

const XferTools = require( './XferTools' );

/**
 * XferTools with focus on Deposits use case
 */
class DepositTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Deposits' );
    }
}

module.exports = DepositTools;
