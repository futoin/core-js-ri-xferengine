'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require( 'futoin-executor/Executor' );

module.exports = function( describe, it, vars ) {
    let as;
    let ccm;
    let executor;

    beforeEach( 'common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    } );

    describe( 'Install', function() {
        const install = require( '../install/currencies' );

        beforeEach( 'currency', function() {
            as.add(
                ( as ) => {
                    ccm.registerCurrencyServices( as, executor );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
        } );

        it( 'should install ISO currencies', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    install.ISO( as, ccm );

                    const currinfo = ccm.iface( 'currency.info' );
                    currinfo.listCurrencies( as );
                    as.add( ( as, currencies ) => {
                        expect( currencies.length ).to.be.above( 100 );
                    } );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should install Crypto currencies', function( done ) {
            this.timeout( 30e3 );
            as.add(
                ( as ) => {
                    install.Crypto( as, ccm );

                    const currinfo = ccm.iface( 'currency.info' );
                    currinfo.listCurrencies( as );
                    as.add( ( as, currencies ) => {
                        expect( currencies.length ).to.equal( 1000 );
                    } );

                    currinfo.listCurrencies( as, 1e5 );
                    as.add( ( as, currencies ) => {
                        expect( currencies.length ).to.equal( 0 );
                    } );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );
    } );
};
