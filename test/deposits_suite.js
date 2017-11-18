'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require('futoin-executor/Executor');
const SpecTools = require( 'futoin-invoker/SpecTools' );

//SpecTools.on('error', function() { console.log(arguments); } );


module.exports = function(describe, it, vars) {
    let as;
    let ccm;
    let executor;
    
    beforeEach('common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    });
    
    describe('Deposits', function() {
        const LimitsFace = require('../LimitsFace');
        const LimitsService = require('../LimitsService');
        const InfoFace = require('../Currency/InfoFace');
        const InfoService = require('../Currency/InfoService');
        const AccountsFace = require('../AccountsFace');
        const AccountsService = require('../AccountsService');

        const DepositTools = require('../DepositTools');
        const DepositFace = require('../DepositFace');
        const DepositService = require('../DepositService');
        const WithdrawFace = require('../WithdrawFace');
        const WithdrawService = require('../WithdrawService');
        
        let system_account;
        let fee_account;
        let account_holder;
        let user_account;
        
        beforeEach('deposits', function() {
            as.add(
                (as) => {
                    InfoService.register(as, executor);
                    InfoFace.register(as, ccm, 'currency.info', executor);

                    LimitsService.register(as, executor);
                    LimitsFace.register(as, ccm, 'xfer.limits', executor);
                    
                    AccountsService.register(as, executor);
                    AccountsFace.register(as, ccm, 'xfer.accounts', executor);

                    DepositService.register(as, executor);
                    DepositFace.register(as, ccm, 'xfer.deposits', executor);
                    
                    WithdrawService.register(as, executor);
                    WithdrawFace.register(as, ccm, 'xfer.withdrawals', executor);
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
            as.add(
                (as) =>
                {
                    if ( system_account ) {
                        return;
                    }
                    
                    const xferlim = ccm.iface('xfer.limits');
                    
                    xferlim.addLimitGroup(as, 'DepositTest');
                    
                    xferlim.setLimits(as, 'DepositTest', 'Deposits', 'I:EUR', {
                        "deposit_daily_amt" : "1.00",
                        "deposit_daily_cnt" : 2,
                        "withdrawal_daily_amt" : "1.00",
                        "withdrawal_daily_cnt" : 4,
                        "deposit_weekly_amt" : "1.00",
                        "deposit_weekly_cnt" : 2,
                        "withdrawal_weekly_amt" : "1.00",
                        "withdrawal_weekly_cnt" : 4,
                        "deposit_monthly_amt" : "1.00",
                        "deposit_monthly_cnt" : 2,
                        "withdrawal_monthly_amt" : "1.00",
                        "withdrawal_monthly_cnt" : 4,
                        "deposit_min_amt" : "0.10",
                        "withdrawal_min_amt" : "0.01"
                    }, {
                        "deposit_daily_amt" : "1.00",
                        "deposit_daily_cnt" : 2,
                        "withdrawal_daily_amt" : "0.50",
                        "withdrawal_daily_cnt" : 4,
                        "deposit_weekly_amt" : "1.00",
                        "deposit_weekly_cnt" : 2,
                        "withdrawal_weekly_amt" : "1.00",
                        "withdrawal_weekly_cnt" : 4,
                        "deposit_monthly_amt" : "1.00",
                        "deposit_monthly_cnt" : 2,
                        "withdrawal_monthly_amt" : "1.00",
                        "withdrawal_monthly_cnt" : 4,
                        "deposit_min_amt" : "0.10",
                        "withdrawal_min_amt" : "0.01"
                    }, false );
                    
                    xferlim.addLimitGroup(as, 'DepositSystemTest');
                    
                    xferlim.setLimits(as, 'DepositSystemTest', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "1000.00",
                        "outbound_daily_cnt" : 1000,
                        "inbound_daily_amt" : "1000.00",
                        "inbound_daily_cnt" : 1000,
                        "outbound_weekly_amt" : "5000.00",
                        "outbound_weekly_cnt" : 1000,
                        "inbound_weekly_amt" : "5000.00",
                        "inbound_weekly_cnt" : 1000,
                        "outbound_monthly_amt" : "100000.00",
                        "outbound_monthly_cnt" : 1000,
                        "inbound_monthly_amt" :"100000.00",
                        "inbound_monthly_cnt" : 1000,
                        "outbound_min_amt" : "0.01"
                    }, false, false );
                    
                    
                    //--
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder( as, 'DepositSystem', 'DepositSystemTest', true, true, {}, {} );
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
                    } );          
                    
                    xferacct.addAccountHolder( as, 'DepositsUser', 'DepositTest', true, true, {}, {} );
                    as.add( (as, holder) => {
                        account_holder = holder;
                        
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Main'
                        );
                        as.add( (as, id) => user_account = id );
                    } );
                },
                (as, err) =>
                {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
        });
        
        it ('should process deposits', function(done) {
            as.add(
                (as) =>
                {
                    const deposits = ccm.iface('xfer.deposits');
                    
                    as.add( (as) => as.state.test_name = 'Pre-check' );
                    deposits.preDepositCheck( as,
                        user_account,
                        system_account,
                        'I:EUR',
                        '1.00'
                    );
                    
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( (as) => as.state.test_name = `On deposit #1 ${i}` );
                        deposits.onDeposit( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '0.60',
                            'T1',
                            {},
                            moment.utc().format(),
                            {
                                rel_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.01',
                                reason: 'System fee',
                            }
                        );
                        
                        as.add( (as) => as.state.test_name = `On deposit no-fee #2 ${i}` );
                        deposits.onDeposit( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '0.40',
                            'T2',
                            {},
                            moment.utc().format(),
                            null
                        );
                    }
                    
                    as.add(
                        (as) => {
                            as.add( (as) => as.state.test_name = 'Pre-check #3' );
                            deposits.preDepositCheck( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '1.00'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.add( (as) => as.state.test_name = 'On deposit #3' );
                            deposits.onDeposit( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '1.00',
                                'T3',
                                {},
                                moment.utc().format(),
                                {
                                    rel_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.01',
                                    reason: 'System fee',
                                }
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
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
        
        it ('should process withdraw', function(done) {
            as.add(
                (as) =>
                {
                    const withdraw = ccm.iface('xfer.withdrawals');
                    
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( (as) => as.state.test_name = `Start withdraw #1` );
                        withdraw.startWithdrawal( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '0.10',
                            'T1',
                            {},
                            moment.utc().format(),
                            {
                                rel_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.01',
                                reason: 'System fee',
                            }
                        );
                        
                        as.add( (as, res) => {
                            expect( res.xfer_id ).to.be.ok;
                            expect( res.wait_user ).to.be.false;
                        });
                        
                        as.add( (as) => as.state.test_name = `Start withdraw #2` );
                        as.add( (as) => {
                            withdraw.startWithdrawal( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.80',
                                'T2',
                                {},
                                moment.utc().format()
                            );
                            
                            as.add( (as, res) => {
                                expect( res.xfer_id ).to.be.ok;
                                expect( res.wait_user ).to.be.true;
                                
                                as.add( (as) => as.state.test_name = `Reject withdraw #2` );
                                withdraw.rejectWithdrawal( as,
                                    res.xfer_id,
                                    user_account,
                                    system_account,
                                    'I:EUR',
                                    '0.80',
                                    moment.utc().format()
                                );
                            });
                        }, (as, err) => {
                            if ( i ) {
                                expect(err).to.equal('AlreadyCanceled');
                                as.success();
                            }
                        });
                        
                        as.add(
                            (as) => {
                                as.add( (as) => as.state.test_name = 'Start withdraw #3' );
                                withdraw.startWithdrawal( as,
                                    user_account,
                                    system_account,
                                    'I:EUR',
                                    '1.00',
                                    'T3',
                                    {},
                                    moment.utc().format()
                                );
                                as.add( (as) => as.error('Fail') );
                            },
                            (as, err) => {
                                if (err === 'NotEnoughFunds') {
                                    as.success();
                                }
                            }
                        );
                        
                        
                        as.add( (as) => as.state.test_name = `Start withdraw #4` );
                        withdraw.startWithdrawal( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '0.80',
                            'T4',
                            {},
                            moment.utc().format()
                        );
                        
                        
                        as.add( (as, res) => {
                            expect( res.xfer_id ).to.be.ok;
                            expect( res.wait_user ).to.equal(i === 0);
                            
                            as.add( (as) => as.state.test_name = `Confirm withdraw #4` );
                            withdraw.confirmWithdrawal( as,
                                res.xfer_id,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.80',
                                moment.utc().format()
                            );
                            
                            as.add(
                                (as) => {
                                    as.add( (as) => as.state.test_name = 'Reject withdraw #4' );
                                    withdraw.rejectWithdrawal( as,
                                        res.xfer_id,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '0.80',
                                        moment.utc().format()
                                    );
                                    as.add( (as) => as.error('Fail') );
                                },
                                (as, err) => {
                                    if (err === 'AlreadyCompleted') {
                                        as.success();
                                    }
                                }
                            );
                        });
                    }
                    
                    as.add(
                        (as) => {
                            as.add( (as) => as.state.test_name = 'Start withdraw #5' );
                            withdraw.startWithdrawal( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.07',
                                'T5',
                                {},
                                moment.utc().format(),
                                {
                                    rel_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.01',
                                    reason: 'System fee',
                                }
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'LimitReject') {
                                as.success();
                            }
                        }
                    );
                    
                    
                    as.add(
                        (as) => {
                            as.add( (as) => as.state.test_name = 'Confirm unknown' );
                            withdraw.confirmWithdrawal( as,
                                'aaaaaaaaaaaaaaaaaaaaaa',
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.80',
                                moment.utc().format()
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if (err === 'UnknownXferID') {
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
        
        it ('should trigger just in case checks', function(done) {
            as.add(
                (as) =>
                {
                    const dt = new DepositTools(ccm);
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Deposit cancel DB step';
                            dt._domainDbCancelStep( as, null, { type: 'Deposit' } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'NotAllowed' ) as.success();
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'Deposit cancel ext-out step';
                            dt._rawCancelExtOut( as, { type: 'Deposit' } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'NotAllowed' ) as.success();
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
    });
};
