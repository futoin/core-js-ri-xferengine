'use strict';

const BigNumber = require( 'bignumber.js' );

const MAX_DIGITS = 22;
//const ZERO_AMT = '0'.repeat(MAX_DIGITS);
const PLACES_TO_DIV = [
    1,
    10,
    100,
    1000,
    10000,
    100000,
    1000000,
    10000000,
    100000000,
];

class AmountTools {
    static get MAX_DIGITS() {
        return MAX_DIGITS;
    }

    static trimZeros( amt ) {
        return amt.replace( /0+$/, '' );
    }

    static fromStorage( amt, places ) {
        const res = new BigNumber( amt, 10 );
        return res.dividedBy( PLACES_TO_DIV[places] ).toFixed( places );
    }

    static toStorage( amt, places ) {
        const res = new BigNumber( amt, 10 );
        return res.times( PLACES_TO_DIV[places] ).toFixed( 0 );
    }
}

module.exports = AmountTools;
