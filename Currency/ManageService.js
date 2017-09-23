'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
const ManageFace = require( './ManageFace' );
const { DB_IFACEVER, DB_CURRENCY_TABLE, DB_EXRATE_TABLE, EVTGEN_IFACEVER } = require( '../main' );


/**
 * Currency Manage Service
 */
class ManageService extends PingService {
    /**
     * Register futoin.currency.manage interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {ManageService} instance
     */
    static register( as, executor, options={} ) {
        const ifacever = 'futoin.currency.manage:' + ManageFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ ManageFace.spec(), PingFace.spec( ManageFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );

        const ccm = executor.ccm();
        ccm.assertIface( '#db.xfer', DB_IFACEVER );
        ccm.assertIface( 'xfer.evtgen', EVTGEN_IFACEVER );

        if ( !( ccm.iface( 'xfer.evtgen' ) instanceof DBGenFace ) ) {
            as.error( 'InternalError', 'CCM xfet.evtgen must be instance of DBGenFace' );
        }

        return impl;
    }

    setCurrency( as, reqinfo ) {
        const p = reqinfo.params();
        p.enabled = p.enabled ? 'Y' : 'N';

        const ccm = reqinfo.executor().ccm();
        const db = ccm.db( 'xfer' );
        const evtgen = ccm.iface( 'xfer.evtgen' );
        reqinfo.result( true );

        // try insert
        as.add(
            ( as ) => {
                const xfer = db.newXfer();
                xfer.select( DB_CURRENCY_TABLE, { selected: 0 } )
                    .get( 'id' )
                    .where( 'code', p.code );
                xfer.insert( DB_CURRENCY_TABLE )
                    .set( p )
                    .set( 'added', xfer.helpers().now() );
                evtgen.addXferEvent( xfer, 'CURRENCY_NEW', p );
                xfer.execute( as );
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    as.error( 'DuplicateNameOrSymbol', `Currency: ${p.code}` );
                }

                if ( err === 'XferCondition' ) {
                    as.success( 'UPDATE' );
                }
            }
        );

        /// update on dup
        as.add(
            ( as, res ) => {
                if ( res !== 'UPDATE' ) {
                    return;
                }

                const xfer = db.newXfer();
                xfer.update( DB_CURRENCY_TABLE, { affected: 1 } )
                    .set( {
                        name: p.name,
                        symbol: p.symbol,
                        enabled: p.enabled,
                    } )
                    .where( {
                        code: p.code,
                        dec_places: p.dec_places,
                    } );
                evtgen.addXferEvent( xfer, 'CURRENCY', p );
                xfer.execute( as );

                as.add( ( as ) => {} );
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    as.error( 'DuplicateNameOrSymbol', `Currency: ${p.code}` );
                }

                if ( err === 'XferCondition' ) {
                    as.error( 'DecPlaceMismatch', `Currency: ${p.code}` );
                }
            }
        );
    }

    setExRate( as, reqinfo ) {
        const p = reqinfo.params();
        const ccm = reqinfo.executor().ccm();
        const db = ccm.db( 'xfer' );
        const evtgen = ccm.iface( 'xfer.evtgen' );
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

        as.add( ( as, res ) => {
            const pair = res[0];

            if ( !pair.base_id ) {
                as.error( 'UnknownCurrency', `Currency: ${p.base}` );
            }

            if ( !pair.foreign_id ) {
                as.error( 'UnknownCurrency', `Currency: ${p.foreign}` );
            }

            const change = {
                rate: p.rate,
                margin: p.margin,
                since: db.helpers().now(),
            };

            // Try insert
            as.add(
                ( as ) => {
                    const xfer = db.newXfer();
                    xfer.insert( DB_EXRATE_TABLE )
                        .set( pair )
                        .set( change );
                    evtgen.addXferEvent( xfer, 'EXRATE_NEW', p );
                    xfer.execute( as );
                },
                ( as, err ) => {
                    if ( err === 'Duplicate' ) {
                        as.success( err );
                    }
                }
            );
            // Update on dup
            as.add(
                ( as, res ) => {
                    if ( res !== 'Duplicate' ) {
                        return;
                    }

                    const xfer = db.newXfer();
                    xfer.update( DB_EXRATE_TABLE, { affected: 1 } )
                        .set( change )
                        .where( pair );
                    evtgen.addXferEvent( xfer, 'EXRATE', p );
                    xfer.execute( as );

                    as.add( ( as ) => {} );
                }
            );
        } );
    }
}

module.exports = ManageService;
