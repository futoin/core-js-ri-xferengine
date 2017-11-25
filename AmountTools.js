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

const BigNumber = require( 'bignumber.js' );
const { ROUND_UP, ROUND_DOWN, ROUND_HALF_UP } = BigNumber;

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

class AmountTools {
    static get MAX_DIGITS() {
        return MAX_DIGITS;
    }

    static get RATE_PRECISSION() {
        return RATE_PRECISSION;
    }

    static trimZeros( amt ) {
        return amt.replace( /(((\.[0-9]*[1-9])0+)|(\.0*))$/, '$3' );
    }

    static place2div( places ) {
        return PLACES_TO_DIV[places];
    }

    static fromStorage( amt, places ) {
        BigNumber.config( places, ROUND_DOWN );
        const res = new BigNumber( amt, 10 );
        return res.dividedBy( this.place2div( places ) ).toFixed( places );
    }

    static toStorage( amt, places ) {
        BigNumber.config( places, ROUND_DOWN );
        const res = new BigNumber( amt, 10 );
        return res.times( this.place2div( places ) ).toFixed( 0 );
    }

    static accountFromStorage( account ) {
        const dec_places = account.dec_places;
        account.balance = AmountTools.fromStorage( account.balance, dec_places );
        account.reserved = AmountTools.fromStorage( account.reserved, dec_places );
        account.overdraft = AmountTools.fromStorage( account.overdraft, dec_places );
        account.available_balance = AmountTools.availableBalance( account, dec_places );
    }

    static sellRate( rate, margin ) {
        BigNumber.config( RATE_PRECISSION, ROUND_HALF_UP );
        const res = new BigNumber( rate, 10 );
        return res.minus( margin, 10 ).toString();
    }

    static buyRate( rate, margin ) {
        BigNumber.config( RATE_PRECISSION, ROUND_HALF_UP );
        const res = new BigNumber( rate, 10 );
        return res.plus( margin, 10 ).toString();
    }

    static backRate( rate ) {
        BigNumber.config( RATE_PRECISSION, ROUND_HALF_UP );
        const res = new BigNumber( '1', 10 );
        return res.dividedBy( rate, 10 ).toString();
    }

    static backMargin( margin, rate ) {
        BigNumber.config( RATE_PRECISSION, ROUND_UP );
        const res = new BigNumber( margin, 10 );
        const rn = new BigNumber( rate, 10 );
        return res.dividedBy( rn ).dividedBy( rn ).toString();
    }

    static convAmount( amt, rate, dec_places, round_up=false ) {
        if ( round_up ) {
            BigNumber.config( RATE_PRECISSION, ROUND_UP );
        } else {
            BigNumber.config( RATE_PRECISSION, ROUND_DOWN );
        }

        const res = new BigNumber( amt, 10 );
        return res.times( rate, 10 ).toFixed( dec_places );
    }

    static add( a, b, dec_places ) {
        BigNumber.config( dec_places );
        const res = new BigNumber( a, 10 );
        return res.plus( b, 10 ).toFixed( dec_places );
    }

    static subtract( a, b, dec_places ) {
        BigNumber.config( dec_places );
        const res = new BigNumber( a, 10 );
        return res.minus( b, 10 ).toFixed( dec_places );
    }

    static isAmountField( field ) {
        return field.endsWith( '_amt' );
    }

    static convAllAmounts( amounts, rate, dec_places, round_up=false ) {
        const res = Object.assign( {}, amounts );

        for ( let k in res ) {
            if ( this.isAmountField( k ) ) {
                res[k] = this.convAmount( res[k], rate, dec_places, round_up );
            }
        }

        return res;
    }

    static prepNewStats( stats, deltas ) {
        const res = Object.assign( {}, deltas );

        for ( let field in deltas ) {
            let dv = deltas[ field ];
            const sv = stats[ field ];

            if ( sv === undefined ) {
                continue;
            }

            if ( this.isAmountField( field ) ) {
                dv = new BigNumber( dv, 10 );
                res[ field ] = dv.plus( sv, 10 ).toString();
            } else {
                res[ field ] += sv;
            }
        }

        return res;
    }

    static checkStatsLimit( stats, limits ) {
        for ( let field in stats ) {
            let sv = stats[field];
            const lv = limits[field];

            if ( lv === undefined ) {
                continue;
            }

            if ( this.isAmountField( field ) ) {
                sv = new BigNumber( sv, 10 );

                if ( field.endsWith( '_min_amt' ) ) {
                    if ( sv.lessThan( lv, 10 ) ) {
                        return false;
                    }
                } else if ( sv.greaterThan( lv, 10 ) ) {
                    return false;
                }
            } else if ( sv > lv ) {
                return false;
            }
        }

        return true;
    }

    static checkXferAmount( amt, { balance, reserved, overdraft } ) {
        amt = new BigNumber( amt, 10 );

        if ( amt.lessThanOrEqualTo( 0 ) ) {
            return false;
        }

        balance = new BigNumber( balance, 10 );
        balance = balance.plus( overdraft, 10 ).minus( reserved, 10 );

        return balance.greaterThanOrEqualTo( amt );
    }

    static availableBalance( { balance, reserved, overdraft }, dec_places ) {
        return AmountTools.subtract(
            AmountTools.add( balance, overdraft, dec_places ),
            reserved,
            dec_places
        );
    }

    static compare( a, b ) {
        a = new BigNumber( a, 10 );
        return a.cmp( b, 10 );
    }

    static isEqual( a, b ) {
        return this.compare( a, b ) === 0;
    }

    static isZero( a ) {
        return this.isEqual( a, '0' );
    }
}

module.exports = AmountTools;
