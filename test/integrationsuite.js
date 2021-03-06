'use strict';

const util = require( 'util' );
const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const LegacySecurityProvider = require( 'futoin-executor/LegacySecurityProvider' );
const Executor = require( 'futoin-executor/Executor' );

module.exports = function( describe, it, vars ) {
    let as;
    let ccm;
    let secprov;
    let executor;

    beforeEach( 'common', function() {
        ccm = vars.ccm;
        as = vars.as;
        secprov = vars.secprov = new LegacySecurityProvider( as, ccm );
        executor = vars.executor = new Executor( ccm, { securityProvider : secprov } );

        executor.on( 'notExpected', function() {
            console.dir( arguments );

            /*if ( arguments[3] ) {
                for ( var f of arguments[3] ) {
                    console.log( '================================' );
                    console.log( f.toString() );
                }
            }*/
        } );

        as.add(
            ( as ) => {
                ccm.alias( '#db.xfer', '#db.evt' );
                ccm.registerEventServices( as, executor );
            },
            ( as, err ) => {
                console.log( err );
                console.log( as.state.error_info );
                console.log( as.state.last_exception );
            }
        );
    } );

    require( './currency_suite' )( describe, it, vars );
    require( './limits_suite' )( describe, it, vars );
    require( './accounts_suite' )( describe, it, vars );
    require( './message_suite' )( describe, it, vars );
    require( './xfertools_suite' )( describe, it, vars );
    require( './deposits_suite' )( describe, it, vars );
    require( './payments_suite' )( describe, it, vars );
    require( './gaming_suite' )( describe, it, vars );
    require( './retail_suite' )( describe, it, vars );
    require( './generic_suite' )( describe, it, vars );
    require( './peerxfer_suite' )( describe, it, vars );
    require( './install_suite' )( describe, it, vars );
};
