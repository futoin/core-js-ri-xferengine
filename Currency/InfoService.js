'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const InfoFace = require( './InfoFace' );
const { DB_IFACEVER, DB_CURRENCY_TABLE, DB_EXRATE_TABLE } = require( '../main' );

/**
 * Currency Manage Service
 */
class InfoService extends PingService
{
    /**
     * Register futoin.currency.manage interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {ManageService} instance
     */
    static register( as, executor, options={} )
    {
        const ifacever = 'futoin.currency.info:' + InfoFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ InfoFace.spec(), PingFace.spec( InfoFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.ccm().assertIface( '#db.xfer', DB_IFACEVER );

        return impl;
    }

    listCurrencies( as, reqinfo )
    {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db.select( DB_CURRENCY_TABLE )
            .get( [ 'code', 'dec_places', 'name', 'symbol', 'enabled' ] )
            .executeAssoc( as );

        as.add( ( as, res ) =>
        {
            res.forEach( ( v ) =>
            {
                v.dec_places = parseInt( v.dec_places );
                v.enabled = v.enabled === 'Y';
            } );
            reqinfo.result( res );
        } );
    }

    getExRate( as, reqinfo )
    {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db.select( DB_EXRATE_TABLE )
            .get( [ 'rate', 'margin' ] )
            .where( 'base_id',
                db.select(DB_CURRENCY_TABLE).get( 'id' )
                    .where( 'code', p.base ).where( 'enabled', 'Y' )
            )
            .where( 'foreign_id',
                db.select(DB_CURRENCY_TABLE).get( 'id' )
                    .where( 'code', p.foreign ).where( 'enabled', 'Y' )
            )
            .executeAssoc( as );

        as.add( ( as, res ) =>
        {
            if ( res.length )
            {
                res = res[0];
                reqinfo.result( {
                    rate: res.rate.replace(/0+$/, ''),
                    margin: res.margin.replace(/0+$/, ''),
                } );
            }
            else
            {
                as.error( 'UnknownPair', `${p.base} & ${p.foreign}` );
            }
        } );
    }
}

module.exports = InfoService;
