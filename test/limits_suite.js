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

    describe( 'Limits', function() {
        const LimitsFace = require( '../LimitsFace' );
        const LimitsService = require( '../LimitsService' );

        beforeEach( 'currency', function() {
            as.add(
                ( as ) => {
                    ccm.registerCurrencyServices( as, executor );

                    LimitsService.register( as, executor );
                    LimitsFace.register( as, ccm, 'xfer.limits', executor );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
        } );

        it ( 'should add groups', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );

                    //--
                    xferlim.getLimitGroups( as );

                    as.add( ( as, res ) => {
                        expect( res ).to.eql( [] );
                    } );

                    //--
                    xferlim.addLimitGroup( as, 'default' );
                    xferlim.addLimitGroup( as, 'other' );
                    xferlim.addLimitGroup( as, 'aaa' );
                    xferlim.getLimitGroups( as );

                    as.add( ( as, res ) => {
                        expect( res ).to.eql( [ 'default', 'other', 'aaa' ] );
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

        it ( 'should detect add group errors', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.addLimitGroup( as, 'Duplicate123_-' );
                            xferlim.addLimitGroup( as, 'Duplicate123_-' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'AlreadyExists' ) {
                                as.success();
                            }
                        }
                    );
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

        it ( 'should set limits', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );

                    xferlim.setLimits( as, 'default', 'Retail', 'I:EUR', {
                        retail_daily_amt : "1.00",
                        retail_daily_cnt : 1,
                        retail_weekly_amt : "1.00",
                        retail_weekly_cnt : 1,
                        retail_monthly_amt : "1.00",
                        retail_monthly_cnt : 1,
                        retail_min_amt : "1.00",
                        preauth_daily_amt : "1.00",
                        preauth_daily_cnt : 1,
                        preauth_weekly_amt : "1.00",
                        preauth_weekly_cnt : 1,
                        preauth_monthly_amt : "1.00",
                        preauth_monthly_cnt : 1,
                        preauth_min_amt : "1.00",
                    }, false, false );

                    xferlim.setLimits( as, 'default', 'Deposits', 'I:USD', {
                        deposit_daily_amt : "1.00",
                        deposit_daily_cnt : 1,
                        withdrawal_daily_amt : "1.00",
                        withdrawal_daily_cnt : 1,
                        deposit_weekly_amt : "1.00",
                        deposit_weekly_cnt : 1,
                        withdrawal_weekly_amt : "1.00",
                        withdrawal_weekly_cnt : 1,
                        deposit_monthly_amt : "1.00",
                        deposit_monthly_cnt : 1,
                        withdrawal_monthly_amt : "1.00",
                        withdrawal_monthly_cnt : 1,
                        deposit_min_amt : "1.00",
                        withdrawal_min_amt : "1.00",

                    }, {
                        deposit_daily_amt : "2.00",
                        deposit_daily_cnt : 2,
                        withdrawal_daily_amt : "2.00",
                        withdrawal_daily_cnt : 2,
                        deposit_weekly_amt : "2.00",
                        deposit_weekly_cnt : 2,
                        withdrawal_weekly_amt : "2.00",
                        withdrawal_weekly_cnt : 2,
                        deposit_monthly_amt : "2.00",
                        deposit_monthly_cnt : 2,
                        withdrawal_monthly_amt : "2.00",
                        withdrawal_monthly_cnt : 2,
                        deposit_min_amt : "2.00",
                        withdrawal_min_amt : "2.00",

                    }, false );

                    xferlim.setLimits( as, 'default', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "1.00",
                        outbound_daily_cnt : 1,
                        inbound_daily_amt : "1.00",
                        inbound_daily_cnt : 1,
                        outbound_weekly_amt : "1.00",
                        outbound_weekly_cnt : 1,
                        inbound_weekly_amt : "1.00",
                        inbound_weekly_cnt : 1,
                        outbound_monthly_amt : "1.00",
                        outbound_monthly_cnt : 1,
                        inbound_monthly_amt : "1.00",
                        inbound_monthly_cnt : 1,
                        outbound_min_amt : "1.00",
                    }, false, false );
                    xferlim.setLimits( as, 'default', 'Gaming', 'I:EUR', {
                        bet_daily_amt : "1.00",
                        bet_daily_cnt : 1,
                        win_daily_amt : "1.00",
                        win_daily_cnt : 1,
                        profit_daily_amt : "1.00",
                        bet_weekly_amt : "1.00",
                        bet_weekly_cnt : 1,
                        win_weekly_amt : "1.00",
                        win_weekly_cnt : 1,
                        profit_weekly_amt : "1.00",
                        bet_monthly_amt : "1.00",
                        bet_monthly_cnt : 1,
                        win_monthly_amt : "1.00",
                        win_monthly_cnt : 1,
                        profit_monthly_amt : "1.00",
                        bet_min_amt : "1.00",
                    }, false, false );
                    xferlim.setLimits( as, 'default', 'Misc', 'I:EUR', {
                        message_daily_cnt : 1,
                        failure_daily_cnt : 1,
                        limithit_daily_cnt : 1,
                        message_weekly_cnt : 1,
                        failure_weekly_cnt : 1,
                        limithit_weekly_cnt : 1,
                        message_monthly_cnt : 1,
                        failure_monthly_cnt : 1,
                        limithit_monthly_cnt : 1,
                    }, false, false );
                    xferlim.setLimits( as, 'default', 'Personnel', 'I:EUR', {
                        message_daily_cnt : 1,
                        manual_daily_amt : "1.00",
                        manual_daily_cnt : 1,
                        message_weekly_cnt : 1,
                        manual_weekly_amt : "1.00",
                        manual_weekly_cnt : 1,
                        message_monthly_cnt : 1,
                        manual_monthly_amt : "1.00",
                        manual_monthly_cnt : 1,
                    }, false, {
                        message_daily_cnt : 3,
                        manual_daily_amt : "3.00",
                        manual_daily_cnt : 3,
                        message_weekly_cnt : 3,
                        manual_weekly_amt : "3.00",
                        manual_weekly_cnt : 3,
                        message_monthly_cnt : 3,
                        manual_monthly_amt : "3.00",
                        manual_monthly_cnt : 3,
                    } );

                    //----------


                    xferlim.getLimits( as, 'default', 'Retail' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:EUR',
                        hard: {
                            retail_daily_amt : "1.00",
                            retail_daily_cnt : 1,
                            retail_weekly_amt : "1.00",
                            retail_weekly_cnt : 1,
                            retail_monthly_amt : "1.00",
                            retail_monthly_cnt : 1,
                            retail_min_amt : "1.00",
                            preauth_daily_amt : "1.00",
                            preauth_daily_cnt : 1,
                            preauth_weekly_amt : "1.00",
                            preauth_weekly_cnt : 1,
                            preauth_monthly_amt : "1.00",
                            preauth_monthly_cnt : 1,
                            preauth_min_amt : "1.00",
                        },
                        check: false,
                        risk: false,
                    } ) );

                    xferlim.getLimits( as, 'default', 'Deposits' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:USD',
                        hard: {
                            deposit_daily_amt : "1.00",
                            deposit_daily_cnt : 1,
                            withdrawal_daily_amt : "1.00",
                            withdrawal_daily_cnt : 1,
                            deposit_weekly_amt : "1.00",
                            deposit_weekly_cnt : 1,
                            withdrawal_weekly_amt : "1.00",
                            withdrawal_weekly_cnt : 1,
                            deposit_monthly_amt : "1.00",
                            deposit_monthly_cnt : 1,
                            withdrawal_monthly_amt : "1.00",
                            withdrawal_monthly_cnt : 1,
                            deposit_min_amt : "1.00",
                            withdrawal_min_amt : "1.00",

                        },
                        check: {
                            deposit_daily_amt : "2.00",
                            deposit_daily_cnt : 2,
                            withdrawal_daily_amt : "2.00",
                            withdrawal_daily_cnt : 2,
                            deposit_weekly_amt : "2.00",
                            deposit_weekly_cnt : 2,
                            withdrawal_weekly_amt : "2.00",
                            withdrawal_weekly_cnt : 2,
                            deposit_monthly_amt : "2.00",
                            deposit_monthly_cnt : 2,
                            withdrawal_monthly_amt : "2.00",
                            withdrawal_monthly_cnt : 2,
                            deposit_min_amt : "2.00",
                            withdrawal_min_amt : "2.00",

                        },
                        risk: false,
                    } ) );

                    xferlim.getLimits( as, 'default', 'Payments' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:EUR',
                        hard: {
                            outbound_daily_amt : "1.00",
                            outbound_daily_cnt : 1,
                            inbound_daily_amt : "1.00",
                            inbound_daily_cnt : 1,
                            outbound_weekly_amt : "1.00",
                            outbound_weekly_cnt : 1,
                            inbound_weekly_amt : "1.00",
                            inbound_weekly_cnt : 1,
                            outbound_monthly_amt : "1.00",
                            outbound_monthly_cnt : 1,
                            inbound_monthly_amt : "1.00",
                            inbound_monthly_cnt : 1,
                            outbound_min_amt : "1.00",
                        },
                        check: false,
                        risk: false,
                    } ) );

                    xferlim.getLimits( as, 'default', 'Gaming' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:EUR',
                        hard: {
                            bet_daily_amt : "1.00",
                            bet_daily_cnt : 1,
                            win_daily_amt : "1.00",
                            win_daily_cnt : 1,
                            profit_daily_amt : "1.00",
                            bet_weekly_amt : "1.00",
                            bet_weekly_cnt : 1,
                            win_weekly_amt : "1.00",
                            win_weekly_cnt : 1,
                            profit_weekly_amt : "1.00",
                            bet_monthly_amt : "1.00",
                            bet_monthly_cnt : 1,
                            win_monthly_amt : "1.00",
                            win_monthly_cnt : 1,
                            profit_monthly_amt : "1.00",
                            bet_min_amt : "1.00",
                        },
                        check: false,
                        risk: false,
                    } ) );

                    xferlim.getLimits( as, 'default', 'Misc' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:EUR',
                        hard: {
                            message_daily_cnt : 1,
                            failure_daily_cnt : 1,
                            limithit_daily_cnt : 1,
                            message_weekly_cnt : 1,
                            failure_weekly_cnt : 1,
                            limithit_weekly_cnt : 1,
                            message_monthly_cnt : 1,
                            failure_monthly_cnt : 1,
                            limithit_monthly_cnt : 1,
                        },
                        check: false,
                        risk: false,
                    } ) );

                    xferlim.getLimits( as, 'default', 'Personnel' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:EUR',
                        hard: {
                            message_daily_cnt : 1,
                            manual_daily_amt : "1.00",
                            manual_daily_cnt : 1,
                            message_weekly_cnt : 1,
                            manual_weekly_amt : "1.00",
                            manual_weekly_cnt : 1,
                            message_monthly_cnt : 1,
                            manual_monthly_amt : "1.00",
                            manual_monthly_cnt : 1,
                        },
                        check: false,
                        risk: {
                            message_daily_cnt : 3,
                            manual_daily_amt : "3.00",
                            manual_daily_cnt : 3,
                            message_weekly_cnt : 3,
                            manual_weekly_amt : "3.00",
                            manual_weekly_cnt : 3,
                            message_monthly_cnt : 3,
                            manual_monthly_amt : "3.00",
                            manual_monthly_cnt : 3,
                        },
                    } ) );

                    //--------

                    xferlim.setLimits( as, 'default', 'Personnel', 'I:EUR', {
                        message_daily_cnt : 4,
                        manual_daily_amt : "5.00",
                        manual_daily_cnt : 6,
                        message_weekly_cnt : 7,
                        manual_weekly_amt : "8.00",
                        manual_weekly_cnt : 9,
                        message_monthly_cnt : 10,
                        manual_monthly_amt : "11.00",
                        manual_monthly_cnt : 12,
                    }, false, false );
                    xferlim.getLimits( as, 'default', 'Personnel' );
                    as.add( ( as, res ) => expect( res ).to.eql( {
                        currency: 'I:EUR',
                        hard: {
                            message_daily_cnt : 4,
                            manual_daily_amt : "5.00",
                            manual_daily_cnt : 6,
                            message_weekly_cnt : 7,
                            manual_weekly_amt : "8.00",
                            manual_weekly_cnt : 9,
                            message_monthly_cnt : 10,
                            manual_monthly_amt : "11.00",
                            manual_monthly_cnt : 12,
                        },
                        check: false,
                        risk: false,
                    } ) );


                    xferlim.addLimitGroup( as, 'DefaultPeer' );

                    xferlim.setLimits( as, 'DefaultPeer', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "0.00",
                        outbound_daily_cnt : 0,
                        inbound_daily_amt : "0.00",
                        inbound_daily_cnt : 0,
                        outbound_weekly_amt : "0.00",
                        outbound_weekly_cnt : 0,
                        inbound_weekly_amt : "0.00",
                        inbound_weekly_cnt : 0,
                        outbound_monthly_amt : "0.00",
                        outbound_monthly_cnt : 0,
                        inbound_monthly_amt : "0.00",
                        inbound_monthly_cnt : 0,
                        outbound_min_amt : "0.00",
                    }, false, false );
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

        it ( 'should detect sett limits errors', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.setLimits( as, 'UnknowGroup', 'Misc', 'L:EUREKA', {
                                message_daily_cnt : 1,
                                failure_daily_cnt : 1,
                                limithit_daily_cnt : 1,
                                message_weekly_cnt : 1,
                                failure_weekly_cnt : 1,
                                limithit_weekly_cnt : 1,
                                message_monthly_cnt : 1,
                                failure_monthly_cnt : 1,
                                limithit_monthly_cnt : 1,
                            }, false, false );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownGroup' ) {
                                as.success();
                            }
                        }
                    );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.setLimits( as, 'default', 'Misc', 'L:EUREKA', {
                                message_daily_cnt : 1,
                                failure_daily_cnt : 1,
                                limithit_daily_cnt : 1,
                                message_weekly_cnt : 1,
                                failure_weekly_cnt : 1,
                                limithit_weekly_cnt : 1,
                                message_monthly_cnt : 1,
                                failure_monthly_cnt : 1,
                                limithit_monthly_cnt : 1,
                            }, false, false );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.setLimits( as, 'default', 'Misc', 'I:EUR', {
                                message_daily_cnt : 1,
                                failure_daily_cnt : 1,
                                limithit_daily_cnt : 1,
                                message_weekly_cnt : 1,
                                failure_weekly_cnt : 1,
                                limithit_weekly_cnt : 1,
                                message_monthly_cnt : 1,
                                failure_monthly_cnt : 1,
                            }, false, {} );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'InvalidRequest' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Hard limits do not match MiscLimitValues'
                                );
                                as.success();
                            }
                        }
                    );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.setLimits( as, 'default', 'Misc', 'I:EUR', {
                                message_daily_cnt : 1,
                                failure_daily_cnt : 1,
                                limithit_daily_cnt : 1,
                                message_weekly_cnt : 1,
                                failure_weekly_cnt : 1,
                                limithit_weekly_cnt : 1,
                                message_monthly_cnt : 1,
                                failure_monthly_cnt : 1,
                                limithit_monthly_cnt : 1,
                            }, {}, false );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'InvalidRequest' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Check limits do not match MiscLimitValues'
                                );
                                as.success();
                            }
                        }
                    );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.setLimits( as, 'default', 'Misc', 'I:EUR', {
                                message_daily_cnt : 1,
                                failure_daily_cnt : 1,
                                limithit_daily_cnt : 1,
                                message_weekly_cnt : 1,
                                failure_weekly_cnt : 1,
                                limithit_weekly_cnt : 1,
                                message_monthly_cnt : 1,
                                failure_monthly_cnt : 1,
                                limithit_monthly_cnt : 1,
                            }, false, {} );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'InvalidRequest' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Risk limits do not match MiscLimitValues'
                                );
                                as.success();
                            }
                        }
                    );
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

        it ( 'should detect get limits errors', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.addLimitGroup( as, 'KnowGroup' );
                            xferlim.getLimits( as, 'KnowGroup', 'Retail' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitsNotSet' ) {
                                as.success();
                            }
                        }
                    );

                    //--
                    as.add(
                        ( as ) => {
                            xferlim.getLimits( as, 'UnknowGroup', 'Retail' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitsNotSet' ) {
                                as.success();
                            }
                        }
                    );
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
