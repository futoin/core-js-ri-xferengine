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

    static backRate( rate ) {
        BigNumber.config( RATE_PRECISSION );
        const res = new BigNumber( '1', 10 );
        return res.dividedBy( rate ).toString();
    }

    static convAmount( amt, rate, dec_places, round_up=false ) {
        if ( round_up ) {
            BigNumber.config( dec_places, BigNumber.ROUND_UP );
        } else {
            BigNumber.config( dec_places, BigNumber.ROUND_DOWN );
        }

        const res = new BigNumber( amt, 10 );
        return res.times( rate ).toFixed( dec_places );
    }

    static isAmountField( field ) {
        return LIMIT_FIELD_AMT_RE.test( field );
    }

    static convLimits( limits, rate, dec_places, round_up=false ) {
        const res = Object.assign( {}, limits );

        for ( let [ k, v ] of Object.entries( res ) ) {
            if ( this.isAmountField( k ) ) {
                res[k] = this.convAmount( v, rate, dec_places, round_up );
            }
        }

        return res;
    }

    static prepNewStats( stats, deltas ) {
        const res = Object.assign( {}, deltas );

        for ( let [ field, dv ] of Object.entries( deltas ) ) {
            const sv = stats[ field ];

            if ( sv === undefined ) {
                continue;
            }

            if ( this.isAmountField( field ) ) {
                dv = new BigNumber( dv, 10 );
                res[ field ] = dv.plus( sv ).toString();
            } else {
                res[ field ] += sv;
            }
        }

        return res;
    }

    static checkStatsLimit( stats, limits ) {
        for ( let [ field, sv ] of Object.entries( stats ) ) {
            const lv = limits[field];

            if ( lv === undefined ) {
                continue;
            }

            if ( this.isAmountField( field ) ) {
                sv = new BigNumber( sv, 10 );

                if ( sv.greaterThan( lv ) ) {
                    return false;
                }
            } else if ( sv > lv ) {
                return false;
            }
        }

        return true;
    }

    static checkMinLimit( field, val, limit ) {
        if ( this.isAmountField( field ) ) {
            val = new BigNumber( val, 10 );
            return val.greaterThanOrEqualTo( limit, 10 );
        }

        return ( val >= limit );
    }
}

module.exports = AmountTools;
