'use strict';


const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require('futoin-executor/Executor');
const GenFace = require( 'futoin-eventstream/GenFace' );
const DBGenFace = require( 'futoin-eventstream/DBGenFace' );
const DBGenService = require( 'futoin-eventstream/DBGenService' );
const SpecTools = require( 'futoin-invoker/SpecTools' );
const $as = require( 'futoin-asyncsteps' );

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
                        "outbound_daily_cnt" : 3,
                        "inbound_daily_amt" : "1.02",
                        "inbound_daily_cnt" : 3,
                        "outbound_weekly_amt" : "10.0",
                        "outbound_weekly_cnt" : 3,
                        "inbound_weekly_amt" : "10.0",
                        "inbound_weekly_cnt" : 3,
                        "outbound_monthly_amt" : "10.0",
                        "outbound_monthly_cnt" : 3,
                        "inbound_monthly_amt" : "10.0",
                        "inbound_monthly_cnt" : 3,
                        "outbound_min_amt" : "0"
                    }, false, false );
                    
                    // try over limit
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
                    
                    // try limit
                    //---
                    const xfer4 = db.newXfer();
                    xt.addLimitProcessing( as, xfer4, holder, 'I:EUR', '1.00', 'inbound' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(false);
                    } );
                    as.add( (as) => xfer4.execute( as ) );
                    
                    
                    // try over limit
                    //---
                    as.add(
                        (as) => {
                            const xfer3 = db.newXfer();
                            xt.addLimitProcessing( as, xfer3, holder, 'I:EUR', '0.01', 'inbound' );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
                                as.success();
                            }
                        }
                    );
                    
                    // cancel stats
                    //---
                    const xfer5 = db.newXfer();
                    xt.addStatsCancel( as, xfer5, holder, moment.utc(), 'I:EUR', '1.00', 'inbound' );
                    as.add( (as) => xfer5.execute( as ) );                                            
                    
                    // try limit again
                    //---
                    const xfer6 = db.newXfer();
                    xt.addLimitProcessing( as, xfer6, holder, 'I:EUR', '1.00', 'inbound' );
                    
                    as.add( (as, { do_risk, do_check } ) => {
                        expect(do_risk).to.equal(false);
                        expect(do_check).to.equal(false);
                    } );
                    as.add( (as) => xfer6.execute( as ) );
                    
                    // Check cnt statistics
                    //---
                    db.select('limit_payments_stats').where({holder}).executeAssoc(as);
                    as.add( (as, rows) => {
                        // xfer + cancel + xfer
                        expect(rows[0].inbound_daily_cnt).to.eql(3);
                    });

                    
                    // cancel stats
                    //---
                    {
                        const xfer = db.newXfer();
                        xt.addStatsCancel( as, xfer, holder,
                                           moment.utc().startOf('month').subtract(1, 'day'),
                                           'I:EUR', '1.00', 'inbound' );
                        xt.addStatsCancel( as, xfer, holder,
                                           moment.utc().startOf('week').subtract(1, 'day'),
                                           'I:EUR', '1.00', 'inbound' );
                        xt.addStatsCancel( as, xfer, holder,
                                           moment.utc().subtract(1, 'day'),
                                           'I:EUR', '1.00', 'inbound' );
                    }
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
        
            
        let system_account;
        let first_account;
        let second_account
        let external_account;
        let first_transit;
        let second_transit;
        let disabled_account;
        let fee_account;
        
        const check_balance = ( as, account, req ) => {
            ccm.db('xfer').select('accounts')
                .where('uuidb64', account)
                .executeAssoc(as);
            as.add( (as, rows) => expect(`${rows[0].balance}`).to.eql(req) );            
        };

        beforeEach('xferaccounts', function() {
            as.add(
                (as) =>
                {
                    // once only, but DB connection is required
                    if (system_account) {
                        return;
                    }
                    
                    const xferlim = ccm.iface('xfer.limits');
                    xferlim.addLimitGroup(as, 'SimpleXfer');
                    
                    const currmgr = ccm.iface('currency.manage');
                    currmgr.setCurrency(as, 'L:XFRT', 3, 'Xfer Test Currency', 'XFT', true);
                    currmgr.setExRate(as, 'I:EUR', 'L:XFRT', '1.500', '0.05');
                    
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder( as, 'SimpleXfer', 'SimpleXfer', true, true, {}, {} );
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'Source'
                        );
                        as.add( (as, id) => system_account = id );
                        
                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'Fee'
                        );
                        as.add( (as, id) => fee_account = id );
                        
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'First'
                        );
                        as.add( (as, id) => first_account = id );
                        
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Second'
                        );
                        as.add( (as, id) => second_account = id );
                        
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Disabled',
                            false
                        );
                        as.add( (as, id) => disabled_account = id );
                        
                        xferacct.addAccount(
                            as,
                            holder,
                            'External',
                            'I:EUR',
                            'Ext'
                        );
                        as.add( (as, id) => {
                            external_account = id;
                            xferacct.addAccount(
                                as,
                                holder,
                                'Transit',
                                'I:EUR',
                                'Transit First',
                                true,
                                `transit1`,
                                external_account,
                            );
                            as.add( (as, id) => first_transit = id );
                            
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
                            as.add( (as, id) => second_transit = id );
                        });
                    } );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
        } );
        
        it('should process simple xfer', function(done) {
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
                (as) =>
                {
                    const db = ccm.db('xfer');
                    
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                    } );

                    check_balance(as, first_account, '410');
                    
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '6',
                        type: 'Deposit',
                    } );

                    check_balance(as, first_account, '1010');
                    
                    //---
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_account,
                        currency: 'I:EUR',
                        amount: '10.10',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, first_account, '0');
                    check_balance(as, second_account, '1010');

                    //---
                    dxt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.10',
                        type: 'Withdrawal',
                    } );
                    
                    check_balance(as, second_account, '0');

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
        });
        
        it('should process simple xfer with exrate', function(done) {
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
                (as) =>
                {
                    const db = ccm.db('xfer');
                    
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'L:XFRT',
                        amount: '10.10',
                        type: 'Deposit',
                    } );
                    
                    check_balance(as, first_account, '650');
                    
                    //---
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_account,
                        currency: 'I:EUR',
                        amount: '6.50',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, first_account, '0');
                    check_balance(as, second_account, '650');
                    
                    //---
                    dxt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        currency: 'L:XFRT',
                        amount: '9.43',
                        type: 'Withdrawal',
                    } );
                    
                    check_balance(as, second_account, '0');
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
        });
        
        it('should process transit xfers', function(done) {
            const pxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }

                _domainExtIn( as, _in_xfer ) {
                    as.add( (as) => {} );
                }

                _domainExtOut( as, _out_xfer ) {
                    as.add( (as) => {} );
                }
            };
            
            as.add(
                (as) =>
                {
                    const db = ccm.db('xfer');
                    
                    pxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, external_account, '1000');
                    
                    //--
                    as.add( (as) => as.state.test_name = 'Transit Int' );
                    pxt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                    } );

                    check_balance(as, external_account, '900');
                    check_balance(as, first_transit, '0');
                    check_balance(as, first_account, '100');
                    
                    //---
                    as.add( (as) => as.state.test_name = 'Transit Out' );
                    pxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                    } );

                    check_balance(as, first_account, '0');
                    check_balance(as, second_transit, '0');
                    check_balance(as, external_account, '1000');
                    
                    //---
                    as.add( (as) => as.state.test_name = 'Transit In-Out' );
                    pxt.processXfer( as, {
                        src_account: first_transit,
                        dst_account: second_transit,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                    } );

                    check_balance(as, first_transit, '0');
                    check_balance(as, second_transit, '0');
                    check_balance(as, external_account, '1000');
                    
                    //---
                    pxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, external_account, '0');

                    //---
                    as.add( (as) => as.state.test_name = 'Ensure all xfers Done' );
                    db.select( 'active_xfers' ).where('xfer_status !=', 'Done').execute(as);
                    as.add( (as, { rows } ) => expect(rows.length).to.equal(0));
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
        });
        
        it('should process ext_id', function(done) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };
            
            as.add(
                (as) =>
                {
                    const db = ccm.db('xfer');
                    
                    //
                    as.add( (as) => as.state.test_name = 'setup' );
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, external_account, '1000');
                    
                    //
                    as.add( (as) => as.state.test_name = 'initial' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R1'),
                    } );

                    check_balance(as, external_account, '590');
                    check_balance(as, first_account, '410');
                    
                    //
                    as.add( (as) => as.state.test_name = 'repeat first #1' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'R1'),
                        orig_ts: moment.utc().format(),
                    } );

                    check_balance(as, external_account, '590');
                    check_balance(as, first_account, '410');
                    
                    //
                    as.add( (as) => as.state.test_name = 'second' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.90',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R2'),
                    } );

                    check_balance(as, external_account, '0');
                    check_balance(as, first_account, '1000');
                    
                    //
                    as.add( (as) => as.state.test_name = 'repeat first #2' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '4.10',
                        type: 'Deposit',
                        ext_id: dxt.makeExtId( external_account, 'R1'),
                        orig_ts: moment.utc().format(),
                    } );

                    check_balance(as, external_account, '0');
                    check_balance(as, first_account, '1000');
                    
                    //
                    as.add( (as) => as.state.test_name = 'repeat second #1' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.90',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R2'),
                    } );

                    check_balance(as, external_account, '0');
                    check_balance(as, first_account, '1000');
                    
                    //
                    as.add( (as) => as.state.test_name = 'third' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Withdrawal',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R3'),
                    } );

                    check_balance(as, external_account, '1000');
                    check_balance(as, first_account, '0');
                    
                    //
                    as.add( (as) => as.state.test_name = 'repeat second #2' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '5.90',
                        type: 'Deposit',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R2'),
                    } );
                    
                    //
                    as.add( (as) => as.state.test_name = 'repeat third' );
                    dxt.processXfer( as, {
                        src_account: first_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Withdrawal',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( external_account, 'R3'),
                    } );

                    check_balance(as, external_account, '1000');
                    check_balance(as, first_account, '0');
                    
                    //
                    as.add( (as) => as.state.test_name = 'cleanup' );
                    dxt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, external_account, '0');

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
        });
        
        it('should detect xfer errors', function(done) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };
            
            as.add(
                (as) =>
                {
                    //=================
                    as.add( (as) => as.state.test_name = 'not enough funds' );
                    
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '2.00',
                        type: 'Deposit'
                    } );
                    
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: first_account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '4.10',
                                type: 'Deposit'
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
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
                        type: 'Deposit'
                    } );
                    
                    //=================
                    as.add( (as) => as.state.test_name = 'ext_id format' );
                    
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: external_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '4.10',
                                type: 'Deposit',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( '123', 'R1'),
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InternalError' ) {
                                expect(as.state.error_info).to.equal(
                                    'Invalid external ID format'
                                );
                                as.success();
                            }
                        }
                    );
                    
                    //=================
                    as.add( (as) => as.state.test_name = 'too old' );
                    
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: external_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '4.10',
                                type: 'Deposit',
                                orig_ts: '2017-01-01',
                                ext_id: dxt.makeExtId( external_account, 'R1'),
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'OriginalTooOld' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //=================
                    as.add( (as) => as.state.test_name = 'original mismatch' );
                    
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        orig_ts: moment.utc().format(),
                        ext_id: dxt.makeExtId( system_account, 'OM1'),
                    } );
                    
                    as.add( (as) => as.state.test_name = 'original mismatch account' );
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: first_account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( system_account, 'OM1'),
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add( (as) => as.state.test_name = 'original mismatch currency' );
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: system_account,
                                currency: 'I:USD',
                                amount: '1.00',
                                type: 'Generic',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( system_account, 'OM1'),
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add( (as) => as.state.test_name = 'original mismatch amount' );
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '1.01',
                                type: 'Generic',
                                orig_ts: moment.utc().format(),
                                ext_id: dxt.makeExtId( system_account, 'OM1'),
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );
                    //=================
                    as.add( (as) => as.state.test_name = 'Unknown Account ID' );
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {
                                src_account: system_account,
                                dst_account: 'missingmissingmissing1',
                                currency: 'I:EUR',
                                amount: '1.01',
                                type: 'Generic',
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //=================
                    as.add( (as) => as.state.test_name = 'XferTool callback' );
                    const tmpxt = new XferTools( ccm, 'Deposits' );
                    
                    tmpxt._domainDbStep();
                    
                    as.add(
                        (as) => {
                            tmpxt._domainExtIn(as);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'NotImplemented' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            tmpxt._domainExtOut(as);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'NotImplemented' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //=================
                    as.add( (as) => as.state.test_name = 'Invalid xfer data' );
                    
                    as.add(
                        (as) => {
                            dxt.processXfer( as, {} );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InternalError' ) {
                                expect(as.state.error_info).to.equal(
                                    'Invalid xfer data'
                                );
                                as.success();
                            }
                        }
                    );
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
        });
        
        it('should process forced xfers', function(done) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Payments' );
                }
            };
            
            as.add(
                (as) =>
                {
                    // 
                    as.add( (as) => as.state.test_name = 'to disabled' );
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: disabled_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic'
                    } );
                    check_balance(as, disabled_account, '100');
                    
                    //
                    as.add( (as) => as.state.test_name = 'from disabled' );
                    as.add(
                        (as) => {
                            xt.processXfer( as, {
                                src_account: disabled_account,
                                dst_account: system_account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic'
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DisabledAccount' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //
                    as.add( (as) => as.state.test_name = 'from disabled forced' );
                    xt.processXfer( as, {
                        src_account: disabled_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Generic',
                        force: true,
                    } );
                    check_balance(as, disabled_account, '0');
                    
                    //
                    as.add( (as) => as.state.test_name = 'from disabled holder' );
                    const xferacct = ccm.iface('xfer.accounts');
                    xferacct.addAccountHolder( as, 'Disabled', 'SimpleXfer', false, true, {}, {} );
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Enabled',
                            true
                        );
                        as.add( (as, account) => {
                            check_balance(as, account, '0');
                            
                            xt.processXfer( as, {
                                src_account: system_account,
                                dst_account: account,
                                currency: 'I:EUR',
                                amount: '1.00',
                                type: 'Generic',
                            } );
                            
                            as.add(
                                (as) => {
                                    xt.processXfer( as, {
                                        src_account: account,
                                        dst_account: system_account,
                                        currency: 'I:EUR',
                                        amount: '1.00',
                                        type: 'Generic',
                                    } );
                                    as.add( (as) => as.error('Fail') );
                                },
                                (as, err) => {
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
                            } );
                        } );
                    } );
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
        });
        
        it('should process user confirmation', function(done) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };
            
            as.add(
                (as) =>
                {

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
        });
        
        it('should process extra fee', function(done) {
            const dxt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
            };
            
            as.add(
                (as) =>
                {
                    //=================
                    as.add( (as) => as.state.test_name = 'simple' );
                    dxt.processXfer( as, {
                        src_account: system_account,
                        dst_account: first_account,
                        currency: 'I:EUR',
                        amount: '1.20',
                        type: 'Deposit',
                    } );
                    check_balance(as, first_account, '120');
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
                        }
                    } );
                    check_balance(as, first_account, '0');
                    check_balance(as, second_account, '100');
                    check_balance(as, fee_account, '20');
                    
                    dxt.processXfer( as, {
                        src_account: second_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '1.00',
                        type: 'Withdrawal',
                    } );
                    dxt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.20',
                        type: 'Generic',
                    } );
                    check_balance(as, second_account, '0');
                    check_balance(as, fee_account, '0');
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
        });

        it('should process extra fee with tansit accounts', function(done) {
            const xt = new class extends XferTools {
                constructor() {
                    super( ccm, 'Deposits' );
                }
                
                _feeExtIn () {
                    // noop
                }
                
                _domainExtIn() {
                    // noop
                }
                
                _domainExtOut() {
                    // noop
                }
            };
            
            as.add(
                (as) =>
                {
                    
                    xt.processXfer( as, {
                        src_account: system_account,
                        dst_account: external_account,
                        currency: 'I:EUR',
                        amount: '10.00',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, external_account, '1000');
                    
                    //--
                    as.add( (as) => as.state.test_name = 'Transit Int' );
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
                        }
                    } );

                    check_balance(as, external_account, '780');
                    check_balance(as, first_transit, '0');
                    check_balance(as, first_account, '200');
                    check_balance(as, fee_account, '20');
                    
                    //---
                    as.add( (as) => as.state.test_name = 'Transit Out' );
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
                        }
                    } );

                    check_balance(as, first_account, '0');
                    check_balance(as, second_transit, '0');
                    check_balance(as, external_account, '960');
                    check_balance(as, fee_account, '40');
                    
                    //---
                    as.add( (as) => as.state.test_name = 'Transit In-Out' );
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
                        }
                    } );

                    check_balance(as, first_transit, '0');
                    check_balance(as, second_transit, '0');
                    check_balance(as, external_account, '940');
                    check_balance(as, fee_account, '60');
                    
                    //---
                    xt.processXfer( as, {
                        src_account: external_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '9.40',
                        type: 'Generic',
                    } );
                    
                    xt.processXfer( as, {
                        src_account: fee_account,
                        dst_account: system_account,
                        currency: 'I:EUR',
                        amount: '0.60',
                        type: 'Generic',
                    } );
                    
                    check_balance(as, external_account, '0');
                    check_balance(as, fee_account, '0');

                    //---
                    as.add( (as) => as.state.test_name = 'Ensure all xfers Done' );
                    ccm.db('xfer').select( 'active_xfers' ).where('xfer_status !=', 'Done').execute(as);
                    as.add( (as, { rows } ) => expect(rows.length).to.equal(0));
                    //ccm.db('xfer').select( 'active_xfers' ).where('xfer_type', 'Fee').executeAssoc(as);
                    //as.add( (as, rows ) => console.log(rows));
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
        });
    });
};
