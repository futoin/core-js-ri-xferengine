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

const XferTools = require( './XferTools' );
const AmountTools = require( './AmountTools' );

const {
    DB_REFUNDS_TABLE,
    DB_XFERS_TABLE,
    historyTimeBarrier,
} = require( './main' );

/**
 * XferTools with focus on Retail use case
 */
class RetailTools extends XferTools {
    constructor( ccm ) {
        super( ccm, 'Retail' );
    }

    _checkPurchaseForRefund( as, dbxfer, xfer ) {
        if ( xfer.repeat ) {
            return;
        }

        const purchase_id = xfer.misc_data.purchase_id;
        const barrier = historyTimeBarrier();

        if ( barrier.isAfter( xfer.misc_data.purchase_ts ) ) {
            as.error( 'OriginalTooOld' );
        }

        // NOTE: maybe unsafe on currency_id change
        const db = this.db;
        const sum_refunds_q = db
            .select( DB_REFUNDS_TABLE )
            .innerJoin( DB_XFERS_TABLE, 'uuidb64 = refund_id' )
            .get( 'amount', 'COALESCE(SUM(dst_amount), 0)' )
            .where( 'purchase_id', purchase_id );
        db.select( DB_XFERS_TABLE )
            .get( 'amount_left', `src_amount - (${sum_refunds_q})` )
            .get( [ 'src', 'src_currency_id' ] )
            .where( 'uuidb64', purchase_id )
            .executeAssoc( as );

        as.add( ( as, rows ) => {
            if ( !rows.length ) {
                as.error( 'PurchaseNotFound' );
            }

            const { amount_left, src, src_currency_id } = rows[0];

            //---
            if ( ( src !== xfer.dst_account ) ||
                 ( src_currency_id !== xfer.dst_info.currency_id )
            ) {
                as.error( 'OriginalMismatch' );
            }


            //---
            const amount_left_fmt = AmountTools.fromStorage(
                amount_left, xfer.dst_info.dec_places );

            if ( AmountTools.isLess( amount_left_fmt, xfer.dst_amount ) ) {
                as.error( 'AmountTooLarge' );
            }

            //---
            dbxfer.insert( DB_REFUNDS_TABLE, { affected: 1 } )
                .set( {
                    purchase_id,
                    refund_id: xfer.id,
                } );

            // In case something arrives in the middle...
            // This query must include the new xfer.
            dbxfer.select( DB_XFERS_TABLE, { selected: 1 } )
                .where( {
                    uuidb64: purchase_id,
                    'src_amount >=': sum_refunds_q,
                } );
        } );
    }

    _domainDbStep( as, dbxfer, xfer ) {
        if ( xfer.type === 'Refund' ) {
            this._checkPurchaseForRefund( as, dbxfer, xfer );
        }
    }

    _checkAlreadyRefunded( as, dbxfer, xfer ) {
        const db = this.db;
        db.select( DB_REFUNDS_TABLE )
            .where( 'purchase_id', xfer.id )
            .execute( as );

        as.add( ( as, { rows } ) => {
            if ( rows.length > 0 ) {
                as.error( 'AlreadyRefunded' );
            }

            // in case something arrives in the middle
            dbxfer.select( DB_REFUNDS_TABLE, { selected: false } )
                .where( 'purchase_id', xfer.id );
        } );
    }

    _domainDbCancelStep( as, dbxfer, xfer ) {
        if ( xfer.type === 'Purchase' ) {
            this._checkAlreadyRefunded( as, dbxfer, xfer );
        }
    }
}

module.exports = RetailTools;
