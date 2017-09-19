'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const ManageFace = require( './ManageFace' );
const { DB_IFACEVER, DB_CURRENCY_TABLE, DB_EXRATE_TABLE } = require( '../main' );


/**
 * Currency Manage Service
 */
class ManageService extends PingService
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
        const ifacever = 'futoin.currency.manage:' + ManageFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ ManageFace.spec(), PingFace.spec( ManageFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.ccm().assertIface( '#db.xfer', DB_IFACEVER );

        return impl;
    }

    setCurrency( as, reqinfo )
    {
        const p = reqinfo.params();
        p.enabled = p.enabled ? 'Y' : 'N';

        const db = reqinfo.executor().ccm().db( 'xfer' );
        reqinfo.result( true );

        // try insert
        as.add(
            ( as ) =>
            {
                db.insert( DB_CURRENCY_TABLE )
                    .set( p )
                    .set( 'added', db.queryBuilder().helpers().now() )
                    .execute( as );
            },
            ( as, err ) =>
            {
                if ( err === 'Duplicate' )
                {
                    as.success( err );
                }
            }
        );

        /// update on dup
        as.add(
            ( as, res ) =>
            {
                if ( res !== 'Duplicate' )
                {
                    return;
                }

                db.update( DB_CURRENCY_TABLE )
                    .set( {
                        name: p.name,
                        symbol: p.symbol,
                        enabled: p.enabled,
                    } )
                    .where( {
                        code: p.code,
                        dec_places: p.dec_places,
                    } )
                    .execute( as );

                as.add( ( as, res ) =>
                {
                    if ( res.affected !== 1 )
                    {
                        as.error( 'DecPlaceMismatch', `Currency: ${p.code}` );
                    }
                } );
            },
            ( as, err ) =>
            {
                if ( err === 'Duplicate' )
                {
                    as.error( 'DuplicateNameOrSymbol', `Currency: ${p.code}` );
                }
            }
        );
    }

    setExRate( as, reqinfo )
    {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );
        reqinfo.result( true );

        db.select()
            .get( 'base_id',
                db.select( DB_CURRENCY_TABLE )
                    .get( 'id' ).where( 'code', p.base )
            )
            .get( 'foreign_id',
                db.select( DB_CURRENCY_TABLE )
                    .get( 'id' ).where( 'code', p.foreign )
            )
            .executeAssoc( as );

        as.add( ( as, res ) =>
        {
            const pair = res[0];

            if ( !pair.base_id )
            {
                as.error( 'UnknownCurrency', `Currency: ${p.base}` );
            }

            if ( !pair.foreign_id )
            {
                as.error( 'UnknownCurrency', `Currency: ${p.foreign}` );
            }

            const change = {
                rate: p.rate,
                margin: p.margin,
                since: db.queryBuilder().helpers().now(),
            };

            // Try insert
            as.add(
                ( as ) =>
                {
                    db.insert( DB_EXRATE_TABLE )
                        .set( pair )
                        .set( change )
                        .execute( as );
                },
                ( as, err ) =>
                {
                    if ( err === 'Duplicate' )
                    {
                        as.success( err );
                    }
                }
            );
            // Update on dup
            as.add(
                ( as, res ) =>
                {
                    if ( res !== 'Duplicate' )
                    {
                        return;
                    }

                    db.update( DB_EXRATE_TABLE )
                        .set( change )
                        .where( pair )
                        .execute( as );

                    as.add( ( as, res ) =>
                    {
                        if ( res.affected !== 1 )
                        {
                            as.error( 'InternalError', `Failed to set exrate: ${p.code}` );
                        }
                    } );
                }
            );
        } );
    }
}

module.exports = ManageService;
