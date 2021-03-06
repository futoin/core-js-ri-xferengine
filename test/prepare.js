'use strict';

if ( typeof window === 'undefined' ) {
    module.require( 'tough-cookie' );
    module.require( 'borc' );
    module.require( 'msgpack-lite' );
    module.require( 'moment' );
    module.require( 'bignumber.js' );
}

Object.freeze( Object.prototype );
