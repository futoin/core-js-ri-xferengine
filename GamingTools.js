'use strict';

const XferTools = require( './XferTools' );

/**
 * XferTools with focus on Gaming use case
 */
class GamingTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Gaming' );
    }

    findAccount( as, _user_ext_id, _currency ) {
        as.error( 'UnknownHolderID' );
        as.error( 'CurrencyMismatch' );
    }
}

module.exports = GamingTools;
