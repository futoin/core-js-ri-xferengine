'use strict';


const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require('futoin-executor/Executor');
const GenFace = require( 'futoin-eventstream/GenFace' );
const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
const DBGenService = require( 'futoin-eventstream/DBGenService' );

module.exports = function(describe, it, vars) {
    let as;
    let ccm;
    let executor;
    
    beforeEach('common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    });

    describe('XferTools', function() {
        const LimitsFace = require('../LimitsFace');
        const LimitsService = require('../LimitsService');
        const CurrencyInfoFace = require('../Currency/InfoFace');
        const CurrencyInfoService = require('../Currency/InfoService');
        const CurrencyManageFace = require('../Currency/ManageFace');
        const CurrencyManageService = require('../Currency/ManageService');

        const AccountsFace = require('../AccountsFace');
        const AccountsService = require('../AccountsService');

        beforeEach('xfertools', function() {
            as.add(
                (as) => {
                    CurrencyManageService.register(as, executor);
                    CurrencyManageFace.register(as, ccm, 'currency.manage', executor);
                    
                    CurrencyInfoService.register(as, executor);
                    CurrencyInfoFace.register(as, ccm, 'currency.info', executor);

                    LimitsService.register(as, executor);
                    LimitsFace.register(as, ccm, 'xfer.limits', executor);

                    AccountsService.register(as, executor);
                    AccountsFace.register(as, ccm, 'xfer.accounts', executor);
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
        });
        
        const XferTools = require('../XferTools');
        
        it('process amount limits', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    xferlim.addLimitGroup(as, 'XferTools');
                    xferlim.setLimits(as, 'XferTools', 'Retail', 'I:EUR', {
                        "retail_daily_amt" : "1.00",
                        "retail_daily_cnt" : 20,
                        "retail_weekly_amt" : "3.00",
                        "retail_weekly_cnt" : 40,
                        "retail_monthly_amt" : "5.00",
                        "retail_monthly_cnt" : 60,
                        "retail_min_amt" : "0.10",
                    }, {
                        "retail_daily_amt" : "0.50",
                        "retail_daily_cnt" : 10,
                        "retail_weekly_amt" : "2.50",
                        "retail_weekly_cnt" : 20,
                        "retail_monthly_amt" : "4.50",
                        "retail_monthly_cnt" : 30,
                        "retail_min_amt" : "0.11",
                    }, {
                        "retail_daily_amt" : "0.70",
                        "retail_daily_cnt" : 10,
                        "retail_weekly_amt" : "2.70",
                        "retail_weekly_cnt" : 20,
                        "retail_monthly_amt" : "4.70",
                        "retail_monthly_cnt" : 30,
                        "retail_min_amt" : "0.12",
                    } );
                    
                    const xferacct = ccm.iface('xfer.accounts');
                    xferacct.addAccountHolder( as, 'XferTools', 'XferTools', true, true, {}, {} );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add(
                (as, holder) =>
                {
                    const db = ccm.db('xfer');
                    const xt = new XferTools( ccm, 'Retail' );
                    
                    //---
                    const xfer1 = db.newXfer();
                    xt.addLimitProcessing( as, xfer1, holder, 'I:EUR', '0.21', 'retail' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "1";
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(false);
                    } );
                    as.add( (as) => xfer1.execute( as ) );
                    
                    //---
                    const xfer2 = db.newXfer();
                    xt.addLimitProcessing( as, xfer2, holder, 'I:EUR', '0.30', 'retail' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "2";
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(true);
                    } );
                    as.add( (as) => xfer2.execute( as ) );
                    
                    //---
                    const xfer3 = db.newXfer();
                    xt.addLimitProcessing( as, xfer3, holder, 'I:EUR', '0.20', 'retail' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "3";
                        expect(do_risk).to.equal(true);
                        expect(do_check).to.equal(true);
                    } );
                    as.add( (as) => xfer3.execute( as ) );
                    
                    //---
                    const xfer4 = db.newXfer();
                    xt.addLimitProcessing( as, xfer4, holder, 'I:EUR', '0.10', 'retail' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "4";
                        expect(do_risk).to.equal(true);
                        expect(do_check).to.equal(true);
                    } );
                    as.add( (as) => xfer4.execute( as ) );
                },
                (as, err) =>
                {
                    console.log(as.state.test_name);
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
            const xt = new XferTools(ccm, 'Retail');
        });

        it('process count limits', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    xferlim.setLimits(as, 'XferTools', 'Deposits', 'I:EUR', {
                        "deposit_daily_amt" : "100.00",
                        "deposit_daily_cnt" : 10,
                        "withdrawal_daily_amt" : "100.00",
                        "withdrawal_daily_cnt" : 10,
                        "deposit_weekly_amt" : "100.00",
                        "deposit_weekly_cnt" : 20,
                        "withdrawal_weekly_amt" : "100.00",
                        "withdrawal_weekly_cnt" : 20,
                        "deposit_monthly_amt" : "100.00",
                        "deposit_monthly_cnt" : 30,
                        "withdrawal_monthly_amt" : "100.00",
                        "withdrawal_monthly_cnt" : 30,
                        "deposit_min_amt" : "0.10",
                        "withdrawal_min_amt" : "100.00",
                    }, {
                        "deposit_daily_amt" : "100.00",
                        "deposit_daily_cnt" : 1,
                        "withdrawal_daily_amt" : "100.00",
                        "withdrawal_daily_cnt" : 0,
                        "deposit_weekly_amt" : "100.00",
                        "deposit_weekly_cnt" : 4,
                        "withdrawal_weekly_amt" : "100.00",
                        "withdrawal_weekly_cnt" : 4,
                        "deposit_monthly_amt" : "100.00",
                        "deposit_monthly_cnt" : 4,
                        "withdrawal_monthly_amt" : "100.00",
                        "withdrawal_monthly_cnt" : 4,
                        "deposit_min_amt" : "0.10",
                        "withdrawal_min_amt" : "100.00",
                    }, {
                        "deposit_daily_amt" : "100.00",
                        "deposit_daily_cnt" : 2,
                        "withdrawal_daily_amt" : "100.00",
                        "withdrawal_daily_cnt" : 10,
                        "deposit_weekly_amt" : "100.00",
                        "deposit_weekly_cnt" : 20,
                        "withdrawal_weekly_amt" : "100.00",
                        "withdrawal_weekly_cnt" : 20,
                        "deposit_monthly_amt" : "100.00",
                        "deposit_monthly_cnt" : 30,
                        "withdrawal_monthly_amt" : "100.00",
                        "withdrawal_monthly_cnt" : 30,
                        "deposit_min_amt" : "0.10",
                        "withdrawal_min_amt" : "100.00",
                    } );
                    
                    const xferacct = ccm.iface('xfer.accounts');
                    xferacct.addAccountHolder( as, 'XferTools2', 'XferTools', true, true, {}, {} );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add(
                (as, holder) =>
                {
                    const db = ccm.db('xfer');
                    const xt = new XferTools( ccm, 'Deposits' );
                    
                    //---
                    const xfer1 = db.newXfer();
                    xt.addLimitProcessing( as, xfer1, holder, 'I:EUR', '0.21', 'deposit' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "1";
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(false);
                    } );
                    as.add( (as) => xfer1.execute( as ) );
                    
                    //---
                    const xfer2 = db.newXfer();
                    xt.addLimitProcessing( as, xfer2, holder, 'I:EUR', '0.30', 'deposit' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "2";
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(true);
                    } );
                    as.add( (as) => xfer2.execute( as ) );
                    
                    //---
                    const xfer3 = db.newXfer();
                    xt.addLimitProcessing( as, xfer3, holder, 'I:EUR', '0.20', 'deposit' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "3";
                        expect(do_risk).to.equal(true);
                        expect(do_check).to.equal(true);
                    } );
                    as.add( (as) => xfer3.execute( as ) );
                },
                (as, err) =>
                {
                    console.log(as.state.test_name);
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
            const xt = new XferTools(ccm, 'Retail');
        });
        
        it('process limits/xfer/stats currency mismatch', function(done) {
            as.add(
                (as) =>
                {
                    const currmgr = ccm.iface('currency.manage');
                    currmgr.setExRate( as, 'I:EUR', 'I:USD', '1.01', '0.01' );
                    currmgr.setExRate( as, 'I:EUR', 'I:USD', '0.99099099099', '0.01' );
                    
                    const xferlim = ccm.iface('xfer.limits');
                    xferlim.setLimits(as, 'XferTools', 'Payments', 'I:USD', {
                        "outbound_daily_amt" : "1.02",
                        "outbound_daily_cnt" : 2,
                        "inbound_daily_amt" : "1.02",
                        "inbound_daily_cnt" : 2,
                        "outbound_weekly_amt" : "10.0",
                        "outbound_weekly_cnt" : 2,
                        "inbound_weekly_amt" : "10.0",
                        "inbound_weekly_cnt" : 2,
                        "outbound_monthly_amt" : "10.0",
                        "outbound_monthly_cnt" : 2,
                        "inbound_monthly_amt" : "10.0",
                        "inbound_monthly_cnt" : 2,
                        "outbound_min_amt" : "0"
                    }, false, false );
                    
                    const xferacct = ccm.iface('xfer.accounts');
                    xferacct.addAccountHolder( as, 'XferToolsP', 'XferTools', true, true, {}, {} );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add(
                (as, holder) =>
                {
                    const db = ccm.db('xfer');
                    const xt = new XferTools( ccm, 'Payments' );
                    
                    //---
                    const xfer1 = db.newXfer();
                    xt.addLimitProcessing( as, xfer1, holder, 'I:EUR', '1.00', 'outbound' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        as.state.test_name = "1";
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(false);
                    } );
                    as.add( (as) => xfer1.execute( as ) );
                    
                    //---
                    as.add(
                        (as) => {
                            const xfer2 = db.newXfer();
                            xt.addLimitProcessing( as, xfer2, holder, 'I:USD', '0.01', 'outbound' );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
                                as.success();
                            }
                        }
                    );
                    
                    //---
                    as.add(
                        (as) => {
                            const xfer3 = db.newXfer();
                            xt.addLimitProcessing( as, xfer3, holder, 'I:EUR', '1.01', 'inbound' );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
                                as.success();
                            }
                        }
                    );
                    
                    const xferlim = ccm.iface('xfer.limits');
                    xferlim.setLimits(as, 'XferTools', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "1.02",
                        "outbound_daily_cnt" : 2,
                        "inbound_daily_amt" : "1.02",
                        "inbound_daily_cnt" : 2,
                        "outbound_weekly_amt" : "10.0",
                        "outbound_weekly_cnt" : 2,
                        "inbound_weekly_amt" : "10.0",
                        "inbound_weekly_cnt" : 2,
                        "outbound_monthly_amt" : "10.0",
                        "outbound_monthly_cnt" : 2,
                        "inbound_monthly_amt" : "10.0",
                        "inbound_monthly_cnt" : 2,
                        "outbound_min_amt" : "0"
                    }, false, false );
                    
                    //---
                    as.add(
                        (as) => {
                            const xfer3 = db.newXfer();
                            xt.addLimitProcessing( as, xfer3, holder, 'I:EUR', '1.01', 'inbound' );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
                                as.success();
                            }
                        }
                    );
                    
                    //---
                    const xfer4 = db.newXfer();
                    xt.addLimitProcessing( as, xfer4, holder, 'I:EUR', '1.00', 'inbound' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(false);
                    } );
                    as.add( (as) => xfer4.execute( as ) );
                    
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
            const xt = new XferTools(ccm, 'Retail');
        });
    });
};
