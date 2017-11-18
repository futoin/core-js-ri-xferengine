'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require('futoin-executor/Executor');
const SpecTools = require( 'futoin-invoker/SpecTools' );


module.exports = function(describe, it, vars) {
    let as;
    let ccm;
    let executor;
    
    beforeEach('common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    });
    
    describe('PeerComm', function() {
        const LimitsFace = require('../LimitsFace');
        const LimitsService = require('../LimitsService');
        const InfoFace = require('../Currency/InfoFace');
        const InfoService = require('../Currency/InfoService');
        const AccountsFace = require('../AccountsFace');
        const AccountsService = require('../AccountsService');

        const DepositFace = require('../DepositFace');
        const DepositService = require('../DepositService');
        const WithdrawFace = require('../WithdrawFace');
        const WithdrawService = require('../WithdrawService');
        const PaymentFace = require('../PaymentFace');
        const PaymentService = require('../PaymentService');
        const PeerFace = require('../PeerFace');
        const PeerService = require('../PeerService');
        const BasicAuthFace = require('futoin-executor/BasicAuthFace');
        const BasicAuthService = require('futoin-executor/BasicAuthService');
        
        const XferTools = require('../XferTools');
        
        let system_account;
        let peer_external;
        let source_account;
        let sink_account;
        let source_transit;
        let sink_transit;
        
        beforeEach('peerxfer', function() {
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
                    
                    PaymentService.register(as, executor);
                    PaymentFace.register(as, ccm, 'xfer.payments', executor);

                    PeerService.register(as, executor);
                    PeerFace.register(as, ccm, 'xfer.peer1', executor, 'peer2:pwd');
                    
                    const basvc = BasicAuthService.register(as, executor);
                    basvc.addUser('peer1', 'pwd', null, true);
                    basvc._user_ids[ 1 ].info.global_id = 'peer1';
                    basvc.addUser('peer2', 'pwd', null, true);
                    basvc._user_ids[ 2 ].info.global_id = 'peer2';
                    
                    BasicAuthFace.register(as, ccm, executor);

                    // mock
                    ccm.xferIface = function(as, iface, name) {
                        switch (iface) {
                            case 'futoin.xfer.deposit': iface = 'xfer.deposits'; break;
                            case 'futoin.xfer.peer': iface = 'xfer.peer1'; break;
                        }
                        
                        as.add( (as) => as.success( this.iface(iface)) );
                    };
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
        });
        
        it ('should pair peer', function(done) {
            as.add(
                (as) =>
                {
                    as.add( (as) => as.state.test_name = 'Adding limits' );
                    const xferlim = ccm.iface('xfer.limits');
                    
                    xferlim.addLimitGroup(as, 'DefaultPeer');
     
                    xferlim.setLimits(as, 'DefaultPeer', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "0.00",
                        "outbound_daily_cnt" : 0,
                        "inbound_daily_amt" : "0.00",
                        "inbound_daily_cnt" : 0,
                        "outbound_weekly_amt" : "0.00",
                        "outbound_weekly_cnt" : 0,
                        "inbound_weekly_amt" : "0.00",
                        "inbound_weekly_cnt" : 0,
                        "outbound_monthly_amt" : "0.00",
                        "outbound_monthly_cnt" : 0,
                        "inbound_monthly_amt" : "0.00",
                        "inbound_monthly_cnt" : 0,
                        "outbound_min_amt" : "0.00",
                    }, false, false );
                    
                    xferlim.addLimitGroup(as, 'PeerTest');

                    xferlim.setLimits(as, 'PeerTest', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "1000.00",
                        "outbound_daily_cnt" : 1000,
                        "inbound_daily_amt" : "1000.00",
                        "inbound_daily_cnt" : 1000,
                        "outbound_weekly_amt" : "1000.00",
                        "outbound_weekly_cnt" : 1000,
                        "inbound_weekly_amt" : "1000.00",
                        "inbound_weekly_cnt" : 1000,
                        "outbound_monthly_amt" : "1000.00",
                        "outbound_monthly_cnt" : 1000,
                        "inbound_monthly_amt" : "1000.00",
                        "inbound_monthly_cnt" : 1000,
                        "outbound_min_amt" : "1.00",
                    }, false, false );
                    
                    xferlim.setLimits(as, 'PeerTest', 'Deposits', 'I:EUR', {
                        "deposit_daily_amt" : "100.00",
                        "deposit_daily_cnt" : 2,
                        "withdrawal_daily_amt" : "100.00",
                        "withdrawal_daily_cnt" : 0,
                        "deposit_weekly_amt" : "100.00",
                        "deposit_weekly_cnt" : 2,
                        "withdrawal_weekly_amt" : "100.00",
                        "withdrawal_weekly_cnt" : 0,
                        "deposit_monthly_amt" : "100.00",
                        "deposit_monthly_cnt" : 2,
                        "withdrawal_monthly_amt" : "100.00",
                        "withdrawal_monthly_cnt" : 0,
                        "deposit_min_amt" : "0.10",
                        "withdrawal_min_amt" : "100.00",
                    }, false, false );
                    
                    xferlim.addLimitGroup(as, 'PeerUserTest');
                    
                    xferlim.setLimits(as, 'PeerUserTest', 'Payments', 'I:EUR', {
                        "outbound_daily_amt" : "100.00",
                        "outbound_daily_cnt" : 10,
                        "inbound_daily_amt" : "100.00",
                        "inbound_daily_cnt" : 10,
                        "outbound_weekly_amt" : "100.00",
                        "outbound_weekly_cnt" : 10,
                        "inbound_weekly_amt" : "100.00",
                        "inbound_weekly_cnt" : 10,
                        "outbound_monthly_amt" : "100.00",
                        "outbound_monthly_cnt" : 10,
                        "inbound_monthly_amt" : "100.00",
                        "inbound_monthly_cnt" : 10,
                        "outbound_min_amt" : "1.00",
                    }, false, false );
                    
                    
                    //--
                    const xferacct = ccm.iface('xfer.accounts');
                    const xt = new XferTools(ccm, 'Payments');
                    
                    //SpecTools.on('error', function() { console.log(arguments); } );

                    //---
                    as.add( (as) => as.state.test_name = 'Regular accounts on "Peer1"' );
                    xferacct.addAccountHolder( as, 'Peer1 Holder', 'PeerTest', true, true, {}, {} );
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Source',
                            true
                        );
                        as.add( (as, id) => source_account = id );
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Sink',
                            true
                        );
                        as.add( (as, id) => sink_account = id );
                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'System',
                            true
                        );
                        as.add( (as, id) => system_account = id );
                    } );

                    
                    //---
                    as.add( (as) => as.state.test_name = 'External accounts on peers' );
                    xferacct.addAccountHolder( as, 'peer1', 'PeerTest', true, true, {}, {} );
                    as.add( (as, holder) => {
                        xt.pairPeer( as, holder, 'I:EUR');
                        as.add( (as, id) => peer_external = id );

                        xt.pairPeer( as, holder, 'I:USD');

                        xt.pairPeer( as, holder, 'I:EUR');
                        as.add( (as, id) => expect(id).to.equal(peer_external) );

                        xferacct.getAccountHolderExt( as, 'peer2' );
                        as.add( ( as, info ) => {
                            xferacct.updateAccountHolder( as, info.id, 'PeerTest');
                        });
                    } );
                    
                    //---
                    as.add( (as) => as.state.test_name = 'Transit accounts on "Peer2"' );
                    xferacct.addAccountHolder( as, 'Peer2 Transit', 'PeerTest', true, true, {}, {} );
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'Transit',
                            'I:EUR',
                            'Source',
                            true,
                            source_account,
                            peer_external
                        );
                        as.add( (as, id) => source_transit = id );
                        xferacct.addAccount(
                            as,
                            holder,
                            'Transit',
                            'I:EUR',
                            'Sink',
                            true,
                            sink_account,
                            peer_external
                        );
                        as.add( (as, id) => sink_transit = id );
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
        
        it ('should process peer xfers', function(done) {
            as.add(
                (as) =>
                {
                    const xferacct = ccm.iface('xfer.accounts');
                    const deposits = ccm.iface('xfer.deposits');
                    const payments = ccm.iface('xfer.payments');
                
                    as.add( (as) => as.state.test_name = 'Deposit to source' );
                    payments.onInbound( as,
                        source_account,
                        system_account,
                        'I:EUR',
                        '12.00',
                        'T1',
                        {},
                        moment.utc().format()
                    );

                    as.add( (as) => as.state.test_name = 'Deposit source -> sink' );
                    xferacct.setOverdraft( as, peer_external, 'I:EUR', '12.00' );
                    deposits.onDeposit( as,
                        sink_transit,
                        source_transit,
                        'I:EUR',
                        '10.00',
                        'T2',
                        {},
                        moment.utc().format()
                    );
                    
                    as.add( (as) => as.state.test_name = 'Inbound source -> system' );
                    payments.onInbound( as,
                        system_account,
                        source_transit,
                        'I:EUR',
                        '2.00',
                        'T3',
                        {},
                        moment.utc().format()
                    );

                    as.add( (as) => as.state.test_name = 'Deposit system -> sink' );
                    deposits.onDeposit( as,
                        sink_transit,
                        system_account,
                        'I:EUR',
                        '2.00',
                        'T4',
                        {},
                        moment.utc().format()
                    );
                    
                    xferacct.getAccount( as, sink_account );
                    as.add( (as, info) => expect(info.balance).to.equal('12.00') );
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
