'use strict';


const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require( 'futoin-executor/Executor' );
const SpecTools = require( 'futoin-invoker/SpecTools' );
const $as = require( 'futoin-asyncsteps' );

module.exports = function( describe, it, vars ) {
    let as;
    let ccm;
    let executor;

    beforeEach( 'common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    } );

    describe( 'XferTools', function() {
        beforeEach( 'xfertools', function() {
            as.add(
                ( as ) => {
                    ccm.unRegister( 'xfer.evtgen' );
                    executor = new Executor( ccm );
                    ccm.registerServices( as, executor );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
        } );

        const XferTools = require( '../XferTools' );

        it( 'process amount limits', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );
                    xferlim.addLimitGroup( as, 'XferTools' );
                    xferlim.setLimits( as, 'XferTools', 'Retail', 'I:EUR', {
                        retail_daily_amt : "1.00",
                        retail_daily_cnt : 20,
                        retail_weekly_amt : "3.00",
                        retail_weekly_cnt : 40,
                        retail_monthly_amt : "5.00",
                        retail_monthly_cnt : 60,
                        retail_min_amt : "0.10",
                        preauth_daily_amt : "1.00",
                        preauth_daily_cnt : 20,
                        preauth_weekly_amt : "3.00",
                        preauth_weekly_cnt : 40,
                        preauth_monthly_amt : "5.00",
                        preauth_monthly_cnt : 60,
                        preauth_min_amt : "0.10",
                    }, {
                        retail_daily_amt : "0.50",
                        retail_daily_cnt : 10,
                        retail_weekly_amt : "2.50",
                        retail_weekly_cnt : 20,
                        retail_monthly_amt : "4.50",
                        retail_monthly_cnt : 30,
                        retail_min_amt : "0.11",
                        preauth_daily_amt : "0.50",
                        preauth_daily_cnt : 10,
                        preauth_weekly_amt : "2.50",
                        preauth_weekly_cnt : 20,
                        preauth_monthly_amt : "4.50",
                        preauth_monthly_cnt : 30,
                        preauth_min_amt : "0.11",
                    }, {
                        retail_daily_amt : "0.70",
                        retail_daily_cnt : 10,
                        retail_weekly_amt : "2.70",
                        retail_weekly_cnt : 20,
                        retail_monthly_amt : "4.70",
                        retail_monthly_cnt : 30,
                        retail_min_amt : "0.12",
                        preauth_daily_amt : "0.70",
                        preauth_daily_cnt : 10,
                        preauth_weekly_amt : "2.70",
                        preauth_weekly_cnt : 20,
                        preauth_monthly_amt : "4.70",
                        preauth_monthly_cnt : 30,
                        preauth_min_amt : "0.12",
                    } );

                    const xferacct = ccm.iface( 'xfer.accounts' );
                    xferacct.addAccountHolder( as, 'XferTools', 'XferTools', true, true, {}, {} );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add(
                ( as, holder ) => {
                    const db = ccm.db( 'xfer' );
                    const xt = new XferTools( ccm, 'Retail' );

                    //---
                    const xfer1 = db.newXfer();
                    xt.addLimitProcessing( as, xfer1, 'Retail', holder, 'I:EUR', '0.21', 'retail' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "1";
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( false );
                    } );
                    as.add( ( as ) => xfer1.execute( as ) );

                    //---
                    const xfer2 = db.newXfer();
                    xt.addLimitProcessing( as, xfer2, 'Retail', holder, 'I:EUR', '0.30', 'retail' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "2";
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( true );
                    } );
                    as.add( ( as ) => xfer2.execute( as ) );

                    //---
                    const xfer3 = db.newXfer();
                    xt.addLimitProcessing( as, xfer3, 'Retail', holder, 'I:EUR', '0.20', 'retail' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "3";
                        expect( do_risk ).to.equal( true );
                        expect( do_check ).to.equal( true );
                    } );
                    as.add( ( as ) => xfer3.execute( as ) );

                    //---
                    const xfer4 = db.newXfer();
                    xt.addLimitProcessing( as, xfer4, 'Retail', holder, 'I:EUR', '0.10', 'retail' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "4";
                        expect( do_risk ).to.equal( true );
                        expect( do_check ).to.equal( true );
                    } );
                    as.add( ( as ) => xfer4.execute( as ) );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
            const xt = new XferTools( ccm, 'Retail' );
        } );

        it( 'process count limits', function( done ) {
            as.add(
                ( as ) => {
                    const xferlim = ccm.iface( 'xfer.limits' );
                    xferlim.setLimits( as, 'XferTools', 'Deposits', 'I:EUR', {
                        deposit_daily_amt : "100.00",
                        deposit_daily_cnt : 10,
                        withdrawal_daily_amt : "100.00",
                        withdrawal_daily_cnt : 10,
                        deposit_weekly_amt : "100.00",
                        deposit_weekly_cnt : 20,
                        withdrawal_weekly_amt : "100.00",
                        withdrawal_weekly_cnt : 20,
                        deposit_monthly_amt : "100.00",
                        deposit_monthly_cnt : 30,
                        withdrawal_monthly_amt : "100.00",
                        withdrawal_monthly_cnt : 30,
                        deposit_min_amt : "0.10",
                        withdrawal_min_amt : "100.00",
                    }, {
                        deposit_daily_amt : "100.00",
                        deposit_daily_cnt : 1,
                        withdrawal_daily_amt : "100.00",
                        withdrawal_daily_cnt : 0,
                        deposit_weekly_amt : "100.00",
                        deposit_weekly_cnt : 4,
                        withdrawal_weekly_amt : "100.00",
                        withdrawal_weekly_cnt : 4,
                        deposit_monthly_amt : "100.00",
                        deposit_monthly_cnt : 4,
                        withdrawal_monthly_amt : "100.00",
                        withdrawal_monthly_cnt : 4,
                        deposit_min_amt : "0.10",
                        withdrawal_min_amt : "100.00",
                    }, {
                        deposit_daily_amt : "100.00",
                        deposit_daily_cnt : 2,
                        withdrawal_daily_amt : "100.00",
                        withdrawal_daily_cnt : 10,
                        deposit_weekly_amt : "100.00",
                        deposit_weekly_cnt : 20,
                        withdrawal_weekly_amt : "100.00",
                        withdrawal_weekly_cnt : 20,
                        deposit_monthly_amt : "100.00",
                        deposit_monthly_cnt : 30,
                        withdrawal_monthly_amt : "100.00",
                        withdrawal_monthly_cnt : 30,
                        deposit_min_amt : "0.10",
                        withdrawal_min_amt : "100.00",
                    } );

                    const xferacct = ccm.iface( 'xfer.accounts' );
                    xferacct.addAccountHolder( as, 'XferTools2', 'XferTools', true, true, {}, {} );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add(
                ( as, holder ) => {
                    const db = ccm.db( 'xfer' );
                    const xt = new XferTools( ccm, 'Deposits' );

                    //---
                    const xfer1 = db.newXfer();
                    xt.addLimitProcessing( as, xfer1, 'Deposits', holder, 'I:EUR', '0.21', 'deposit' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "1";
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( false );
                    } );
                    as.add( ( as ) => xfer1.execute( as ) );

                    //---
                    const xfer2 = db.newXfer();
                    xt.addLimitProcessing( as, xfer2, 'Deposits', holder, 'I:EUR', '0.30', 'deposit' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "2";
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( true );
                    } );
                    as.add( ( as ) => xfer2.execute( as ) );

                    //---
                    const xfer3 = db.newXfer();
                    xt.addLimitProcessing( as, xfer3, 'Deposits', holder, 'I:EUR', '0.20', 'deposit' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "3";
                        expect( do_risk ).to.equal( true );
                        expect( do_check ).to.equal( true );
                    } );
                    as.add( ( as ) => xfer3.execute( as ) );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
            const xt = new XferTools( ccm, 'Retail' );
        } );

        it( 'process limits/xfer/stats currency mismatch', function( done ) {
            as.add(
                ( as ) => {
                    const currmgr = ccm.iface( 'currency.manage' );
                    currmgr.setExRate( as, 'I:EUR', 'I:USD', '1.01', '0.01' );
                    currmgr.setExRate( as, 'I:EUR', 'I:USD', '0.99099099099', '0.01' );

                    const xferlim = ccm.iface( 'xfer.limits' );
                    xferlim.setLimits( as, 'XferTools', 'Payments', 'I:USD', {
                        outbound_daily_amt : "1.02",
                        outbound_daily_cnt : 2,
                        inbound_daily_amt : "1.02",
                        inbound_daily_cnt : 2,
                        outbound_weekly_amt : "10.0",
                        outbound_weekly_cnt : 2,
                        inbound_weekly_amt : "10.0",
                        inbound_weekly_cnt : 2,
                        outbound_monthly_amt : "10.0",
                        outbound_monthly_cnt : 2,
                        inbound_monthly_amt : "10.0",
                        inbound_monthly_cnt : 2,
                        outbound_min_amt : "0",
                    }, false, false );
                    xferlim.setLimits( as, 'XferTools', 'Misc', 'I:USD', {
                        message_daily_cnt : 1000,
                        failure_daily_cnt : 1000,
                        limithit_daily_cnt : 1000,
                        message_weekly_cnt : 1000,
                        failure_weekly_cnt : 1000,
                        limithit_weekly_cnt : 1000,
                        message_monthly_cnt : 1000,
                        failure_monthly_cnt : 1000,
                        limithit_monthly_cnt : 1000,
                    }, false, false );

                    const xferacct = ccm.iface( 'xfer.accounts' );
                    xferacct.addAccountHolder( as, 'XferToolsP', 'XferTools', true, true, {}, {} );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add(
                ( as, holder ) => {
                    const db = ccm.db( 'xfer' );
                    const xt = new XferTools( ccm, 'Payments' );

                    //---
                    const xfer1 = db.newXfer();
                    xt.addLimitProcessing( as, xfer1, 'Payments', holder, 'I:EUR', '1.00', 'outbound' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        as.state.test_name = "1";
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( false );
                    } );
                    as.add( ( as ) => xfer1.execute( as ) );

                    //---
                    as.add(
                        ( as ) => {
                            const xfer2 = db.newXfer();
                            xt.addLimitProcessing( as, xfer2, 'Payments', holder, 'I:USD', '0.01', 'outbound' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitReject' ) {
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            const xfer3 = db.newXfer();
                            xt.addLimitProcessing( as, xfer3, 'Payments', holder, 'I:EUR', '1.01', 'inbound' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitReject' ) {
                                as.success();
                            }
                        }
                    );

                    const xferlim = ccm.iface( 'xfer.limits' );
                    xferlim.setLimits( as, 'XferTools', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "1.02",
                        outbound_daily_cnt : 3,
                        inbound_daily_amt : "1.02",
                        inbound_daily_cnt : 3,
                        outbound_weekly_amt : "10.0",
                        outbound_weekly_cnt : 3,
                        inbound_weekly_amt : "10.0",
                        inbound_weekly_cnt : 3,
                        outbound_monthly_amt : "10.0",
                        outbound_monthly_cnt : 3,
                        inbound_monthly_amt : "10.0",
                        inbound_monthly_cnt : 3,
                        outbound_min_amt : "0",
                    }, false, false );

                    // try over limit
                    //---
                    as.add(
                        ( as ) => {
                            const xfer3 = db.newXfer();
                            xt.addLimitProcessing( as, xfer3, 'Payments', holder, 'I:EUR', '1.01', 'inbound' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitReject' ) {
                                as.success();
                            }
                        }
                    );

                    // try limit
                    //---
                    const xfer4 = db.newXfer();
                    xt.addLimitProcessing( as, xfer4, 'Payments', holder, 'I:EUR', '1.00', 'inbound' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( false );
                    } );
                    as.add( ( as ) => xfer4.execute( as ) );


                    // try over limit
                    //---
                    as.add(
                        ( as ) => {
                            const xfer3 = db.newXfer();
                            xt.addLimitProcessing( as, xfer3, 'Payments', holder, 'I:EUR', '0.01', 'inbound' );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitReject' ) {
                                as.success();
                            }
                        }
                    );

                    // cancel stats
                    //---
                    const xfer5 = db.newXfer();
                    xt.addStatsCancel( as, xfer5, 'Payments', holder, moment.utc().format(), 'I:EUR', '1.00', 'inbound' );
                    as.add( ( as ) => xfer5.execute( as ) );

                    // try limit again
                    //---
                    const xfer6 = db.newXfer();
                    xt.addLimitProcessing( as, xfer6, 'Payments', holder, 'I:EUR', '1.00', 'inbound' );

                    as.add( ( as, { do_risk, do_check } ) => {
                        expect( do_risk ).to.equal( false );
                        expect( do_check ).to.equal( false );
                    } );
                    as.add( ( as ) => xfer6.execute( as ) );

                    // Check cnt statistics
                    //---
                    db.select( 'limit_payments_stats' ).where( { holder } ).executeAssoc( as );
                    as.add( ( as, rows ) => {
                        // xfer + cancel + xfer
                        expect( rows[0].inbound_daily_cnt ).to.eql( 3 );
                    } );


                    // cancel stats
                    //---
                    {
                        const xfer = db.newXfer();
                        xt.addStatsCancel( as, xfer, 'Payments', holder,
                            moment.utc().startOf( 'month' ).subtract( 1, 'day' ).format(),
                            'I:EUR', '1.00', 'inbound' );
                        xt.addStatsCancel( as, xfer, 'Payments', holder,
                            moment.utc().startOf( 'week' ).subtract( 1, 'day' ).format(),
                            'I:EUR', '1.00', 'inbound' );
                        xt.addStatsCancel( as, xfer, 'Payments', holder,
                            moment.utc().subtract( 1, 'day' ).format(),
                            'I:EUR', '1.00', 'inbound' );
                    }
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
            const xt = new XferTools( ccm, 'Retail' );
        } );


        it ( 'should disable holder on limits hit limit', function( done ) {
            as.add(
                ( as ) => {
                    const xt = new XferTools( ccm, 'Payments' );
                    const xferlim = ccm.iface( 'xfer.limits' );

                    //--
                    xferlim.addLimitGroup( as, 'AutoDisable' );
                    xferlim.setLimits( as, 'AutoDisable', 'Misc', 'I:EUR', {
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

                    const xferacct = ccm.iface( 'xfer.accounts' );

                    xferacct.addAccountHolder( as, 'AutoDisable', 'AutoDisable', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        const call_limits = ( as ) => {
                            const dbxfer = ccm.db( 'xfer' ).newXfer();
                            xt._processLimits(
                                as,
                                dbxfer,
                                'Misc',
                                holder,
                                null,
                                {
                                    message_daily_cnt: 1,
                                    message_weekly_cnt: 1,
                                    message_monthly_cnt: 1,
                                }
                            );
                            as.add( ( as ) => dbxfer.execute( as ) );
                        };

                        // First no limit
                        call_limits( as );

                        //--
                        // Second just limit
                        // Third - limit + limithit limit -> auto-disable
                        for ( let i = 0; i < 2; ++i ) {
                            as.add(
                                ( as ) => {
                                    call_limits( as );
                                    as.add( ( as ) => as.error( 'Fail' ) );
                                },
                                ( as, err ) => {
                                    if ( err === 'LimitReject' ) {
                                        as.success();
                                    }
                                }
                            );

                            xferacct.getAccountHolder( as, holder );
                            as.add( ( as, info ) => expect( info.enabled ).to.be.equal( i === 0 ) );
                        }
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

        let system_account;
        let first_account;
        let second_account;
        let foreign_account;
        let external_account;
        let first_transit;
        let second_transit;
        let disabled_account;
        let fee_account;

        const check_balance = ( as, account, req ) => {
            ccm.db( 'xfer' ).select( 'accounts' )
                .where( 'uuidb64', account )
                .executeAssoc( as );
            as.add( ( as, rows ) => expect( `${rows[0].balance}` ).to.eql( req ) );
        };

        beforeEach( 'xferaccounts', function() {
            as.add(
                ( as ) => {
                    // once only, but DB connection is required
                    if ( system_account ) {
                        return;
                    }

                    const xferlim = ccm.iface( 'xfer.limits' );
                    xferlim.addLimitGroup( as, 'ExternalXfer' );

                    xferlim.setLimits( as, 'ExternalXfer', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "1000.00",
                        outbound_daily_cnt : 1000,
                        inbound_daily_amt : "1000.00",
                        inbound_daily_cnt : 1000,
                        outbound_weekly_amt : "1000.00",
                        outbound_weekly_cnt : 1000,
                        inbound_weekly_amt : "1000.00",
                        inbound_weekly_cnt : 1000,
                        outbound_monthly_amt : "1000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt : "1000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0",
                    }, false, false );

                    xferlim.addLimitGroup( as, 'SimpleXfer' );

                    xferlim.setLimits( as, 'SimpleXfer', 'Gaming', 'I:EUR', {
                        bet_daily_amt : "100",
                        bet_daily_cnt : 100,
                        win_daily_amt : "100",
                        win_daily_cnt : 100,
                        profit_daily_amt : "100",
                        bet_weekly_amt : "100",
                        bet_weekly_cnt : 100,
                        win_weekly_amt : "100",
                        win_weekly_cnt : 100,
                        profit_weekly_amt : "100",
                        bet_monthly_amt : "100",
                        bet_monthly_cnt : 100,
                        win_monthly_amt : "100",
                        win_monthly_cnt : 100,
                        profit_monthly_amt : "100",
                        bet_min_amt : "0.01",
                    }, {
                        bet_daily_amt : "100",
                        bet_daily_cnt : 100,
                        win_daily_amt : "100",
                        win_daily_cnt : 100,
                        profit_daily_amt : "100",
                        bet_weekly_amt : "100",
                        bet_weekly_cnt : 100,
                        win_weekly_amt : "100",
                        win_weekly_cnt : 100,
                        profit_weekly_amt : "100",
                        bet_monthly_amt : "100",
                        bet_monthly_cnt : 100,
                        win_monthly_amt : "100",
                        win_monthly_cnt : 100,
                        profit_monthly_amt : "100",
                        bet_min_amt : "10",
                    }, false );
                    xferlim.setLimits( as, 'SimpleXfer', 'Deposits', 'I:EUR', {
                        deposit_daily_amt : "100.00",
                        deposit_daily_cnt : 10,
                        withdrawal_daily_amt : "100.00",
                        withdrawal_daily_cnt : 10,
                        deposit_weekly_amt : "100.00",
                        deposit_weekly_cnt : 20,
                        withdrawal_weekly_amt : "100.00",
                        withdrawal_weekly_cnt : 20,
                        deposit_monthly_amt : "100.00",
                        deposit_monthly_cnt : 30,
                        withdrawal_monthly_amt : "100.00",
                        withdrawal_monthly_cnt : 30,
                        deposit_min_amt : "0.10",
                        withdrawal_min_amt : "0.10",
                    }, false, false );
                    xferlim.setLimits( as, 'SimpleXfer', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "1000.00",
                        outbound_daily_cnt : 1000,
                        inbound_daily_amt : "1000.00",
                        inbound_daily_cnt : 1000,
                        outbound_weekly_amt : "1000.00",
                        outbound_weekly_cnt : 1000,
                        inbound_weekly_amt : "1000.00",
                        inbound_weekly_cnt : 1000,
                        outbound_monthly_amt : "1000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt : "1000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0",
                    }, false, false );


                    const currmgr = ccm.iface( 'currency.manage' );
                    currmgr.setCurrency( as, 'L:XFRT', 3, 'Xfer Test Currency', 'XFT', true );
                    currmgr.setExRate( as, 'I:EUR', 'L:XFRT', '1.500', '0.05' );

                    const xferacct = ccm.iface( 'xfer.accounts' );

                    xferacct.addAccountHolder( as, 'ExternalXfer', 'ExternalXfer', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'External',
                            'I:EUR',
                            'Ext'
                        );
                        as.add( ( as, id ) => external_account = id );
                    } );

                    xferacct.addAccountHolder( as, 'SimpleXfer', 'SimpleXfer', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'Source'
                        );
                        as.add( ( as, id ) => system_account = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'Fee'
                        );
                        as.add( ( as, id ) => fee_account = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'First'
                        );
                        as.add( ( as, id ) => first_account = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Second'
                        );
                        as.add( ( as, id ) => second_account = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'L:XFRT',
                            'Foreign'
                        );
                        as.add( ( as, id ) => foreign_account = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Disabled',
                            false
                        );
                        as.add( ( as, id ) => disabled_account = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'Transit',
                            'I:EUR',
                            'Transit First',
                            true,
                            `transit1`,
                            external_account
                        );
                        as.add( ( as, id ) => first_transit = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'Transit',
                            'I:EUR',
                            'Transit Second',
                            true,
                            `transit2`,
                            external_account
                        );
                        as.add( ( as, id ) => second_transit = id );
                    } );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                }
            );
        } );

        it( 'should process simple xfer', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };
            const pxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );

                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '410' );

                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '6',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '1010' );

                    //---
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_account,
                        currency: 'I:EUR',
                        amount: '10.10',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, second_account, '1010' );

                    //---
                    dxt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.10',
                        type: 'Withdrawal',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, second_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process simple xfer with exrate', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };
            const pxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );

                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'L:XFRT',
                        amount: '10.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '650' );

                    //---
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_account,
                        currency: 'I:EUR',
                        amount: '6.50',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, second_account, '650' );

                    //---
                    dxt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        currency: 'L:XFRT',
                        amount: '9.43',
                        type: 'Withdrawal',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, second_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process transit xfers', function( done ) {
            const pxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }

                _domainExtIn( as, _in_xfer ) {
                    as.add( ( as ) => {} );
                }

                _domainExtOut( as, _out_xfer ) {
                    as.add( ( as ) => {} );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );

                    pxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );

                    //--
                    as.add( ( as ) => as.state.test_name = 'Transit In' );
                    pxt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '900' );
                    check_balance( as, first_transit, '0' );
                    check_balance( as, first_account, '100' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Transit Out' );
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, second_transit, '0' );
                    check_balance( as, external_account, '1000' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Transit In-Out' );
                    pxt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_transit, '0' );
                    check_balance( as, second_transit, '0' );
                    check_balance( as, external_account, '1000' );

                    //---
                    pxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Ensure all xfers Done' );
                    db.select( 'xfers' ).where( 'xfer_status !=', 'Done' ).execute( as );
                    as.add( ( as, { rows } ) => expect( rows.length ).to.equal( 0 ) );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process ext_id', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );

                    //
                    as.add( ( as ) => as.state.test_name = 'setup' );
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );

                    //
                    as.add( ( as ) => as.state.test_name = 'initial' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R1' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '590' );
                    check_balance( as, first_account, '410' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat first #1' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'R1' ),
                        orig_ts: moment.utc().format(),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '590' );
                    check_balance( as, first_account, '410' );

                    //
                    as.add( ( as ) => as.state.test_name = 'second' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.90',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R2' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '1000' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat first #2' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'R1' ),
                        orig_ts: moment.utc().format(),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '1000' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat second #1' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.90',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R2' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '1000' );

                    //
                    as.add( ( as ) => as.state.test_name = 'third' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Withdrawal',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R3' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );
                    check_balance( as, first_account, '0' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat second #2' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.90',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R2' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat third' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Withdrawal',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R3' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );
                    check_balance( as, first_account, '0' );

                    //
                    as.add( ( as ) => as.state.test_name = 'cleanup' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should detect xfer errors', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    //=================
                    as.add( ( as ) => as.state.test_name = 'not enough funds' );

                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '2.00',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: first_account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '4.10',
                                type: 'Deposit',
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'NotEnoughFunds' ) {
                                as.success();
                            }
                        }
                    );

                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '2.00',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    //=================
                    as.add( ( as ) => as.state.test_name = 'ext_id format' );

                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: external_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '4.10',
                                type: 'Deposit',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( '123', 'R1' ),
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Invalid external ID format'
                                );
                                as.success();
                            }
                        }
                    );

                    //=================
                    as.add( ( as ) => as.state.test_name = 'too old' );

                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: external_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '4.10',
                                type: 'Deposit',
                                orig_ts: '2017-01-01',
                                ext_id: dxt.makeExtId( external_account, 'R1' ),
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalTooOld' ) {
                                as.success();
                            }
                        }
                    );

                    //=================
                    as.add( ( as ) => as.state.test_name = 'original mismatch' );

                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( system_account, 'OM1' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    as.add( ( as ) => as.state.test_name = 'original mismatch account' );
                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( system_account, 'OM1' ),
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => as.state.test_name = 'original mismatch currency' );
                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: system_account,
                                currency: 'I:USD',
                                amount: '1.00',
                                type: 'Generic',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( system_account, 'OM1' ),
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => as.state.test_name = 'original mismatch amount' );
                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '1.01',
                                type: 'Generic',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( system_account, 'OM1' ),
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );
                    //=================
                    as.add( ( as ) => as.state.test_name = 'Unknown Account ID' );
                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: 'missingmissingmissing1',
                                currency: 'I:EUR',
                                amount: '1.01',
                                type: 'Generic',
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );

                    //=================
                    as.add( ( as ) => as.state.test_name = 'XferTool callback' );
                    const tmpxt = new XferTools( ccm, 'Deposits' );

                    tmpxt._domainDbStep();

                    const fake_account = '0123456789012345678901';

                    as.add(
                        ( as ) => {
                            tmpxt._domainExtIn( as, { in_xfer: { src_account: fake_account } } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            tmpxt._domainExtOut( as, { out_xfer: { dst_account: fake_account } } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            tmpxt._domainCancelExtIn( as, { in_xfer: { src_account: fake_account } } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            tmpxt._domainCancelExtOut( as, { out_xfer: { dst_account: fake_account } } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );


                    //=================
                    as.add( ( as ) => as.state.test_name = 'Invalid xfer data' );

                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {} );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Invalid xfer data'
                                );
                                as.success();
                            }
                        }
                    );


                    //=================
                    as.add( ( as ) => as.state.test_name = 'Invalid xfer data' );

                    as.add(
                        ( as ) => {
                            dxt.processCancel( as, {} );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Invalid xfer data'
                                );
                                as.success();
                            }
                        }
                    );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process forced xfers', function( done ) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }
            };

            as.add(
                ( as ) => {
                    //
                    as.add( ( as ) => as.state.test_name = 'to disabled' );
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: disabled_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, disabled_account, '100' );

                    //
                    as.add( ( as ) => as.state.test_name = 'from disabled' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, {
                                src_account: disabled_account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic',
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'DisabledAccount' ) {
                                as.success();
                            }
                        }
                    );

                    //
                    as.add( ( as ) => as.state.test_name = 'from disabled forced' );
                    xt.processXfer( as, {
                        src_account: disabled_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        force: true,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, disabled_account, '0' );

                    //
                    as.add( ( as ) => as.state.test_name = 'from disabled holder' );
                    const xferacct = ccm.iface( 'xfer.accounts' );
                    xferacct.addAccountHolder( as, 'Disabled', 'SimpleXfer', false, true, {}, {} );
                    as.add( ( as, holder ) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Enabled',
                            true
                        );
                        as.add( ( as, account ) => {
                            check_balance( as, account, '0' );

                            xt.processXfer( as, {
                                src_account: system_account,
                                dst_account: account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic',
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );

                            as.add(
                                ( as ) => {
                                    xt.processXfer( as, {
                                        src_account: account,
                                        dst_account: system_account,
                                        currency: 'I:EUR',
                                        amount: '1.00',
                                        type: 'Generic',
                                        src_limit_prefix: false,
                                        dst_limit_prefix: false,
                                    } );
                                    as.add( ( as ) => as.error( 'Fail' ) );
                                },
                                ( as, err ) => {
                                    if ( err === 'DisabledAccount' ) {
                                        as.success();
                                    }
                                }
                            );

                            xt.processXfer( as, {
                                src_account: account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic',
                                force: true,
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                        } );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process extra fee', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    //=================
                    as.add( ( as ) => as.state.test_name = 'simple' );
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '1.20',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, first_account, '120' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, first_account, '0' );
                    check_balance( as, second_account, '100' );
                    check_balance( as, fee_account, '20' );

                    dxt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Withdrawal',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    dxt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, second_account, '0' );
                    check_balance( as, fee_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process extra fee with tansit accounts', function( done ) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }

                _rawExtIn( as, xfer ) {
                    as.add( ( as ) => {} );
                }

                _rawExtOut( as, xfer ) {
                    as.add( ( as ) => {} );
                }
            };

            as.add(
                ( as ) => {
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );

                    //--
                    as.add( ( as ) => as.state.test_name = 'Transit In' );
                    xt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '2.00',
                        type: 'Generic',
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '780' );
                    check_balance( as, first_transit, '0' );
                    check_balance( as, first_account, '200' );
                    check_balance( as, fee_account, '20' );


                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Transit Int Fail';
                            xt.processXfer( as, {
                                src_account: first_transit,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '2.00',
                                type: 'Generic',
                                extra_fee: {
                                    dst_account: second_transit,
                                    currency: 'I:EUR',
                                    amount: '0.20',
                                },
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Transit Extra Fee destination is not allowed'
                                );
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Transit Out' );
                    xt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '1.80',
                        type: 'Generic',
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, second_transit, '0' );
                    check_balance( as, external_account, '960' );
                    check_balance( as, fee_account, '40' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Transit In-Out' );
                    xt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '2.00',
                        type: 'Generic',
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_transit, '0' );
                    check_balance( as, second_transit, '0' );
                    check_balance( as, external_account, '940' );
                    check_balance( as, fee_account, '60' );

                    //---
                    xt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '9.40',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    xt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.60',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, fee_account, '0' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Ensure all xfers Done' );
                    ccm.db( 'xfer' ).select( 'xfers' ).where( 'xfer_status !=', 'Done' ).execute( as );
                    as.add( ( as, { rows } ) => expect( rows.length ).to.equal( 0 ) );
                    //ccm.db('xfer').select( 'xfers' ).where('xfer_type', 'Fee').executeAssoc(as);
                    //as.add( (as, rows ) => console.log(rows));
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );


        it( 'should process ext_id with extra fee', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );

                    //
                    as.add( ( as ) => as.state.test_name = 'setup' );
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );

                    //
                    as.add( ( as ) => as.state.test_name = 'initial' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'RF1' ),
                        extra_fee: {
                            currency: 'I:EUR',
                            amount: '0.20',
                            dst_account: fee_account,
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '570' );
                    check_balance( as, first_account, '410' );
                    check_balance( as, fee_account, '20' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat first #1' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'RF1' ),
                        orig_ts: moment.utc().format(),
                        extra_fee: {
                            currency: 'I:EUR',
                            amount: '0.20',
                            dst_account: fee_account,
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '570' );
                    check_balance( as, first_account, '410' );
                    check_balance( as, fee_account, '20' );

                    //
                    as.add( ( as ) => {
                        as.state.test_name = 'repeat first #1 (fail)';
                        dxt.processXfer( as, {
                            src_account: external_account,
                            dst_account: first_account,
                            currency: 'I:EUR',
                            amount: '4.10',
                            type: 'Deposit',
                            ext_id: dxt.makeExtId( external_account, 'RF1' ),
                            orig_ts: moment.utc().format(),
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'OriginalMismatch' ) {
                            as.success();
                        }
                    } );

                    //
                    as.add( ( as ) => {
                        as.state.test_name = 'repeat first #1 (fail 2)';
                        dxt.processXfer( as, {
                            src_account: external_account,
                            dst_account: first_account,
                            currency: 'I:EUR',
                            amount: '4.10',
                            type: 'Deposit',
                            ext_id: dxt.makeExtId( external_account, 'RF1' ),
                            orig_ts: moment.utc().format(),
                            extra_fee: {
                                currency: 'I:EUR',
                                amount: '0.20',
                                dst_account: second_account,
                            },
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'OriginalMismatch' ) {
                            as.success();
                        }
                    } );

                    //
                    as.add( ( as ) => as.state.test_name = 'second' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.70',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'RF2' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '980' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat first #2' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'RF1' ),
                        orig_ts: moment.utc().format(),
                        extra_fee: {
                            currency: 'I:EUR',
                            amount: '0.20',
                            dst_account: fee_account,
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '980' );
                    check_balance( as, fee_account, '20' );

                    //
                    as.add( ( as ) => as.state.test_name = 'third' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '9.80',
                        type: 'Withdrawal',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'RF3' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );


                    check_balance( as, external_account, '980' );
                    check_balance( as, first_account, '0' );

                    //
                    as.add( ( as ) => as.state.test_name = 'cleanup' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '9.80',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    dxt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, fee_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process xfer fee', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    //=================
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '1.20',
                        type: 'Deposit',
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, first_account, '100' );
                    check_balance( as, fee_account, '20' );


                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Withdrawal',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    dxt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    check_balance( as, second_account, '0' );
                    check_balance( as, fee_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process xfer fee with tansit accounts', function( done ) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }

                _rawExtIn( as, xfer ) {
                    as.add( ( as ) => {} );
                }

                _rawExtOut( as, xfer ) {
                    as.add( ( as ) => {} );
                }
            };

            as.add(
                ( as ) => {
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );

                    //--
                    as.add( ( as ) => as.state.test_name = 'Transit In' );
                    xt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '2.20',
                        type: 'Generic',
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '780' );
                    check_balance( as, first_transit, '0' );
                    check_balance( as, first_account, '200' );
                    check_balance( as, fee_account, '20' );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Transit Out';
                            xt.processXfer( as, {
                                src_account: first_account,
                                dst_account: second_transit,
                                currency: 'I:EUR',
                                amount: '2.00',
                                type: 'Generic',
                                xfer_fee: {
                                    dst_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.20',
                                },
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Xfer fee is not allowed for Transit destination'
                                );
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Transit Out';
                            xt.processXfer( as, {
                                src_account: first_account,
                                dst_account: second_account,
                                currency: 'I:EUR',
                                amount: '2.00',
                                type: 'Generic',
                                xfer_fee: {
                                    dst_account: second_transit,
                                    currency: 'I:EUR',
                                    amount: '0.20',
                                },
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Transit Xfer Fee destination is not allowed'
                                );
                                as.success();
                            }
                        }
                    );

                    //---
                    as.add(
                        ( as ) => {
                            as.state.test_name = 'Transit In-Out';
                            xt.processXfer( as, {
                                src_account: first_transit,
                                dst_account: second_transit,
                                currency: 'I:EUR',
                                amount: '2.20',
                                type: 'Generic',
                                xfer_fee: {
                                    dst_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.20',
                                },
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'XferError' ) {
                                expect( as.state.error_info ).to.equal(
                                    'Xfer fee is not allowed for Transit destination'
                                );
                                as.success();
                            }
                        }
                    );

                    //---
                    xt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '7.80',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    xt.processXfer( as, {
                        src_account: first_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '2.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );


                    xt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '0' );
                    check_balance( as, fee_account, '0' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Ensure all xfers Done' );
                    ccm.db( 'xfer' ).select( 'xfers' ).where( 'xfer_status !=', 'Done' ).execute( as );
                    as.add( ( as, { rows } ) => expect( rows.length ).to.equal( 0 ) );
                    //ccm.db('xfer').select( 'xfers' ).where('xfer_type', 'Fee').executeAssoc(as);
                    //as.add( (as, rows ) => console.log(rows));
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should process ext_id with xfer fee', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );

                    //
                    as.add( ( as ) => as.state.test_name = 'setup' );
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '1000' );

                    //
                    as.add( ( as ) => as.state.test_name = 'initial' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.30',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'RX1' ),
                        xfer_fee: {
                            currency: 'I:EUR',
                            amount: '0.20',
                            dst_account: fee_account,
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '570' );
                    check_balance( as, first_account, '410' );
                    check_balance( as, fee_account, '20' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat first #1' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.30',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'RX1' ),
                        orig_ts: moment.utc().format(),
                        xfer_fee: {
                            currency: 'I:EUR',
                            amount: '0.20',
                            dst_account: fee_account,
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '570' );
                    check_balance( as, first_account, '410' );
                    check_balance( as, fee_account, '20' );

                    //
                    as.add( ( as ) => {
                        as.state.test_name = 'repeat first #1 (fail)';
                        dxt.processXfer( as, {
                            src_account: external_account,
                            dst_account: first_account,
                            currency: 'I:EUR',
                            amount: '4.30',
                            type: 'Deposit',
                            ext_id: dxt.makeExtId( external_account, 'RX1' ),
                            orig_ts: moment.utc().format(),
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'OriginalMismatch' ) {
                            as.success();
                        }
                    } );

                    //
                    as.add( ( as ) => as.state.test_name = 'second' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.70',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'RX2' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '980' );

                    //
                    as.add( ( as ) => as.state.test_name = 'repeat first #2' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.30',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'RX1' ),
                        orig_ts: moment.utc().format(),
                        xfer_fee: {
                            currency: 'I:EUR',
                            amount: '0.20',
                            dst_account: fee_account,
                        },
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, first_account, '980' );
                    check_balance( as, fee_account, '20' );

                    //
                    as.add( ( as ) => as.state.test_name = 'third' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '9.80',
                        type: 'Withdrawal',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'RX3' ),
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );


                    check_balance( as, external_account, '980' );
                    check_balance( as, first_account, '0' );

                    //
                    as.add( ( as ) => as.state.test_name = 'cleanup' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '9.80',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    dxt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, external_account, '0' );
                    check_balance( as, fee_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );


        it( 'should process user confirmation', function( done ) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Gaming' );
                }

                _domainExtOut() {
                    // noop
                }
            };

            as.add(
                ( as ) => {
                    as.add( ( as ) => as.state.test_name = 'setup' );
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '2000' );
                    check_balance( as, external_account, '0' );

                    as.add( ( as ) => as.state.test_name = 'Over check limit' );
                    xt.processXfer( as, {
                        src_account: first_account,
                        src_limit_prefix: 'bet',
                        dst_account: external_account,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '11',
                        type: 'Bet',
                    } );

                    check_balance( as, first_account, '900' );
                    check_balance( as, external_account, '1100' );

                    //---
                    let xfer;

                    as.add( ( as ) => as.state.test_name = 'Under check limit 1' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, {
                                src_account: first_account,
                                src_limit_prefix: 'bet',
                                dst_account: external_account,
                                dst_limit_prefix: false,
                                currency: 'I:EUR',
                                amount: '3',
                                type: 'Bet',
                                orig_ts: moment.utc().format(),
                                ext_id: xt.makeExtId( first_account, 'UC1' ),
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'WaitUser' ) {
                                as.success();
                            }
                        }
                    );

                    check_balance( as, first_account, '600' );
                    check_balance( as, external_account, '1100' );

                    as.add( ( as ) => as.state.test_name = 'User confirmation 1' );
                    xt.processXfer( as, {
                        src_account: first_account,
                        src_limit_prefix: 'bet',
                        dst_account: external_account,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '3',
                        type: 'Bet',
                        orig_ts: moment.utc().format(),
                        ext_id: xt.makeExtId( first_account, 'UC1' ),
                        user_confirm: true,
                    } );

                    check_balance( as, first_account, '600' );
                    check_balance( as, external_account, '1400' );

                    //---

                    as.add( ( as ) => as.state.test_name = 'Under check limit 2' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, xfer = {
                                src_account: first_account,
                                src_limit_prefix: 'bet',
                                dst_account: external_account,
                                dst_limit_prefix: false,
                                currency: 'I:EUR',
                                amount: '4',
                                type: 'Bet',
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'WaitUser' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => {
                        check_balance( as, first_account, '200' );
                        check_balance( as, external_account, '1400' );

                        as.state.test_name = 'User confirmation 2';

                        xt.processXfer( as, {
                            id: xfer.id,
                            src_account: first_account,
                            src_limit_prefix: 'bet',
                            dst_account: external_account,
                            dst_limit_prefix: false,
                            currency: 'I:EUR',
                            amount: '4',
                            type: 'Bet',
                            user_confirm: true,
                        } );
                    } );

                    check_balance( as, first_account, '200' );
                    check_balance( as, external_account, '1800' );

                    //---

                    as.add( ( as ) => as.state.test_name = 'Under check limit 3' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, xfer = {
                                src_account: first_account,
                                src_limit_prefix: 'bet',
                                dst_account: second_transit,
                                dst_limit_prefix: false,
                                currency: 'I:EUR',
                                amount: '2',
                                type: 'Bet',
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'WaitUser' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as, id ) => {
                        check_balance( as, first_account, '0' );
                        check_balance( as, external_account, '1800' );

                        as.state.test_name = 'User confirmation 3';

                        xt.processXfer( as, {
                            id: xfer.id,
                            src_account: first_account,
                            src_limit_prefix: 'bet',
                            dst_account: second_transit,
                            dst_limit_prefix: false,
                            currency: 'I:EUR',
                            amount: '2',
                            type: 'Bet',
                            user_confirm: true,
                        } );
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, external_account, '2000' );

                    //---

                    as.add( ( as ) => as.state.test_name = 'Cleanup' );
                    xt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Deposit',
                    } );

                    check_balance( as, external_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should support overdraft', function( done ) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }
            };

            as.add(
                ( as ) => {
                    as.add( ( as ) => as.state.test_name = 'setup' );
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    const xferacct = ccm.iface( 'xfer.accounts' );
                    xferacct.setOverdraft( as, first_account, 'I:EUR', '10' );

                    check_balance( as, first_account, '2000' );
                    check_balance( as, second_account, '0' );


                    as.add( ( as ) => as.state.test_name = 'use' );
                    xt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_account,
                        currency: 'I:EUR',
                        amount: '30',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, first_account, '-1000' );
                    check_balance( as, second_account, '3000' );

                    as.add( ( as ) => {
                        xt.processXfer( as, {
                            src_account: first_account,
                            dst_account: second_account,
                            currency: 'I:EUR',
                            amount: '0.01',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'NotEnoughFunds' ) {
                            as.success();
                        }
                    } );


                    as.add( ( as ) => as.state.test_name = 'Cleanup' );
                    xt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '30',
                        type: 'Generic',
                    } );
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '10',
                        type: 'Generic',
                    } );
                    xferacct.setOverdraft( as, first_account, 'I:EUR', '0' );

                    check_balance( as, first_account, '0' );
                    check_balance( as, second_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should repeat with changed currency', function( done ) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }
            };

            as.add(
                ( as ) => {
                    const currmgr = ccm.iface( 'currency.manage' );
                    currmgr.setExRate( as, 'I:EUR', 'L:XFRT', '2.05', '0.05' );
                    currmgr.setExRate( as, 'I:EUR', 'I:USD', '1.05', '0.00' );
                    currmgr.setExRate( as, 'I:USD', 'L:XFRT', '1', '0.00' );

                    const in_ext_id = xt.makeExtId( foreign_account, 'FXI1' );
                    const in_ext_id2 = xt.makeExtId( foreign_account, 'FXI2' );
                    const orig_ts = moment.utc().format();
                    const out_ext_id = xt.makeExtId( foreign_account, 'FXO1' );
                    const out_ext_id2 = xt.makeExtId( foreign_account, 'FXO2' );

                    as.add( ( as ) => as.state.test_name = 'in' );
                    xt.processXfer( as, {
                        ext_id: in_ext_id,
                        orig_ts: orig_ts,
                        src_account: system_account,
                        dst_account: foreign_account,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, foreign_account, '40000' );

                    currmgr.setExRate( as, 'I:EUR', 'L:XFRT', '1.500', '0.05' );

                    as.add( ( as ) => as.state.test_name = 'repeat in' );
                    xt.processXfer( as, {
                        ext_id: in_ext_id,
                        orig_ts: orig_ts,
                        src_account: system_account,
                        dst_account: foreign_account,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, foreign_account, '40000' );

                    currmgr.setExRate( as, 'I:EUR', 'L:XFRT', '1.95', '0.05' );

                    as.add( ( as ) => as.state.test_name = 'out' );
                    xt.processXfer( as, {
                        ext_id: out_ext_id,
                        orig_ts: orig_ts,
                        src_account: foreign_account,
                        dst_account: system_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Generic',
                    } );

                    check_balance( as, foreign_account, '0' );

                    currmgr.setExRate( as, 'I:EUR', 'L:XFRT', '1.5', '0.05' );

                    as.add( ( as ) => as.state.test_name = 'repeat out' );
                    xt.processXfer( as, {
                        ext_id: out_ext_id,
                        orig_ts: orig_ts,
                        src_account: foreign_account,
                        dst_account: system_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:EUR',
                        amount: '20',
                        type: 'Generic',
                    } );

                    check_balance( as, foreign_account, '0' );

                    as.add( ( as ) => as.state.test_name = 'in 2' );
                    xt.processXfer( as, {
                        ext_id: in_ext_id2,
                        orig_ts: orig_ts,
                        src_account: system_account,
                        dst_account: foreign_account,
                        currency: 'I:USD',
                        amount: '20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, foreign_account, '20000' );

                    currmgr.setExRate( as, 'I:USD', 'L:XFRT', '2', '0' );

                    as.add( ( as ) => as.state.test_name = 'repeat in' );
                    xt.processXfer( as, {
                        ext_id: in_ext_id2,
                        orig_ts: orig_ts,
                        src_account: system_account,
                        dst_account: foreign_account,
                        currency: 'I:USD',
                        amount: '20',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    check_balance( as, foreign_account, '20000' );

                    as.add( ( as ) => as.state.test_name = 'out 2' );
                    xt.processXfer( as, {
                        ext_id: out_ext_id2,
                        orig_ts: orig_ts,
                        src_account: foreign_account,
                        dst_account: system_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:USD',
                        amount: '10',
                        type: 'Generic',
                    } );

                    check_balance( as, foreign_account, '0' );

                    as.add( ( as ) => as.state.test_name = 'repeat out 2' );
                    xt.processXfer( as, {
                        ext_id: out_ext_id2,
                        orig_ts: orig_ts,
                        src_account: foreign_account,
                        dst_account: system_account,
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        currency: 'I:USD',
                        amount: '10',
                        type: 'Generic',
                    } );

                    check_balance( as, foreign_account, '0' );

                    //----
                    as.add( ( as ) => as.state.test_name = 'repeat in mismatch' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, {
                                ext_id: in_ext_id,
                                orig_ts: orig_ts,
                                src_account: system_account,
                                dst_account: foreign_account,
                                currency: 'I:EUR',
                                amount: '21',
                                type: 'Generic',
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => as.state.test_name = 'repeat out mismatch' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, {
                                ext_id: out_ext_id,
                                orig_ts: orig_ts,
                                src_account: foreign_account,
                                dst_account: system_account,
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                                currency: 'I:EUR',
                                amount: '21',
                                type: 'Generic',
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );


                    as.add( ( as ) => as.state.test_name = 'repeat out 2 mismatch' );
                    as.add(
                        ( as ) => {
                            xt.processXfer( as, {
                                ext_id: out_ext_id2,
                                orig_ts: orig_ts,
                                src_account: foreign_account,
                                dst_account: system_account,
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                                currency: 'I:USD',
                                amount: '11',
                                type: 'Generic',
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should cancel simple', function( done ) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );
                    const orig_ts = moment.utc().format();
                    let xfer;
                    let ext_id;

                    //-----
                    as.add( ( as ) => as.state.test_name = 'simple post-cancel ext_id' );
                    ext_id = dxt.makeExtId( first_account, 'CNCL1' );
                    dxt.processXfer( as, {
                        ext_id,
                        orig_ts,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.10',
                        },
                    } );

                    check_balance( as, first_account, '400' );
                    check_balance( as, fee_account, '30' );

                    dxt.processCancel( as, {
                        ext_id,
                        orig_ts,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.10',
                        },
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, fee_account, '0' );

                    // repeat
                    dxt.processCancel( as, {
                        ext_id,
                        orig_ts,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.10',
                        },
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, fee_account, '0' );

                    //-----
                    as.add( ( as ) => as.state.test_name = 'simple pre-cancel ext_id' );
                    ext_id = dxt.makeExtId( first_account, 'CNCL2' );

                    dxt.processCancel( as, {
                        ext_id,
                        orig_ts,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.00',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.10',
                        },
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, fee_account, '0' );

                    as.add(
                        ( as ) => {
                            dxt.processXfer( as, {
                                ext_id,
                                orig_ts,
                                src_account: system_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '5.00',
                                type: 'Deposit',
                                src_limit_prefix: false,
                                dst_limit_prefix: false,
                                extra_fee: {
                                    dst_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.20',
                                },
                                xfer_fee: {
                                    dst_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.10',
                                },
                            } );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        }
                    );

                    check_balance( as, first_account, '0' );
                    check_balance( as, fee_account, '0' );

                    dxt.processCancel( as, {
                        ext_id,
                        orig_ts,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.00',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                        xfer_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.10',
                        },
                    } );

                    check_balance( as, first_account, '0' );
                    check_balance( as, fee_account, '0' );

                    //-----
                    as.add( ( as ) => as.state.test_name = 'simple post-cancel id' );
                    let xfer_id;
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    as.add( ( as, id ) => {
                        xfer_id = id;
                    } );

                    check_balance( as, first_account, '410' );

                    as.add( ( as ) => dxt.processCancel( as, {
                        id : xfer_id,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } ) );

                    check_balance( as, first_account, '0' );

                    // repeat
                    as.add( ( as ) => dxt.processCancel( as, {
                        id : xfer_id,
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } ) );

                    check_balance( as, first_account, '0' );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
                    console.log( err );
                    console.log( as.state.error_info );
                    done( as.state.last_exception || 'Fail' );
                }
            );
            as.add( ( as ) => done() );
            as.execute();
        } );

        it( 'should cancel transit', function( done ) {
            this.timeout( 5e3 );
            const pxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }

                _rawExtIn( as, xfer ) {
                    as.add( ( as ) => {} );
                }

                _rawCancelExtIn( as, xfer ) {
                    as.add( ( as ) => {} );
                }

                _rawExtOut( as, xfer ) {
                    as.add( ( as ) => {} );
                }

                _rawCancelExtOut( as, xfer ) {
                    as.add( ( as ) => {} );
                }
            };

            as.add(
                ( as ) => {
                    const db = ccm.db( 'xfer' );
                    const to_cancel = [];

                    pxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    as.add( ( as, id ) => to_cancel.push( id ) );

                    check_balance( as, external_account, '1000' );

                    //--
                    as.add( ( as ) => as.state.test_name = 'Transit In' );
                    pxt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: 'deposit',
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.20',
                        },
                    } );
                    as.add( ( as, id ) => to_cancel.push( id ) );

                    check_balance( as, external_account, '880' );
                    check_balance( as, first_transit, '0' );
                    check_balance( as, first_account, '100' );
                    check_balance( as, fee_account, '20' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Transit Out' );
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '0.70',
                        type: 'Generic',
                        src_limit_prefix: 'withdrawal',
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.30',
                        },
                    } );
                    as.add( ( as, id ) => to_cancel.push( id ) );

                    check_balance( as, first_account, '0' );
                    check_balance( as, second_transit, '0' );
                    check_balance( as, external_account, '950' );
                    check_balance( as, fee_account, '50' );

                    //---
                    as.add( ( as ) => as.state.test_name = 'Transit In-Out' );
                    pxt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                        extra_fee: {
                            dst_account: fee_account,
                            currency: 'I:EUR',
                            amount: '0.40',
                        },
                    } );
                    as.add( ( as, id ) => to_cancel.push( id ) );

                    check_balance( as, first_transit, '0' );
                    check_balance( as, second_transit, '0' );
                    check_balance( as, external_account, '910' );
                    check_balance( as, fee_account, '90' );

                    //---
                    pxt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '0.90',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    as.add( ( as, id ) => to_cancel.push( id ) );

                    pxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );
                    as.add( ( as, id ) => to_cancel.push( id ) );

                    check_balance( as, external_account, '0' );

                    //---
                    as.add( ( as ) => {
                        as.add( ( as ) => as.state.test_name = 'Cancel cleanup' );
                        pxt.processCancel( as, {
                            id: to_cancel.pop(),
                            src_account: external_account,
                            dst_account: system_account,
                            currency: 'I:EUR',
                            amount: '10.00',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );

                        pxt.processCancel( as, {
                            id: to_cancel.pop(),
                            src_account: fee_account,
                            dst_account: external_account,
                            currency: 'I:EUR',
                            amount: '0.90',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );

                        check_balance( as, first_transit, '0' );
                        check_balance( as, second_transit, '0' );
                        check_balance( as, external_account, '910' );
                        check_balance( as, fee_account, '90' );

                        as.add( ( as ) => as.state.test_name = 'Cancel In-Out' );
                        pxt.processCancel( as, {
                            id: to_cancel.pop(),
                            src_account: first_transit,
                            dst_account: second_transit,
                            currency: 'I:EUR',
                            amount: '1.00',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                            extra_fee: {
                                dst_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.40',
                            },
                        } );

                        check_balance( as, first_account, '0' );
                        check_balance( as, second_transit, '0' );
                        check_balance( as, external_account, '950' );
                        check_balance( as, fee_account, '50' );

                        as.add( ( as ) => as.state.test_name = 'Cancel Out' );
                        pxt.processCancel( as, {
                            id: to_cancel.pop(),
                            src_account: first_account,
                            dst_account: second_transit,
                            currency: 'I:EUR',
                            amount: '0.70',
                            type: 'Generic',
                            src_limit_prefix: 'withdrawal',
                            dst_limit_prefix: false,
                            extra_fee: {
                                dst_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.30',
                            },
                        } );

                        check_balance( as, first_transit, '0' );
                        check_balance( as, first_account, '100' );
                        check_balance( as, external_account, '880' );
                        check_balance( as, fee_account, '20' );


                        as.add( ( as ) => as.state.test_name = 'Cancel In' );
                        pxt.processCancel( as, {
                            id: to_cancel.pop(),
                            src_account: first_transit,
                            dst_account: first_account,
                            currency: 'I:EUR',
                            amount: '1.00',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: 'deposit',
                            extra_fee: {
                                dst_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.20',
                            },
                        } );

                        check_balance( as, external_account, '1000' );
                        check_balance( as, first_transit, '0' );
                        check_balance( as, first_account, '0' );
                        check_balance( as, fee_account, '0' );

                        as.add( ( as ) => as.state.test_name = 'Cancel Setup' );
                        pxt.processCancel( as, {
                            id: to_cancel.pop(),
                            src_account: system_account,
                            dst_account: external_account,
                            currency: 'I:EUR',
                            amount: '10.00',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );

                        check_balance( as, external_account, '0' );

                        as.add( ( as ) => as.state.test_name = 'Pre-Cancel In-Out' );
                        pxt.processCancel( as, {
                            src_account: first_transit,
                            dst_account: second_transit,
                            currency: 'I:EUR',
                            amount: '100.00',
                            type: 'Generic',
                            src_limit_prefix: false,
                            dst_limit_prefix: false,
                        } );

                        check_balance( as, external_account, '0' );
                        check_balance( as, first_transit, '0' );
                        check_balance( as, second_transit, '0' );
                    } );
                },
                ( as, err ) => {
                    console.log( as.state.test_name );
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
