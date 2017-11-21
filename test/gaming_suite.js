'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require('futoin-executor/Executor');
const SpecTools = require( 'futoin-invoker/SpecTools' );

// SpecTools.on('error', function() { console.log(arguments); } );


module.exports = function(describe, it, vars) {
    let as;
    let ccm;
    let executor;
    
    beforeEach('common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    });
    
    describe('Gaming', function() {
        const LimitsFace = require('../LimitsFace');
        const LimitsService = require('../LimitsService');
        const InfoFace = require('../Currency/InfoFace');
        const InfoService = require('../Currency/InfoService');
        const AccountsFace = require('../AccountsFace');
        const AccountsService = require('../AccountsService');

        const PaymentFace = require('../PaymentFace');
        const PaymentService = require('../PaymentService');
        const GamingFace = require('../GamingFace');
        const GamingService = require('../GamingService');
        
        let system_account;
        let account_holder;
        let user_account;
        let game_account;
        let user_ext_id;
        
        const checkBalance = (as, account, balance) => {
            ccm.iface('xfer.accounts').getAccount( as, account );
            as.add( (as, info) => expect(info.balance).to.equal(balance) );
        }
        
        beforeEach('payments', function() {
            as.add(
                (as) => {
                    InfoService.register(as, executor);
                    InfoFace.register(as, ccm, 'currency.info', executor);

                    LimitsService.register(as, executor);
                    LimitsFace.register(as, ccm, 'xfer.limits', executor);
                    
                    AccountsService.register(as, executor);
                    AccountsFace.register(as, ccm, 'xfer.accounts', executor);

                    PaymentService.register(as, executor);
                    PaymentFace.register(as, ccm, 'xfer.payments', executor);

                    GamingService.register(as, executor);
                    GamingFace.register(as, ccm, 'xfer.gaming', executor);
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
                    
                    xferlim.addLimitGroup(as, 'GamingUserTest');
                    
                    xferlim.setLimits(as, 'GamingUserTest', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "0.00",
                        "outbound_daily_cnt" : 0,
                        "inbound_daily_amt" : "100.00",
                        "inbound_daily_cnt" : 2,
                        "outbound_weekly_amt" : "500.00",
                        "outbound_weekly_cnt" : 100,
                        "inbound_weekly_amt" : "500.00",
                        "inbound_weekly_cnt" : 100,
                        "outbound_monthly_amt" : "10000.00",
                        "outbound_monthly_cnt" : 1000,
                        "inbound_monthly_amt" :"10000.00",
                        "inbound_monthly_cnt" : 1000,
                        "outbound_min_amt" : "0.01"
                    }, false, false );
                    xferlim.setLimits(as, 'GamingUserTest', 'Gaming', 'I:EUR', {
                        "bet_daily_amt" : "100",
                        "bet_daily_cnt" : 100,
                        "win_daily_amt" : "100",
                        "win_daily_cnt" : 100,
                        "profit_daily_amt" : "100",
                        "bet_weekly_amt" : "100",
                        "bet_weekly_cnt" : 100,
                        "win_weekly_amt" : "100",
                        "win_weekly_cnt" : 100,
                        "profit_weekly_amt" : "100",
                        "bet_monthly_amt" : "100",
                        "bet_monthly_cnt" : 100,
                        "win_monthly_amt" : "100",
                        "win_monthly_cnt" : 100,
                        "profit_monthly_amt" : "100",
                        "bet_min_amt" : "0.10"
                    }, false, false );
                    
                    xferlim.addLimitGroup(as, 'GamingSystemTest');
                    
                    xferlim.setLimits(as, 'GamingSystemTest', 'Payments', 'I:EUR', {
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
                    
                    xferacct.addAccountHolder( as, 'GamingSystem', 'GamingSystemTest', true, true, {}, {} );
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
                            'External',
                            'I:EUR',
                            'Game'
                        );
                        as.add( (as, id) => game_account = id );
                    } );          
                    
                    user_ext_id = 'GamingUser';
                    xferacct.addAccountHolder( as, user_ext_id, 'GamingUserTest', true, true, {}, {} );
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
        
        it ('should process games', function(done) {
            as.add(
                (as) =>
                {
                    const payments = ccm.iface('xfer.payments');
                    const gaming = ccm.iface('xfer.gaming');
                    
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( (as) => as.state.test_name = `On inbound ${i}` );
                        payments.onInbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '50.00',
                            'T1',
                            {},
                            moment.utc().format()
                        );
                        payments.onInbound( as,
                            game_account,
                            system_account,
                            'I:EUR',
                            '10.00',
                            'T2',
                            {},
                            moment.utc().format()
                        );
                        
                        if ( i === 0 ) {
                            checkBalance(as, user_account, '50.00');
                            checkBalance(as, game_account, '10.00');
                            checkBalance(as, system_account, '-60.00');
                        }
                        
                        as.add( (as) => as.state.test_name = `On bet #1 ${i}` );
                        as.add( (as) => {
                            gaming.bet( as,
                                user_ext_id,
                                game_account,
                                'I:EUR',
                                '0.40',
                                'B1',
                                {},
                                moment.utc().format()
                            );
                            
                            if ( i ) {
                                as.add( (as) => as.error('Fail') );
                            }
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );
                        
                        if ( i === 0 ) {
                            checkBalance(as, user_account, '49.60');
                            checkBalance(as, game_account, '10.40');
                            checkBalance(as, system_account, '-60.00');
                        }
                        
                        as.add( (as) => as.state.test_name = `On bet #2 ${i}` );
                        gaming.bet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '1.60',
                            'B2',
                            {},
                            moment.utc().format()
                        );
                        
                        if ( i === 0 ) {
                            checkBalance(as, user_account, '48.00');
                            checkBalance(as, game_account, '12.00');
                            checkBalance(as, system_account, '-60.00');
                        }
                        
                        
                        as.add( (as) => as.state.test_name = `Cancel bet #1 ${i}` );
                        gaming.cancelBet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '0.40',
                            'B1',
                            {},
                            moment.utc().format()
                        );
                        if ( i === 0 ) {
                            checkBalance(as, user_account, '48.40');
                            checkBalance(as, game_account, '11.60');
                            checkBalance(as, system_account, '-60.00');
                        }
                        
                        as.add( (as) => as.state.test_name = `On win #1 ${i}` );
                        gaming.win( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '5.00',
                            'B2',
                            'W1',
                            {},
                            moment.utc().format()
                        );
                    }

                    checkBalance(as, user_account, '53.40');
                    checkBalance(as, game_account, '6.60');
                    checkBalance(as, system_account, '-60.00');
                    
                    gaming.gameBalance( as, user_ext_id, 'I:EUR' );
                    as.add( (as, {balance } ) => expect(balance).to.equal('53.40') );

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
