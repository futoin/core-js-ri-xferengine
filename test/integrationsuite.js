'use strict';

const expect = require( 'chai' ).expect;

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
        executor = new Executor(ccm);
        
        executor.on('notExpected', function() {
            console.dir(arguments);
        });

        as.add(
            (as) => {
                ccm.alias('#db.xfer', '#db.evt');
                DBGenService.register( as, executor );
                DBGenFace.register( as, ccm, 'xfer.evtgen', executor );
            },
            (as, err) => {
                console.log(err);
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
            }            
        );
    });
    
    describe('Currency', function() {
        const ManageFace = require('../Currency/ManageFace');
        const InfoFace = require('../Currency/InfoFace');
        const ManageService = require('../Currency/ManageService');
        const InfoService = require('../Currency/InfoService');
        
        beforeEach('currency', function() {
            as.add(
                (as) => {
                    ManageService.register(as, executor);
                    InfoService.register(as, executor);
                    ManageFace.register(as, ccm, 'currency.manage', executor);
                    InfoFace.register(as, ccm, 'currency.info', executor);
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
        });
        
        it('should manage currencies', function(done) {
            as.add(
                (as) =>
                {
                    const currmng = ccm.iface('currency.manage');
                    currmng.setCurrency(as, 'I:EUR', 2, 'Euro', '€', true);
                    currmng.setCurrency(as, 'I:USD', 2, 'US Dollar', '$', true);
                    currmng.setCurrency(as, 'I:YEN', 0, 'Japan Yen', '¥', true);
                    currmng.setCurrency(as, 'I:YEN', 0, 'Disabled Yen', '-', false);
                    
                    const currinfo = ccm.iface('currency.info');
                    currinfo.listCurrencies(as);
                    as.add( (as, currencies) => {
                        expect(currencies).to.eql([
                            { code: 'I:EUR', dec_places: 2, name: 'Euro', symbol: '€', enabled: true },
                            { code: 'I:USD', dec_places: 2, name: 'US Dollar', symbol: '$', enabled: true },
                            { code: 'I:YEN', dec_places: 0, name: 'Disabled Yen', symbol: '-', enabled: false },
                        ]);
                    });
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should manage exrates', function(done) {
            as.add(
                (as) =>
                {
                    const currmng = ccm.iface('currency.manage');
                    currmng.setExRate(as, 'I:EUR', 'I:USD', '1.199234', '0.002');
                    currmng.setExRate(as, 'I:USD', 'I:EUR', '0.987654321', '0.003');
                    
                    const currinfo = ccm.iface('currency.info');
                    currinfo.getExRate(as, 'I:EUR', 'I:USD');
                    as.add( (as, res) => {
                        expect(res.rate).to.equal('1.199234');
                        expect(res.margin).to.equal('0.002');
                    });
                    
                    currmng.setExRate(as, 'I:EUR', 'I:USD', '1.1992345', '0.004');
                    currinfo.getExRate(as, 'I:EUR', 'I:USD');
                    as.add( (as, res) => {
                        expect(res.rate).to.equal('1.1992345');
                        expect(res.margin).to.equal('0.004');
                    });
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should detect errors', function(done) {
            as.add(
                (as) =>
                {
                    const currmng = ccm.iface('currency.manage');
                    const currinfo = ccm.iface('currency.info');
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Missing exrate pair';
                            currinfo.getExRate(as, 'I:EUR', 'I:YEN');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownPair' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Missing currency for exrate';
                            currinfo.getExRate(as, 'I:EUR', 'I:UNKNOWN');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownPair' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //---
                    as.add(
                        (as) => {
                            as.state.test_name = 'Dec place mismatch';
                            currmng.setCurrency(as, 'I:EUR', 3, 'Euro', '€', true);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DecPlaceMismatch' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //---
                    as.add(
                        (as) => {
                            as.state.test_name = 'Dup name @ insert';
                            currmng.setCurrency(as, 'I:EURA', 2, 'Euro', '€a', true);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Dup symbol @ insert';
                            currmng.setCurrency(as, 'I:EURA', 2, 'Euro2', '€', true);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );

                    
                    //---
                    currmng.setCurrency(as, 'I:EURA', 2, 'EuroB', '€b', true);
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Dup name @ update';
                            currmng.setCurrency(as, 'I:EURA', 2, 'Euro', '€a', true);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Dup symbol @ update';
                            currmng.setCurrency(as, 'I:EURA', 2, 'Euro2', '€', true);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DuplicateNameOrSymbol' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //---
                    as.add(
                        (as) => {
                            as.state.test_name = 'Unknown foreign';
                            currmng.setExRate(as, 'I:EUR', 'I:UNKNOWN', '1.199234', '0.002');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Unknown base';
                            currmng.setExRate(as, 'I:UNKNOWN', 'I:USD', '1.199234', '0.002');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //---
                    as.add(
                        (as) => {
                            as.state.test_name = 'DBGenFace';
                            ccm.unRegister('xfer.evtgen');
                            const tmpexec = new Executor(ccm);
                            GenFace.register(as, ccm, 'xfer.evtgen', executor);
                            ManageService.register(as, tmpexec);
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InternalError' ) {
                                expect(as.state.error_info).to.equal(
                                    'CCM xfet.evtgen must be instance of DBGenFace'
                                );
                                as.success();
                            }
                        }
                    );
                },
                (as, err) =>
                {
                    console.log(`Test name: ${as.state.test_name}`);
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
    });
    
    describe('Limits', function() {
        const LimitsFace = require('../LimitsFace');
        const LimitsService = require('../LimitsService');
        const InfoFace = require('../Currency/InfoFace');
        const InfoService = require('../Currency/InfoService');
        
        beforeEach('currency', function() {
            as.add(
                (as) => {
                    InfoService.register(as, executor);
                    InfoFace.register(as, ccm, 'currency.info', executor);

                    LimitsService.register(as, executor);
                    LimitsFace.register(as, ccm, 'xfer.limits', executor);
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
        });
        
        it ('should add groups', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    
                    //--
                    xferlim.getLimitGroups(as);

                    as.add( (as, res) => {
                        expect(res).to.eql([]);
                    });
                    
                    //--
                    xferlim.addLimitGroup(as, 'default');
                    xferlim.addLimitGroup(as, 'other');
                    xferlim.addLimitGroup(as, 'aaa');
                    xferlim.getLimitGroups(as);

                    as.add( (as, res) => {
                        expect(res).to.eql(['default', 'other', 'aaa']);
                    });
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it ('should detect add group errors', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.addLimitGroup(as, 'Duplicate123_-');
                            xferlim.addLimitGroup(as, 'Duplicate123_-');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'AlreadyExists' ) {
                                as.success();
                            }
                        }
                    );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it ('should set limits', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    
                    xferlim.setLimits(as, 'default', 'Retail', 'I:EUR', {
                        "retail_daily_amt" : "1.00",
                        "retail_daily_cnt" : 1,
                        "retail_weekly_amt" : "1.00",
                        "retail_weekly_cnt" : 1,
                        "retail_monthly_amt" : "1.00",
                        "retail_monthly_cnt" : 1,
                        "retail_min_amt" : "1.00"
                    }, false, false );
                    
                    xferlim.setLimits(as, 'default', 'Deposits', 'I:USD', {
                        "deposit_daily_amt" : "1.00",
                        "deposit_daily_cnt" : 1,
                        "withdrawal_daily_amt" : "1.00",
                        "withdrawal_daily_cnt" : 1,
                        "deposit_weekly_amt" : "1.00",
                        "deposit_weekly_cnt" : 1,
                        "withdrawal_weekly_amt" : "1.00",
                        "withdrawal_weekly_cnt" : 1,
                        "deposit_monthly_amt" : "1.00",
                        "deposit_monthly_cnt" : 1,
                        "withdrawal_monthly_amt" : "1.00",
                        "withdrawal_monthly_cnt" : 1,
                        "deposit_min_amt" : "1.00",
                        "withdrawal_min_amt" : "1.00"

                    }, {
                        "deposit_daily_amt" : "2.00",
                        "deposit_daily_cnt" : 2,
                        "withdrawal_daily_amt" : "2.00",
                        "withdrawal_daily_cnt" : 2,
                        "deposit_weekly_amt" : "2.00",
                        "deposit_weekly_cnt" : 2,
                        "withdrawal_weekly_amt" : "2.00",
                        "withdrawal_weekly_cnt" : 2,
                        "deposit_monthly_amt" : "2.00",
                        "deposit_monthly_cnt" : 2,
                        "withdrawal_monthly_amt" : "2.00",
                        "withdrawal_monthly_cnt" : 2,
                        "deposit_min_amt" : "2.00",
                        "withdrawal_min_amt" : "2.00"

                    }, false );
                    
                    xferlim.setLimits(as, 'default', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "1.00",
                        "outbound_daily_cnt" : 1,
                        "inbound_daily_amt" : "1.00",
                        "inbound_daily_cnt" : 1,
                        "outbound_weekly_amt" : "1.00",
                        "outbound_weekly_cnt" : 1,
                        "inbound_weekly_amt" : "1.00",
                        "inbound_weekly_cnt" : 1,
                        "outbound_monthly_amt" : "1.00",
                        "outbound_monthly_cnt" : 1,
                        "inbound_monthly_amt" : "1.00",
                        "inbound_monthly_cnt" : 1,
                        "outbound_min_amt" : "1.00",
                    }, false, false );
                    xferlim.setLimits(as, 'default', 'Gaming', 'I:EUR', {
                        "bet_daily_amt" : "1.00",
                        "bet_daily_cnt" : 1,
                        "win_daily_amt" : "1.00",
                        "win_daily_cnt" : 1,
                        "profit_daily_delta" : "1.00",
                        "bet_weekly_amt" : "1.00",
                        "bet_weekly_cnt" : 1,
                        "win_weekly_amt" : "1.00",
                        "win_weekly_cnt" : 1,
                        "profit_weekly_delta" : "1.00",
                        "bet_monthly_amt" : "1.00",
                        "bet_monthly_cnt" : 1,
                        "win_monthly_amt" : "1.00",
                        "win_monthly_cnt" : 1,
                        "profit_monthly_delta" : "1.00",
                        "bet_min_amt" : "1.00",
                    }, false, false );
                    xferlim.setLimits(as, 'default', 'Misc', 'I:EUR', {
                        "message_daily_cnt" : 1,
                        "failure_daily_cnt" : 1,
                        "limithit_daily_cnt" : 1,
                        "message_weekly_cnt" : 1,
                        "failure_weekly_cnt" : 1,
                        "limithit_weekly_cnt" : 1,
                        "message_monthly_cnt" : 1,
                        "failure_monthly_cnt" : 1,
                        "limithit_monthly_cnt" : 1
                    }, false, false );
                    xferlim.setLimits(as, 'default', 'Personnel', 'I:EUR', {
                        "message_daily_cnt" : 1,
                        "manual_daily_amt" : "1.00",
                        "manual_daily_cnt" : 1,
                        "message_weekly_cnt" : 1,
                        "manual_weekly_amt" : "1.00",
                        "manual_weekly_cnt" : 1,
                        "message_monthly_cnt" : 1,
                        "manual_monthly_amt" : "1.00",
                        "manual_monthly_cnt" : 1
                    }, false, {
                        "message_daily_cnt" : 3,
                        "manual_daily_amt" : "3.00",
                        "manual_daily_cnt" : 3,
                        "message_weekly_cnt" : 3,
                        "manual_weekly_amt" : "3.00",
                        "manual_weekly_cnt" : 3,
                        "message_monthly_cnt" : 3,
                        "manual_monthly_amt" : "3.00",
                        "manual_monthly_cnt" : 3
                    } );
                    
                    //----------
                    
                    
                    xferlim.getLimits(as, 'default', 'Retail');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:EUR',
                        hard: {
                            "retail_daily_amt" : "1.00",
                            "retail_daily_cnt" : 1,
                            "retail_weekly_amt" : "1.00",
                            "retail_weekly_cnt" : 1,
                            "retail_monthly_amt" : "1.00",
                            "retail_monthly_cnt" : 1,
                            "retail_min_amt" : "1.00"
                        },
                        check: false,
                        risk: false
                    }));
                    
                    xferlim.getLimits(as, 'default', 'Deposits');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:USD',
                        hard: {
                            "deposit_daily_amt" : "1.00",
                            "deposit_daily_cnt" : 1,
                            "withdrawal_daily_amt" : "1.00",
                            "withdrawal_daily_cnt" : 1,
                            "deposit_weekly_amt" : "1.00",
                            "deposit_weekly_cnt" : 1,
                            "withdrawal_weekly_amt" : "1.00",
                            "withdrawal_weekly_cnt" : 1,
                            "deposit_monthly_amt" : "1.00",
                            "deposit_monthly_cnt" : 1,
                            "withdrawal_monthly_amt" : "1.00",
                            "withdrawal_monthly_cnt" : 1,
                            "deposit_min_amt" : "1.00",
                            "withdrawal_min_amt" : "1.00"

                        },
                        check: {
                            "deposit_daily_amt" : "2.00",
                            "deposit_daily_cnt" : 2,
                            "withdrawal_daily_amt" : "2.00",
                            "withdrawal_daily_cnt" : 2,
                            "deposit_weekly_amt" : "2.00",
                            "deposit_weekly_cnt" : 2,
                            "withdrawal_weekly_amt" : "2.00",
                            "withdrawal_weekly_cnt" : 2,
                            "deposit_monthly_amt" : "2.00",
                            "deposit_monthly_cnt" : 2,
                            "withdrawal_monthly_amt" : "2.00",
                            "withdrawal_monthly_cnt" : 2,
                            "deposit_min_amt" : "2.00",
                            "withdrawal_min_amt" : "2.00"

                        },
                        risk: false
                    }));
                    
                    xferlim.getLimits(as, 'default', 'Payments');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:EUR',
                        hard: {
                            "outbound_daily_amt" : "1.00",
                            "outbound_daily_cnt" : 1,
                            "inbound_daily_amt" : "1.00",
                            "inbound_daily_cnt" : 1,
                            "outbound_weekly_amt" : "1.00",
                            "outbound_weekly_cnt" : 1,
                            "inbound_weekly_amt" : "1.00",
                            "inbound_weekly_cnt" : 1,
                            "outbound_monthly_amt" : "1.00",
                            "outbound_monthly_cnt" : 1,
                            "inbound_monthly_amt" : "1.00",
                            "inbound_monthly_cnt" : 1,
                            "outbound_min_amt" : "1.00",
                        },
                        check: false,
                        risk: false
                    }));
                    
                    xferlim.getLimits(as, 'default', 'Gaming');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:EUR',
                        hard: {
                            "bet_daily_amt" : "1.00",
                            "bet_daily_cnt" : 1,
                            "win_daily_amt" : "1.00",
                            "win_daily_cnt" : 1,
                            "profit_daily_delta" : "1.00",
                            "bet_weekly_amt" : "1.00",
                            "bet_weekly_cnt" : 1,
                            "win_weekly_amt" : "1.00",
                            "win_weekly_cnt" : 1,
                            "profit_weekly_delta" : "1.00",
                            "bet_monthly_amt" : "1.00",
                            "bet_monthly_cnt" : 1,
                            "win_monthly_amt" : "1.00",
                            "win_monthly_cnt" : 1,
                            "profit_monthly_delta" : "1.00",
                            "bet_min_amt" : "1.00",
                        },
                        check: false,
                        risk: false
                    }));
                    
                    xferlim.getLimits(as, 'default', 'Misc');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:EUR',
                        hard: {
                            "message_daily_cnt" : 1,
                            "failure_daily_cnt" : 1,
                            "limithit_daily_cnt" : 1,
                            "message_weekly_cnt" : 1,
                            "failure_weekly_cnt" : 1,
                            "limithit_weekly_cnt" : 1,
                            "message_monthly_cnt" : 1,
                            "failure_monthly_cnt" : 1,
                            "limithit_monthly_cnt" : 1
                        },
                        check: false,
                        risk: false
                    }));
                    
                    xferlim.getLimits(as, 'default', 'Personnel');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:EUR',
                        hard: {
                            "message_daily_cnt" : 1,
                            "manual_daily_amt" : "1.00",
                            "manual_daily_cnt" : 1,
                            "message_weekly_cnt" : 1,
                            "manual_weekly_amt" : "1.00",
                            "manual_weekly_cnt" : 1,
                            "message_monthly_cnt" : 1,
                            "manual_monthly_amt" : "1.00",
                            "manual_monthly_cnt" : 1
                        },
                        check: false,
                        risk: {
                            "message_daily_cnt" : 3,
                            "manual_daily_amt" : "3.00",
                            "manual_daily_cnt" : 3,
                            "message_weekly_cnt" : 3,
                            "manual_weekly_amt" : "3.00",
                            "manual_weekly_cnt" : 3,
                            "message_monthly_cnt" : 3,
                            "manual_monthly_amt" : "3.00",
                            "manual_monthly_cnt" : 3
                        },
                    }));
                    
                    //--------
                    
                    xferlim.setLimits(as, 'default', 'Personnel', 'I:EUR', {
                        "message_daily_cnt" : 4,
                        "manual_daily_amt" : "5.00",
                        "manual_daily_cnt" : 6,
                        "message_weekly_cnt" : 7,
                        "manual_weekly_amt" : "8.00",
                        "manual_weekly_cnt" : 9,
                        "message_monthly_cnt" : 10,
                        "manual_monthly_amt" : "11.00",
                        "manual_monthly_cnt" : 12
                    }, false, false );
                    xferlim.getLimits(as, 'default', 'Personnel');
                    as.add( (as, res) => expect(res).to.eql({
                        currency: 'I:EUR',
                        hard: {
                            "message_daily_cnt" : 4,
                            "manual_daily_amt" : "5.00",
                            "manual_daily_cnt" : 6,
                            "message_weekly_cnt" : 7,
                            "manual_weekly_amt" : "8.00",
                            "manual_weekly_cnt" : 9,
                            "message_monthly_cnt" : 10,
                            "manual_monthly_amt" : "11.00",
                            "manual_monthly_cnt" : 12
                        },
                        check: false,
                        risk: false,
                    }));
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        } );
        
        it ('should detect sett limits errors', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.setLimits(as, 'UnknowGroup', 'Misc', 'I:EUREKA', {
                                "message_daily_cnt" : 1,
                                "failure_daily_cnt" : 1,
                                "limithit_daily_cnt" : 1,
                                "message_weekly_cnt" : 1,
                                "failure_weekly_cnt" : 1,
                                "limithit_weekly_cnt" : 1,
                                "message_monthly_cnt" : 1,
                                "failure_monthly_cnt" : 1,
                                "limithit_monthly_cnt" : 1
                            }, false, false );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownGroup' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.setLimits(as, 'default', 'Misc', 'I:EUREKA', {
                                "message_daily_cnt" : 1,
                                "failure_daily_cnt" : 1,
                                "limithit_daily_cnt" : 1,
                                "message_weekly_cnt" : 1,
                                "failure_weekly_cnt" : 1,
                                "limithit_weekly_cnt" : 1,
                                "message_monthly_cnt" : 1,
                                "failure_monthly_cnt" : 1,
                                "limithit_monthly_cnt" : 1
                            }, false, false );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownCurrency' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.setLimits(as, 'default', 'Misc', 'I:EUR', {
                                "message_daily_cnt" : 1,
                                "failure_daily_cnt" : 1,
                                "limithit_daily_cnt" : 1,
                                "message_weekly_cnt" : 1,
                                "failure_weekly_cnt" : 1,
                                "limithit_weekly_cnt" : 1,
                                "message_monthly_cnt" : 1,
                                "failure_monthly_cnt" : 1
                            }, false, {} );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InvalidRequest' ) {
                                expect(as.state.error_info).to.equal(
                                    'Hard limits do not match MiscLimitValues'
                                );
                                as.success();
                            }
                        }
                    );
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.setLimits(as, 'default', 'Misc', 'I:EUR', {
                                "message_daily_cnt" : 1,
                                "failure_daily_cnt" : 1,
                                "limithit_daily_cnt" : 1,
                                "message_weekly_cnt" : 1,
                                "failure_weekly_cnt" : 1,
                                "limithit_weekly_cnt" : 1,
                                "message_monthly_cnt" : 1,
                                "failure_monthly_cnt" : 1,
                                "limithit_monthly_cnt" : 1
                            }, {}, false );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InvalidRequest' ) {
                                expect(as.state.error_info).to.equal(
                                    'Check limits do not match MiscLimitValues'
                                );
                                as.success();
                            }
                        }
                    );
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.setLimits(as, 'default', 'Misc', 'I:EUR', {
                                "message_daily_cnt" : 1,
                                "failure_daily_cnt" : 1,
                                "limithit_daily_cnt" : 1,
                                "message_weekly_cnt" : 1,
                                "failure_weekly_cnt" : 1,
                                "limithit_weekly_cnt" : 1,
                                "message_monthly_cnt" : 1,
                                "failure_monthly_cnt" : 1,
                                "limithit_monthly_cnt" : 1
                            }, false, {} );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InvalidRequest' ) {
                                expect(as.state.error_info).to.equal(
                                    'Risk limits do not match MiscLimitValues'
                                );
                                as.success();
                            }
                        }
                    );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        } );
        
        it ('should detect get limits errors', function(done) {
            as.add(
                (as) =>
                {
                    const xferlim = ccm.iface('xfer.limits');
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.addLimitGroup(as, 'KnowGroup');
                            xferlim.getLimits(as, 'KnowGroup', 'Retail');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'LimitsNotSet' ) {
                                as.success();
                            }
                        }
                    );
                    
                    //--
                    as.add(
                        (as) => {
                            xferlim.getLimits(as, 'UnknowGroup', 'Retail');
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'LimitsNotSet' ) {
                                as.success();
                            }
                        }
                    );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception);
                }
            );
            as.add( (as) => done() );
            as.execute();
        } );
    });
};
