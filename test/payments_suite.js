'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

const Executor = require( 'futoin-executor/Executor' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

//SpecTools.on('error', function() { console.log(arguments); } );


module.exports = function( describe, it, vars ) {
    let as;
    let ccm;
    let executor;

    beforeEach( 'common', function() {
        ccm = vars.ccm;
        as = vars.as;
        executor = vars.executor;
    } );

    describe( 'Payments', function() {
        const LimitsFace = require( '../LimitsFace' );
        const LimitsService = require( '../LimitsService' );
        const InfoFace = require( '../Currency/InfoFace' );
        const InfoService = require( '../Currency/InfoService' );
        const AccountsFace = require( '../AccountsFace' );
        const AccountsService = require( '../AccountsService' );

        const PaymentFace = require( '../PaymentFace' );
        const PaymentService = require( '../PaymentService' );

        let system_account;
        let fee_account;
        let account_holder;
        let user_account;

        const checkBalance = ( as, account, balance ) => {
            ccm.iface( 'xfer.accounts' ).getAccount( as, account );
            as.add( ( as, info ) => expect( info.balance ).to.equal( balance ) );
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

                    xferlim.addLimitGroup( as, 'PaymentUserTest' );

                    xferlim.setLimits( as, 'PaymentUserTest', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "100.00",
                        outbound_daily_cnt : 10,
                        inbound_daily_amt : "100.00",
                        inbound_daily_cnt : 10,
                        outbound_weekly_amt : "500.00",
                        outbound_weekly_cnt : 100,
                        inbound_weekly_amt : "500.00",
                        inbound_weekly_cnt : 100,
                        outbound_monthly_amt : "10000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt :"10000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0.01",
                    }, {
                        outbound_daily_amt : "10.00",
                        outbound_daily_cnt : 10,
                        inbound_daily_amt : "10.00",
                        inbound_daily_cnt : 10,
                        outbound_weekly_amt : "500.00",
                        outbound_weekly_cnt : 100,
                        inbound_weekly_amt : "500.00",
                        inbound_weekly_cnt : 100,
                        outbound_monthly_amt : "10000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt :"10000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0.01",
                    }, false );

                    xferlim.addLimitGroup( as, 'PaymentSystemTest' );

                    xferlim.setLimits( as, 'PaymentSystemTest', 'Payments', 'I:EUR', {
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


                    //--
                    const xferacct = ccm.iface( 'xfer.accounts' );

                    xferacct.addAccountHolder( as, 'PaymentSystem', 'PaymentSystemTest', true, true, {}, {} );
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
                    } );

                    xferacct.addAccountHolder( as, 'PaymentUser', 'PaymentUserTest', true, true, {}, {} );
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
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                }
            );
        } );

        it ( 'should process inbound payments', function( done ) {
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `On inbound #1 ${i}` );
                        payments.onInbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
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

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '0.99' );
                            checkBalance( as, fee_account, '0.01' );
                            checkBalance( as, system_account, '-1.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On inbound no-fee #2 ${i}` );
                        payments.onInbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '0.40',
                            'T2',
                            {},
                            moment.utc().format(),
                            null
                        );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '1.39' );
                            checkBalance( as, fee_account, '0.01' );
                            checkBalance( as, system_account, '-1.40' );
                        }

                        as.add( ( as ) => as.state.test_name = `On inbound no-fee #3 ${i}` );
                        payments.onInbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '98.60',
                            'T3',
                            {},
                            moment.utc().format(),
                            null
                        );

                        checkBalance( as, user_account, '99.99' );
                        checkBalance( as, fee_account, '0.01' );
                        checkBalance( as, system_account, '-100.00' );
                    }

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'On inbound over limit #4' );
                            payments.onInbound( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.01',
                                'T4',
                                {},
                                moment.utc().format()
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'LimitReject' ) {
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

        it ( 'should process outbound payments', function( done ) {
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );

                    checkBalance( as, user_account, '99.99' );
                    checkBalance( as, fee_account, '0.01' );
                    checkBalance( as, system_account, '-100.00' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `On outbound #1 ${i}` );
                        payments.startOutbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
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

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '98.98' );
                            checkBalance( as, fee_account, '0.02' );
                            checkBalance( as, system_account, '-99.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On outbound #2 ${i}` );
                        as.add(
                            ( as ) => {
                                payments.startOutbound( as,
                                    user_account,
                                    system_account,
                                    'I:EUR',
                                    '10.00',
                                    `T2`,
                                    {},
                                    moment.utc().format(),
                                    null
                                );

                                as.add( ( as, { xfer_id, wait_user } ) => {
                                    expect( xfer_id ).to.be.ok;
                                    expect( wait_user ).to.equal( true );

                                    checkBalance( as, user_account, '88.98' );
                                    checkBalance( as, fee_account, '0.02' );
                                    checkBalance( as, system_account, '-99.00' );

                                    as.add( ( as ) => as.state.test_name = `Reject outbound #2 ${i}` );
                                    payments.rejectOutbound( as,
                                        xfer_id,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '10.00',
                                        moment.utc().format()
                                    );
                                    checkBalance( as, user_account, '98.98' );
                                    checkBalance( as, fee_account, '0.02' );
                                    checkBalance( as, system_account, '-99.00' );
                                } );
                            },
                            ( as, err ) => {
                                if ( i ) {
                                    expect( err ).to.equal( 'AlreadyCanceled' );
                                    as.success();
                                }
                            }
                        );

                        as.add( ( as ) => as.state.test_name = `On outbound no-fee #3 ${i}` );
                        payments.startOutbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
                            'T3',
                            {},
                            moment.utc().format(),
                            null
                        );

                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( wait_user ).to.equal( false );
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '97.98' );
                            checkBalance( as, fee_account, '0.02' );
                            checkBalance( as, system_account, '-98.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On outbound no-fee #4 ${i}` );
                        payments.startOutbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '97.98',
                            'T4',
                            {},
                            moment.utc().format(),
                            null
                        );

                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.equal( i === 0 );

                            if ( i === 0 ) {
                                checkBalance( as, user_account, '0.00' );
                                checkBalance( as, fee_account, '0.02' );
                                checkBalance( as, system_account, '-98.00' );
                            }

                            payments.confirmOutbound( as,
                                xfer_id,
                                user_account,
                                system_account,
                                'I:EUR',
                                '97.98',
                                moment.utc().format()
                            );

                            if ( i === 0 ) {
                                checkBalance( as, user_account, '0.00' );
                                checkBalance( as, fee_account, '0.02' );
                                checkBalance( as, system_account, '-0.02' );
                            }

                            as.add(
                                ( as ) => {
                                    as.add( ( as ) => as.state.test_name = `Reject outbound #4 ${i}` );
                                    payments.rejectOutbound( as,
                                        xfer_id,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '97.98',
                                        moment.utc().format()
                                    );
                                    as.add( ( as ) => as.error( 'Fail' ) );
                                },
                                ( as, err ) => {
                                    if ( err === 'AlreadyCompleted' ) {
                                        as.success();
                                    }
                                }
                            );
                        } );
                    }

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'On outbound over limit #5' );
                            payments.startOutbound( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.01',
                                'T5',
                                {},
                                moment.utc().format()
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'NotEnoughFunds' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'Confirm unknown' );
                            payments.confirmOutbound( as,
                                'aaaaaaaaaaaaaaaaaaaaaa',
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.80',
                                moment.utc().format()
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownXferID' ) {
                                as.success();
                            }
                        }
                    );

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'Reject unknown' );
                            payments.rejectOutbound( as,
                                'aaaaaaaaaaaaaaaaaaaaaa',
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.80',
                                moment.utc().format()
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'UnknownXferID' ) {
                                as.success();
                            }
                        }
                    );

                    checkBalance( as, user_account, '0.00' );
                    checkBalance( as, fee_account, '0.02' );
                    checkBalance( as, system_account, '-0.02' );
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
