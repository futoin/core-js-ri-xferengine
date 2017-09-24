'use strict';

const BigNumber = require( 'bignumber.js' );

const MAX_DIGITS = 22;
const RATE_PRECISSION = 12;
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
    1000000000,
    10000000000,
    100000000000,
    1000000000000,
];
const LIMIT_FIELD_AMT_RE = /_amt$/;

class AmountTools {
    static get MAX_DIGITS() {
        return MAX_DIGITS;
    }

    static get RATE_PRECISSION() {
        return RATE_PRECISSION;
    }

    static trimZeros( amt ) {
        return amt.replace( /(\.([0-9]*[1-9])?)0+$/, '$1' );
    }

    static fromStorage( amt, places ) {
        BigNumber.config( places );
        const res = new BigNumber( amt, 10 );
        return res.dividedBy( PLACES_TO_DIV[places] ).toFixed( places );
    }

    static toStorage( amt, places ) {
        const res = new BigNumber( amt, 10 );
        return res.times( PLACES_TO_DIV[places] ).toFixed( 0 );
    }

    static sellRate( rate, margin ) {
        const res = new BigNumber( rate, 10 );
        return res.minus( margin ).toString();
    }

    static buyRate( rate, margin ) {
        const res = new BigNumber( rate, 10 );
        return res.plus( margin ).toString();
    }

    static convAmount( amt, rate, dec_places ) {
        const res = new BigNumber( amt, 10 );
        return res.times( rate ).toFixed( dec_places );
    }

    static convLimits( limits, rate, dec_places ) {
        const res = Object.assign( {}, limits );

        for ( let [ k, v ] of Object.entries( res ) ) {
            if ( LIMIT_FIELD_AMT_RE.test( k ) ) {
                res[k] = this.convAmount( v, rate, dec_places );
            }
        }

        return res;
    }

    static backRate( rate ) {
        BigNumber.config( RATE_PRECISSION );
        const res = new BigNumber( '1', 10 );
        return res.dividedBy( rate ).toString();
    }
}

module.exports = AmountTools;
