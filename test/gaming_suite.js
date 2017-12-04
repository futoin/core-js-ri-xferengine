'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require( 'futoin-executor/Executor' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

// SpecTools.on('error', function() { console.log(arguments); } );


module.exports = function( describe, it, vars ) {
    let as;
    let ccm;
    let executor;

    beforeEach( 'common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    } );

    describe( 'Gaming', function() {
        const LimitsFace = require( '../LimitsFace' );
        const LimitsService = require( '../LimitsService' );
        const InfoFace = require( '../Currency/InfoFace' );
        const InfoService = require( '../Currency/InfoService' );
        const AccountsFace = require( '../AccountsFace' );
        const AccountsService = require( '../AccountsService' );
        const PeerFace = require( '../PeerFace' );
        const PeerService = require( '../PeerService' );
        const BasicAuthFace = require( 'futoin-executor/BasicAuthFace' );
        const BasicAuthService = require( 'futoin-executor/BasicAuthService' );
        const XferTools = require( '../XferTools' );

        const PaymentFace = require( '../PaymentFace' );
        const PaymentService = require( '../PaymentService' );
        const GamingFace = require( '../GamingFace' );
        const GamingService = require( '../GamingService' );
        const BonusFace = require( '../BonusFace' );
        const BonusService = require( '../BonusService' );

        let system_account;
        let account_holder;
        let user_account;
        let game_account;
        let user_transit;
        let game_transit;
        let peer1_external;
        let peer2_external;
        let bonus_source;
        const user_ext_id = 'GamingUser';
        const user_transit_ext_id = 'GamingTransitUser';

        const checkBalance = ( as, account, balance ) => {
            ccm.iface( 'xfer.accounts' ).getAccount( as, account );

            if ( typeof balance === 'string' ) {
                as.add( ( as, info ) => expect( info.balance ).to.equal( balance ) );
            } else {
                as.add( ( as, info ) => expect( info.balance ).to.oneOf( balance ) );
            }
        };

        beforeEach( 'payments', function() {
            as.add(
                ( as ) => {
                    InfoService.register( as, executor );
                    InfoFace.register( as, ccm, 'currency.info', executor );

                    LimitsService.register( as, executor );
                    LimitsFace.register( as, ccm, 'xfer.limits', executor );

                    AccountsService.register( as, executor );
                    AccountsFace.register( as, ccm, 'xfer.accounts', executor );

                    PaymentService.register( as, executor );
                    PaymentFace.register( as, ccm, 'xfer.payments', executor );

                    GamingService.register( as, executor );
                    GamingFace.register( as, ccm, 'xfer.gaming', executor );

                    BonusService.register( as, executor );
                    BonusFace.register( as, ccm, 'xfer.bonus', executor );

                    PeerService.register( as, executor );

                    //
                    const inner_executor = new Executor( ccm );
                    inner_executor.on( 'notExpected', function() {
                        console.log( arguments );
                    } );

                    const basvc = BasicAuthService.register( as, inner_executor );
                    basvc.addUser( 'game_peer1', 'pwd', null, true );
                    basvc._user_ids[ 1 ].info.global_id = 'game_peer1';
                    basvc.addUser( 'game_peer2', 'pwd', null, true );
                    basvc._user_ids[ 2 ].info.global_id = 'game_peer2';

                    BasicAuthFace.register( as, ccm, inner_executor );

                    // mock

                    class FakeGamingService extends GamingService {
                        _mockParams( reqinfo ) {
                            const p = reqinfo.params();
                            expect( p.user ).to.equal( user_transit_ext_id );
                            p.user = user_ext_id;
                        }

                        bet( as, reqinfo ) {
                            this._mockParams( reqinfo );
                            super.bet( as, reqinfo );
                        }

                        cancelBet( as, reqinfo ) {
                            this._mockParams( reqinfo );
                            super.cancelBet( as, reqinfo );
                        }

                        win( as, reqinfo ) {
                            this._mockParams( reqinfo );
                            super.win( as, reqinfo );
                        }

                        gameBalance( as, reqinfo ) {
                            this._mockParams( reqinfo );
                            super.gameBalance( as, reqinfo );
                        }
                    }

                    FakeGamingService.register( as, inner_executor );

                    ccm.registerOnDemand(
                        GamingFace.IFACE_NAME,
                        'mock',
                        ( as, ccm, alias, api ) => {
                            GamingFace.register(
                                as,
                                ccm,
                                alias,
                                inner_executor
                            );
                        }
                    );
                    ccm.registerOnDemand(
                        PeerFace.IFACE_NAME,
                        'mock',
                        ( as, ccm, alias, api ) => {
                            PeerFace.register(
                                as,
                                ccm,
                                alias,
                                executor,
                                api.credentials
                            );
                        }
                    );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
            as.add(
                ( as ) => {
                    if ( system_account ) {
                        return;
                    }

                    const xferlim = ccm.iface( 'xfer.limits' );

                    xferlim.addLimitGroup( as, 'GamingUserTest' );

                    xferlim.setLimits( as, 'GamingUserTest', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "0.00",
                        outbound_daily_cnt : 100,
                        inbound_daily_amt : "100.00",
                        inbound_daily_cnt : 100,
                        outbound_weekly_amt : "500.00",
                        outbound_weekly_cnt : 100,
                        inbound_weekly_amt : "500.00",
                        inbound_weekly_cnt : 100,
                        outbound_monthly_amt : "10000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt :"10000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0.01",
                    }, false, false );
                    xferlim.setLimits( as, 'GamingUserTest', 'Gaming', 'I:EUR', {
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
                        bet_min_amt : "0.10",
                    }, false, false );

                    xferlim.setLimits( as, 'GamingUserTest', 'Misc', 'I:EUR', {
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

                    xferlim.addLimitGroup( as, 'GamingSystemTest' );

                    xferlim.setLimits( as, 'GamingSystemTest', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "1000.00",
                        outbound_daily_cnt : 1000,
                        inbound_daily_amt : "1000.00",
                        inbound_daily_cnt : 1000,
                        outbound_weekly_amt : "5000.00",
                        outbound_weekly_cnt : 1000,
                        inbound_weekly_amt : "5000.00",
                        inbound_weekly_cnt : 1000,
                        outbound_monthly_amt : "100000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt :"100000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0.01",
                    }, false, false );

                    xferlim.setLimits( as, 'GamingSystemTest', 'Misc', 'I:EUR', {
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


                    //--
                    const xferacct = ccm.iface( 'xfer.accounts' );

                    xferacct.addAccountHolder(
                        as, 'game_peer1', 'GamingSystemTest', true, true, {},
                        {
                            api: {
                                'futoin.xfer.gaming': {
                                    flavour: 'mock',
                                },
                                'futoin.xfer.peer': {
                                    flavour: 'mock',
                                    credentials: 'game_peer2:pwd',
                                },
                            },
                        }
                    );
                    as.add( ( as, holder ) => {
                        const xt = new XferTools( ccm, 'Payments' );

                        xt.pairPeer( as, holder, 'I:EUR' );
                        as.add( ( as, id ) => peer1_external = id );

                        xferacct.getAccountHolderExt( as, 'game_peer2' );
                        as.add( ( as, info ) => {
                            xferacct.updateAccountHolder( as, info.id, 'GamingSystemTest' );

                            xferacct.setOverdraft( as, peer1_external, 'I:EUR', '100.00' );

                            xferacct.getAccount( as, peer1_external );
                            as.add( ( as, info ) => {
                                peer2_external = info.ext_id;
                                //xferacct.setOverdraft( as, info.ext_id, 'I:EUR', '100.00' );
                            } );
                        } );
                    } );


                    xferacct.addAccountHolder( as, 'GamingSystem', 'GamingSystemTest', true, true, {}, {} );
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
                            'Bonus Source'
                        );
                        as.add( ( as, id ) => bonus_source = id );

                        xferacct.addAccount(
                            as,
                            holder,
                            'External',
                            'I:EUR',
                            'Game'
                        );
                        as.add( ( as, id ) => game_account = id );

                        as.add( ( as ) => xferacct.addAccount(
                            as,
                            holder,
                            'Transit',
                            'I:EUR',
                            'Game Transit',
                            true,
                            game_account,
                            peer1_external
                        ) );
                        as.add( ( as, id ) => game_transit = id );
                    } );

                    xferacct.addAccountHolder( as, user_ext_id, 'GamingUserTest', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        account_holder = holder;

                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Main'
                        );
                        as.add( ( as, id ) => user_account = id );
                    } );

                    xferacct.addAccountHolder( as, user_transit_ext_id, 'GamingUserTest', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'Transit',
                            'I:EUR',
                            'Main',
                            true,
                            user_account,
                            peer1_external
                        );
                        as.add( ( as, id ) => user_transit = id );
                    } );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                }
            );
        } );
        it ( 'should process bonus operations', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const gaming = ccm.iface( 'xfer.gaming' );
                    const bonus = ccm.iface( 'xfer.bonus' );

                    gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                    as.add( ( as, { balance } ) => expect( balance ).to.equal( '0.00' ) );

                    //---
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `Claim #1 ${i}` );

                        bonus.claimBonus( as,
                            user_ext_id,
                            bonus_source,
                            'Bonus 1',
                            'I:EUR',
                            '10.00',
                            'B1',
                            {},
                            moment.utc().format()
                        );
                        gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                        as.add( ( as, { balance } ) => expect( balance ).to.equal( '10.00' ) );
                    }


                    //---
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `Claim #2 ${i}` );

                        bonus.claimBonus( as,
                            user_ext_id,
                            bonus_source,
                            'Bonus 2',
                            'I:EUR',
                            '5.00',
                            'B2',
                            {},
                            moment.utc().format()
                        );
                        gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                        as.add( ( as, { balance } ) => expect( balance ).to.equal( '15.00' ) );
                    }

                    //---
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `Clear #1 ${i}` );

                        bonus.clearBonus( as,
                            user_ext_id,
                            bonus_source,
                            'B1'
                        );
                        gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                        as.add( ( as, { balance } ) => expect( balance ).to.equal( '5.00' ) );
                    }


                    //---
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `Release #2 ${i}` );

                        bonus.releaseBonus( as,
                            user_ext_id,
                            bonus_source,
                            'B2'
                        );
                        gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                        as.add( ( as, { balance } ) => expect( balance ).to.equal( '5.00' ) );
                    }

                    checkBalance( as, user_account, '5.00' );

                    as.add( ( as ) => as.state.test_name = `OriginalMismatch` );
                    as.add(
                        ( as ) => {
                            bonus.claimBonus( as,
                                user_ext_id,
                                bonus_source,
                                'Bonus 1',
                                'I:USD',
                                '10.00',
                                'B1',
                                {},
                                moment.utc().format()
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'OriginalMismatch' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => as.state.test_name = `AlreadyCanceled` );
                    as.add(
                        ( as ) => {
                            bonus.releaseBonus( as,
                                user_ext_id,
                                bonus_source,
                                'B1'
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => as.state.test_name = `AlreadyReleased` );
                    as.add(
                        ( as ) => {
                            bonus.clearBonus( as,
                                user_ext_id,
                                bonus_source,
                                'B2'
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'AlreadyReleased' ) {
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

        it ( 'should process games', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const gaming = ccm.iface( 'xfer.gaming' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `On inbound ${i}` );
                        payments.onInbound( as,
                            bonus_source,
                            system_account,
                            'I:EUR',
                            '5.00',
                            'TB',
                            {},
                            moment.utc().format()
                        );
                        payments.onInbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '45.00',
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
                            checkBalance( as, user_account, '50.00' );
                            checkBalance( as, game_account, '10.00' );
                            checkBalance( as, system_account, '-60.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On bet #1 ${i}` );
                        as.add( ( as ) => {
                            gaming.bet( as,
                                user_ext_id,
                                game_account,
                                'I:EUR',
                                '0.40',
                                'G1',
                                'B1',
                                {},
                                moment.utc().format()
                            );

                            if ( i ) {
                                as.add( ( as ) => as.error( 'Fail' ) );
                            } else {
                                as.add( ( as, { balance, bonus_part } ) => {
                                    expect( balance ) .to.equal( '49.60' );
                                    expect( bonus_part ) .to.equal( '0.00' );
                                } );
                            }
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '49.60' );
                            checkBalance( as, game_account, '10.40' );
                            checkBalance( as, system_account, '-60.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On bet #2 ${i}` );
                        gaming.bet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '1.60',
                            'G1',
                            'B2',
                            {},
                            moment.utc().format()
                        );

                        as.add( ( as, { balance, bonus_part } ) => {
                            expect( balance ) .to.equal( i ? '53.40' : '48.00' );
                            expect( bonus_part ) .to.equal( '0.00' );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '48.00' );
                            checkBalance( as, game_account, '12.00' );
                            checkBalance( as, system_account, '-60.00' );
                        }


                        as.add( ( as ) => as.state.test_name = `Cancel bet #1 ${i}` );
                        gaming.cancelBet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '0.40',
                            'G1',
                            'B1',
                            {},
                            moment.utc().format(),
                            "Some reason"
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ) .to.equal( i ? '53.40' : '48.40' );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '48.40' );
                            checkBalance( as, game_account, '11.60' );
                            checkBalance( as, system_account, '-60.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On win #1 ${i}` );
                        gaming.win( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '5.00',
                            'G1',
                            'W1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ) .to.equal( '53.40' );
                        } );
                    }

                    checkBalance( as, user_account, '53.40' );
                    checkBalance( as, game_account, '6.60' );
                    checkBalance( as, system_account, '-60.00' );

                    gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                    as.add( ( as, { balance } ) => expect( balance ).to.equal( '53.40' ) );

                    gaming.bet( as,
                        user_ext_id,
                        game_account,
                        'I:EUR',
                        '3.40',
                        'G2',
                        'B3',
                        {},
                        moment.utc().format()
                    );

                    checkBalance( as, user_account, '50.00' );
                    checkBalance( as, game_account, '10.00' );
                    checkBalance( as, system_account, '-60.00' );
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

        it ( 'should process games with peers', function( done ) {
            this.timeout( 10e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const gaming = ccm.iface( 'xfer.gaming' );

                    for ( let i = 0; i < 2; ++i ) {
                        if ( i === 0 ) {
                            checkBalance( as, peer1_external, '0.00' );
                            checkBalance( as, peer2_external, '0.00' );
                            checkBalance( as, user_account, '50.00' );
                            checkBalance( as, game_account, '10.00' );
                            checkBalance( as, system_account, '-60.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On bet #1 ${i}` );
                        as.add( ( as ) => {
                            gaming.bet( as,
                                user_transit_ext_id,
                                game_transit,
                                'I:EUR',
                                '0.40',
                                'G1',
                                'B1',
                                {},
                                moment.utc().format()
                            );

                            if ( i ) {
                                as.add( ( as ) => as.error( 'Fail' ) );
                            } else {
                                as.add( ( as, { balance, bonus_part } ) => {
                                    expect( balance ) .to.equal( '49.60' );
                                    expect( bonus_part ) .to.equal( '0.00' );
                                } );
                            }
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );

                        checkBalance( as, user_transit, '0.00' );
                        checkBalance( as, game_transit, '0.00' );

                        if ( i === 0 ) {
                            checkBalance( as, peer1_external, '0.00' );
                            checkBalance( as, peer2_external, '0.00' );
                            checkBalance( as, user_account, '49.60' );
                            checkBalance( as, game_account, '10.40' );
                            checkBalance( as, system_account, '-60.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On bet #2 ${i}` );
                        gaming.bet( as,
                            user_transit_ext_id,
                            game_transit,
                            'I:EUR',
                            '1.60',
                            'G1',
                            'B2',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { balance, bonus_part } ) => {
                            expect( balance ) .to.equal( i ? '53.40' : '48.00' );
                            expect( bonus_part ) .to.equal( '0.00' );
                        } );

                        checkBalance( as, user_transit, '0.00' );
                        checkBalance( as, game_transit, '0.00' );

                        if ( i === 0 ) {
                            checkBalance( as, peer1_external, '0.00' );
                            checkBalance( as, peer2_external, '0.00' );
                            checkBalance( as, user_account, '48.00' );
                            checkBalance( as, game_account, '12.00' );
                            checkBalance( as, system_account, '-60.00' );
                        }


                        as.add( ( as ) => as.state.test_name = `Cancel bet #1 ${i}` );
                        gaming.cancelBet( as,
                            user_transit_ext_id,
                            game_transit,
                            'I:EUR',
                            '0.40',
                            'G1',
                            'B1',
                            {},
                            moment.utc().format(),
                            "Some reason"
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ) .to.equal( i ? '53.40' : '48.40' );
                        } );

                        checkBalance( as, user_transit, '0.00' );
                        checkBalance( as, game_transit, '0.00' );

                        if ( i === 0 ) {
                            checkBalance( as, peer1_external, '0.00' );
                            checkBalance( as, peer2_external, '0.00' );
                            checkBalance( as, user_account, '48.40' );
                            checkBalance( as, game_account, '11.60' );
                            checkBalance( as, system_account, '-60.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On win #1 ${i}` );
                        gaming.win( as,
                            user_transit_ext_id,
                            game_transit,
                            'I:EUR',
                            '5.00',
                            'G1',
                            'W1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ) .to.equal( '53.40' );
                        } );
                    }

                    checkBalance( as, user_transit, '0.00' );
                    checkBalance( as, game_transit, '0.00' );

                    checkBalance( as, peer1_external, '0.00' );
                    checkBalance( as, peer2_external, '0.00' );

                    checkBalance( as, user_account, '53.40' );
                    checkBalance( as, game_account, '6.60' );
                    checkBalance( as, system_account, '-60.00' );

                    gaming.gameBalance( as, user_transit_ext_id, 'I:EUR', {} );
                    as.add( ( as, { balance } ) => expect( balance ).to.equal( '53.40' ) );


                    gaming.bet( as,
                        user_transit_ext_id,
                        game_transit,
                        'I:EUR',
                        '3.40',
                        'G2',
                        'B3',
                        {},
                        moment.utc().format()
                    );

                    checkBalance( as, user_transit, '0.00' );
                    checkBalance( as, game_transit, '0.00' );

                    checkBalance( as, peer1_external, '0.00' );
                    checkBalance( as, peer2_external, '0.00' );

                    checkBalance( as, user_account, '50.00' );
                    checkBalance( as, game_account, '10.00' );
                    checkBalance( as, system_account, '-60.00' );
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


        it ( 'should process games with bonus', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const gaming = ccm.iface( 'xfer.gaming' );
                    const bonus = ccm.iface( 'xfer.bonus' );

                    checkBalance( as, user_account, '50.00' );
                    checkBalance( as, game_account, '10.00' );
                    checkBalance( as, system_account, '-60.00' );

                    const xt = new XferTools( ccm, 'Deposits' );
                    xt.processXfer( as, {
                        type: 'Withdrawal',
                        src_account: user_account,
                        dst_account: system_account,
                        amount: '49.80',
                        currency: 'I:EUR',
                        src_limit_prefix: false,
                        dst_limit_prefix: false,
                    } );

                    checkBalance( as, user_account, '0.20' );
                    checkBalance( as, game_account, '10.00' );
                    checkBalance( as, system_account, '-10.20' );

                    bonus.claimBonus( as,
                        user_ext_id,
                        bonus_source,
                        'Bonus B1',
                        'I:EUR',
                        '1.00',
                        'BB1',
                        {},
                        moment.utc().format()
                    );
                    gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                    as.add( ( as, { balance } ) => expect( balance ).to.equal( '1.20' ) );

                    bonus.claimBonus( as,
                        user_ext_id,
                        bonus_source,
                        'Bonus B2',
                        'I:EUR',
                        '3.00',
                        'BB2',
                        {},
                        moment.utc().format()
                    );
                    gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                    as.add( ( as, { balance } ) => expect( balance ).to.equal( '4.20' ) );
                    //-----------

                    //-----------------------------
                    // Test with Bonus accounts in place
                    //-----------------------------
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `On bet #1 ${i}` );
                        as.add( ( as ) => {
                            gaming.bet( as,
                                user_ext_id,
                                game_account,
                                'I:EUR',
                                '0.50',
                                'BG1',
                                'BB1',
                                {},
                                moment.utc().format()
                            );

                            if ( i ) {
                                as.add( ( as ) => as.error( 'Fail' ) );
                            } else {
                                as.add( ( as, { balance, bonus_part } ) => {
                                    expect( balance ) .to.equal( '3.70' );
                                    expect( bonus_part ) .to.equal( '0.30' );
                                } );
                            }
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.00' );
                            checkBalance( as, game_account, '10.50' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.equal( '3.70' ) );
                        }

                        as.add( ( as ) => as.state.test_name = `On bet #2 ${i}` );
                        gaming.bet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '1.60',
                            'BG1',
                            'BB2',
                            {},
                            moment.utc().format()
                        );

                        as.add( ( as, { balance, bonus_part } ) => {
                            expect( balance ) .to.equal( i ? '7.60' : '2.10' );
                            expect( bonus_part ) .to.equal( '1.60' );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.00' );
                            checkBalance( as, game_account, '12.10' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.equal( '2.10' ) );
                        }


                        as.add( ( as ) => as.state.test_name = `Cancel bet #1 ${i}` );
                        gaming.cancelBet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '0.50',
                            'BG1',
                            'BB1',
                            {},
                            moment.utc().format(),
                            "Some reason"
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ) .to.equal( i ? '7.60' : '2.60' );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.20' );
                            checkBalance( as, game_account, '11.60' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.equal( '2.60' ) );
                        }

                        as.add( ( as ) => as.state.test_name = `On win #1 ${i}` );
                        gaming.win( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '5.00',
                            'BG1',
                            'BW1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ).to.equal( '7.60' );
                        } );

                        gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                        as.add( ( as, { balance } ) => expect( balance ).to.equal( '7.60' ) );

                        checkBalance( as, user_account, '0.20' );
                        checkBalance( as, game_account, '6.60' );
                    }

                    //-----------------------------
                    // Test with bonus accounts released/cleared
                    //-----------------------------
                    for ( let i = 0; i < 2; ++i ) {
                        const post_clear_balance = [ '4.91', '4.92' ];
                        const post_bet2_balance = [ '3.31', '3.32' ];
                        const post_cancel_balance = [ '3.51', '3.52' ];
                        const end_user_balance = [ '4.51', '4.52' ];

                        as.add( ( as ) => as.state.test_name = `On bet #2-1 ${i}` );
                        as.add( ( as ) => {
                            gaming.bet( as,
                                user_ext_id,
                                game_account,
                                'I:EUR',
                                '0.50',
                                'BG2',
                                'BB21',
                                {},
                                moment.utc().format()
                            );

                            if ( i ) {
                                as.add( ( as ) => as.error( 'Fail' ) );
                            } else {
                                as.add( ( as, { balance, bonus_part } ) => {
                                    expect( balance ) .to.equal( '7.10' );
                                    expect( bonus_part ) .to.equal( '0.30' );
                                } );
                            }
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.00' );
                            checkBalance( as, game_account, '7.10' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.equal( '7.10' ) );
                        }

                        as.add( ( as ) => as.state.test_name = `Clear bonus #2-1 #{i}` );
                        bonus.clearBonus( as,
                            user_ext_id,
                            bonus_source,
                            'BB1'
                        );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.00' );
                            checkBalance( as, game_account, '7.10' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.oneOf( post_clear_balance ) );
                        }


                        as.add( ( as ) => as.state.test_name = `On bet #2-2 ${i}` );
                        gaming.bet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '1.60',
                            'BG2',
                            'BB22',
                            {},
                            moment.utc().format()
                        );

                        as.add( ( as, { balance, bonus_part } ) => {
                            expect( balance ) .to.oneOf( i ? end_user_balance : post_bet2_balance );
                            expect( bonus_part ) .to.equal( '1.60' );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.00' );
                            checkBalance( as, game_account, '8.70' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.oneOf( post_bet2_balance ) );
                        }

                        as.add( ( as ) => as.state.test_name = `Release bonus #2-1 #{i}` );
                        bonus.releaseBonus( as,
                            user_ext_id,
                            bonus_source,
                            'BB2'
                        );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, post_bet2_balance );
                            checkBalance( as, game_account, '8.70' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.oneOf( post_bet2_balance ) );
                        }


                        as.add( ( as ) => as.state.test_name = `Cancel bet #2-1 ${i}` );
                        gaming.cancelBet( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '0.50',
                            'BG2',
                            'BB21',
                            {},
                            moment.utc().format(),
                            "Some reason"
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ) .to.oneOf( i ? end_user_balance : post_cancel_balance );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, post_cancel_balance );
                            checkBalance( as, game_account, '8.20' );

                            gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                            as.add( ( as, { balance } ) => expect( balance ).to.oneOf( post_cancel_balance ) );
                        }

                        as.add( ( as ) => as.state.test_name = `On win #1 ${i}` );
                        gaming.win( as,
                            user_ext_id,
                            game_account,
                            'I:EUR',
                            '1.00',
                            'BG2',
                            'BW2',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { balance } ) => {
                            expect( balance ).to.oneOf( end_user_balance );
                        } );

                        gaming.gameBalance( as, user_ext_id, 'I:EUR', {} );
                        as.add( ( as, { balance } ) => expect( balance ).to.oneOf( end_user_balance ) );

                        checkBalance( as, user_account, end_user_balance );
                        checkBalance( as, game_account, '7.20' );
                    }
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
