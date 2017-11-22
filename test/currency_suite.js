'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require( 'futoin-executor/Executor' );
const GenFace = require( 'futoin-eventstream/GenFace' );
const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
const DBGenService = require( 'futoin-eventstream/DBGenService' );

module.exports = function( describe, it, vars ) {
    let as;
    let ccm;
    let executor;

    beforeEach( 'common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    } );

    describe( 'Currency', function() {
        const ManageFace = require( '../Currency/ManageFace' );
        const InfoFace = require( '../Currency/InfoFace' );
        const ManageService = require( '../Currency/ManageService' );
        const InfoService = require( '../Currency/InfoService' );

        beforeEach( 'currency', function() {
            as.add(
                ( as ) => {
                    ManageService.register( as, executor );
                    InfoService.register( as, executor );
                    ManageFace.register( as, ccm, 'currency.manage', executor );
                    InfoFace.register( as, ccm, 'currency.info', executor );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
        } );

        it( 'should manage currencies', function( done ) {
            as.add(
                ( as ) => {
                    const currmng = ccm.iface( 'currency.manage' );
                    currmng.setCurrency( as, 'I:EUR', 2, 'Euro', '€', true );
                    currmng.setCurrency( as, 'I:USD', 2, 'US Dollar', '$', true );
                    currmng.setCurrency( as, 'I:YEN', 0, 'Japan Yen', '¥', true );
                    currmng.setCurrency( as, 'I:YEN', 0, 'Disabled Yen', '-', false );

                    const currinfo = ccm.iface( 'currency.info' );
                    currinfo.listCurrencies( as );
                    as.add( ( as, currencies ) => {
                        expect( currencies ).to.eql( [
                            { code: 'I:EUR', dec_places: 2, name: 'Euro', symbol: '€', enabled: true },
                            { code: 'I:USD', dec_places: 2, name: 'US Dollar', symbol: '$', enabled: true },
                            { code: 'I:YEN', dec_places: 0, name: 'Disabled Yen', symbol: '-', enabled: false },
                        ] );
                    } );

                    currinfo.getCurrency( as, 'I:EUR' );
                    as.add( ( as, currency ) => {
                        expect( currency ).to.eql(
                            { code: 'I:EUR', dec_places: 2, name: 'Euro', symbol: '€', enabled: true }
                        );
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

        it( 'should manage exrates', function( done ) {
            as.add(
                ( as ) => {
                    const currmng = ccm.iface( 'currency.manage' );
                    currmng.setExRate( as, 'I:EUR', 'I:USD', '1.199234', '0.002' );
                    currmng.setExRate( as, 'I:USD', 'I:EUR', '0.987654321', '0.003' );

                    const currinfo = ccm.iface( 'currency.info' );
                    currinfo.getExRate( as, 'I:EUR', 'I:USD' );
                    as.add( ( as, res ) => {
                        expect( res.rate ).to.equal( '1.199234' );
                        expect( res.margin ).to.equal( '0.002' );
                    } );

                    currmng.setExRate( as, 'I:EUR', 'I:USD', '1.1992345', '0.004' );
                    currinfo.getExRate( as, 'I:EUR', 'I:USD' );
                    as.add( ( as, res ) => {
                        expect( res.rate ).to.equal( '1.1992345' );
                        expect( res.margin ).to.equal( '0.004' );
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

        it( 'should auto-generate backrate', function( done ) {
            as.add(
                ( as ) => {
                    const currmng = ccm.iface( 'currency.manage' );
                    currmng.setCurrency( as, 'I:RUB', 2, 'Ruble', 'R', true );
                    currmng.setExRate( as, 'I:EUR', 'I:RUB', '70.00', '2.00' );

                    const currinfo = ccm.iface( 'currency.info' );
                    currinfo.getExRate( as, 'I:EUR', 'I:RUB' );
                    as.add( ( as, res ) => {
                        expect( res.rate ).to.equal( '70' );
                        expect( res.margin ).to.equal( '2' );
                    } );

                    currinfo.getExRate( as, 'I:RUB', 'I:EUR' );
                    as.add( ( as, res ) => {
                        expect( res.rate ).to.equal( '0.014285714286' );
                        expect( res.margin ).to.equal( '0.000408163266' );
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

        it( 'should detect errors', function( done ) {
            as.add(
                ( as ) => {
                    const currmng = ccm.iface( 'currency.manage' );
                    const currinfo = ccm.iface( 'currency.info' );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Missing currency';
                            currinfo.getCurrency( as, 'I:MISS' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Missing exrate pair';
                            currinfo.getExRate( as, 'I:EUR', 'I:YEN' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownPair' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Missing currency for exrate';
                            currinfo.getExRate( as, 'I:EUR', 'I:UNKNOWN' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownPair' ) {
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Dec place mismatch';
                            currmng.setCurrency( as, 'I:EUR', 3, 'Euro', '€', true );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'DecPlaceMismatch' ) {
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Dup name @ insert';
                            currmng.setCurrency( as, 'I:EURA', 2, 'Euro', '€a', true );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Dup symbol @ insert';
                            currmng.setCurrency( as, 'I:EURA', 2, 'Euro2', '€', true );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );


                    //---
                    currmng.setCurrency( as, 'I:EURA', 2, 'EuroB', '€b', true );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Dup name @ update';
                            currmng.setCurrency( as, 'I:EURA', 2, 'Euro', '€a', true );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Dup symbol @ update';
                            currmng.setCurrency( as, 'I:EURA', 2, 'Euro2', '€', true );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Unknown foreign';
                            currmng.setExRate( as, 'I:EUR', 'I:UNKNOWN', '1.199234', '0.002' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Unknown base';
                            currmng.setExRate( as, 'I:UNKNOWN', 'I:USD', '1.199234', '0.002' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'DBGenFace';
                            ccm.unRegister( 'xfer.evtgen' );
                            const tmpexec = new Executor( ccm );
                            GenFace.register( as, ccm, 'xfer.evtgen', executor );
                            ManageService.register( as, tmpexec );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'InternalError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'CCM xfer.evtgen must be instance of DBGenFace'
                                );
                                as.success();
                            }
                        }
                    );
                },
                ( as, err ) => {
                    console.log( `Test name: ${as.state.test_name}` );
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
