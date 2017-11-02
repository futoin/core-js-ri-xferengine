'use strict';

const BaseService = require( '../BaseService' );
const InfoFace = require( './InfoFace' );
const AmountTools = require( '../AmountTools' );
const { DB_CURRENCY_TABLE, DB_EXRATE_TABLE } = require( '../main' );

const SYM_LIST = Symbol( 'listCurrencies' );
const SYM_GET = Symbol( 'getCurrency' );
const SYM_GETRATE = Symbol( 'getExRate' );

/**
 * Currency Manage Service
 * @alias CurrencyInfoService
 */
class InfoService extends BaseService {
    static get IFACE_IMPL() {
        return InfoFace;
    }

    listCurrencies( as, reqinfo ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        const pq = db.getPrepared( SYM_LIST, () =>
            db.select( DB_CURRENCY_TABLE )
                .get( [ 'code', 'dec_places', 'name', 'symbol', 'enabled' ] )
                .prepare()
        );
        pq.executeAssoc( as );

        as.add( ( as, res ) => {
            res.forEach( ( v ) => {
                v.dec_places = parseInt( v.dec_places );
                v.enabled = v.enabled === 'Y';
            } );
            reqinfo.result( res );
        } );
    }

    getCurrency( as, reqinfo ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        const pq = db.getPrepared( SYM_GET, () => {
            const qb = db.select( DB_CURRENCY_TABLE )
                .get( [ 'code', 'dec_places', 'name', 'symbol', 'enabled' ] );
            qb.where( 'code', qb.param( 'code' ) );
            return qb.prepare();
        } );
        pq.executeAssoc( as, { code: reqinfo.params().code } );

        as.add( ( as, res ) => {
            if ( res.length !== 1 ) {
                as.error( 'UnknownCurrency' );
            }

            const row = res[0];
            row.dec_places = parseInt( row.dec_places );
            row.enabled = ( row.enabled === 'Y' );
            reqinfo.result( row );
        } );
    }

    getExRate( as, reqinfo ) {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );

        const prepq = db.getPrepared( SYM_GETRATE, ( db ) => {
            const qb = db.select( DB_EXRATE_TABLE );
            qb.get( [ 'rate', 'margin' ] )
                .where( 'base_id',
                    db.select( DB_CURRENCY_TABLE ).get( 'id' )
                        .where( 'code', qb.param( 'base' ) )
                        .where( 'enabled', 'Y' )
                )
                .where( 'foreign_id',
                    db.select( DB_CURRENCY_TABLE ).get( 'id' )
                        .where( 'code', qb.param( 'foreign' ) )
                        .where( 'enabled', 'Y' )
                );
            return qb.prepare();
        } );

        prepq.executeAssoc( as, p );

        as.add( ( as, res ) => {
            if ( res.length ) {
                res = res[0];
                reqinfo.result( {
                    rate: AmountTools.trimZeros( res.rate ),
                    margin: AmountTools.trimZeros( res.margin ),
                } );
            } else {
                prepq.executeAssoc( as, {
                    base: p.foreign,
                    foreign: p.base,
                } );

                as.add( ( as, res ) => {
                    if ( res.length ) {
                        res = res[0];
                        const rate = AmountTools.backRate( res.rate );
                        const margin = AmountTools.backMargin( res.margin, res.rate );

                        reqinfo.result( { rate, margin } );
                    } else {
                        as.error( 'UnknownPair', `${p.base} & ${p.foreign}` );
                    }
                } );
            }
        } );
    }

    /**
     * Register futoin.currency.manage interface with Executor
     *
     * @function CurrencyInfoService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {ManageService} instance
     */
}

module.exports = InfoService;
