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

    describe( 'Retail', function() {
        const LimitsFace = require( '../LimitsFace' );
        const LimitsService = require( '../LimitsService' );
        const InfoFace = require( '../Currency/InfoFace' );
        const InfoService = require( '../Currency/InfoService' );
        const AccountsFace = require( '../AccountsFace' );
        const AccountsService = require( '../AccountsService' );

        const PaymentFace = require( '../PaymentFace' );
        const PaymentService = require( '../PaymentService' );
        const RetailFace = require( '../RetailFace' );
        const RetailService = require( '../RetailService' );

        let system_account;
        let fee_account;
        let account_holder;
        let user_account;

        const checkBalance = ( as, account, balance, reserved=null ) => {
            ccm.iface( 'xfer.accounts' ).getAccount( as, account );
            as.add( ( as, info ) => {
                expect( info.balance ).to.equal( balance );
                reserved && expect( info.reserved ).to.equal( reserved );
            } );
        };

        beforeEach( 'retail', function() {
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

                    RetailService.register( as, executor );
                    RetailFace.register( as, ccm, 'xfer.retail', executor );
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

                    xferlim.addLimitGroup( as, 'RetailUserTest' );

                    xferlim.setLimits( as, 'RetailUserTest', 'Payments', 'I:EUR', {
                        outbound_daily_amt : "1000.00",
                        outbound_daily_cnt : 10,
                        inbound_daily_amt : "1000.00",
                        inbound_daily_cnt : 10,
                        outbound_weekly_amt : "1000.00",
                        outbound_weekly_cnt : 100,
                        inbound_weekly_amt : "1000.00",
                        inbound_weekly_cnt : 100,
                        outbound_monthly_amt : "10000.00",
                        outbound_monthly_cnt : 1000,
                        inbound_monthly_amt :"10000.00",
                        inbound_monthly_cnt : 1000,
                        outbound_min_amt : "0.01",
                    }, false, false );

                    xferlim.setLimits( as, 'RetailUserTest', 'Retail', 'I:EUR', {
                        retail_daily_amt : "100.00",
                        retail_daily_cnt : 100,
                        retail_weekly_amt : "100.00",
                        retail_weekly_cnt : 100,
                        retail_monthly_amt : "100.00",
                        retail_monthly_cnt : 100,
                        retail_min_amt : "1.00",
                        preauth_daily_amt : "100.00",
                        preauth_daily_cnt : 100,
                        preauth_weekly_amt : "100.00",
                        preauth_weekly_cnt : 100,
                        preauth_monthly_amt : "100.00",
                        preauth_monthly_cnt : 100,
                        preauth_min_amt : "1.00",
                    }, {
                        retail_daily_amt : "10.00",
                        retail_daily_cnt : 100,
                        retail_weekly_amt : "100.00",
                        retail_weekly_cnt : 100,
                        retail_monthly_amt : "100.00",
                        retail_monthly_cnt : 100,
                        retail_min_amt : "1.00",
                        preauth_daily_amt : "10.00",
                        preauth_daily_cnt : 100,
                        preauth_weekly_amt : "100.00",
                        preauth_weekly_cnt : 100,
                        preauth_monthly_amt : "100.00",
                        preauth_monthly_cnt : 100,
                        preauth_min_amt : "1.00",
                    }, false );

                    xferlim.addLimitGroup( as, 'RetailSystemTest' );

                    xferlim.setLimits( as, 'RetailSystemTest', 'Payments', 'I:EUR', {
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

                    xferacct.addAccountHolder( as, 'RetailSystem', 'RetailSystemTest', true, true, {}, {} );
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

                    xferacct.addAccountHolder( as, 'RetailUser', 'RetailUserTest', true, true, {}, {} );
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

                    as.add( ( as ) => {
                        const payments = ccm.iface( 'xfer.payments' );
                        payments.onInbound( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '300.00',
                            'IB',
                            {},
                            moment.utc().format()
                        );
                    } );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                }
            );
        } );

        it ( 'should process simple purchases', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const retail = ccm.iface( 'xfer.retail' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `On purchase #1 ${i}` );
                        retail.purchase( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
                            'T1',
                            {},
                            moment.utc().format(),
                            null
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.false;
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '299.00' );
                            checkBalance( as, fee_account, '0.00' );
                            checkBalance( as, system_account, '-299.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On purchase #2 ${i}` );
                        retail.purchase( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.01',
                            'T2',
                            {},
                            moment.utc().format(),
                            {
                                rel_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.01',
                                reason: 'System fee',
                            }
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.equal( i === 0 );

                            if ( wait_user ) {
                                checkBalance( as, user_account, '288.99' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-299.00' );
                            }

                            as.add( ( as ) => as.state.test_name = `On purchase confirm #2 ${i}` );

                            retail.confirmPurchase( as,
                                xfer_id,
                                user_account,
                                system_account,
                                'I:EUR',
                                '10.01',
                                moment.utc().format(),
                                {
                                    rel_account: fee_account,
                                    currency: 'I:EUR',
                                    amount: '0.01',
                                    reason: 'System fee',
                                }
                            );
                            as.add( ( as, res ) => expect( res ).to.be.true );

                            if ( wait_user ) {
                                checkBalance( as, user_account, '288.99' );
                                checkBalance( as, fee_account, '0.01' );
                                checkBalance( as, system_account, '-289.00' );
                            }

                            as.add(
                                ( as ) => {
                                    retail.rejectPurchase( as,
                                        xfer_id,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '10.01',
                                        moment.utc().format(),
                                        {
                                            rel_account: fee_account,
                                            currency: 'I:EUR',
                                            amount: '0.01',
                                            reason: 'System fee',
                                        }
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


                        as.add( ( as ) => as.state.test_name = `On purchase #3 ${i}` );
                        as.add( ( as ) => {
                            retail.purchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '10.01',
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
                            as.add( ( as, { xfer_id, wait_user } ) => {
                                expect( xfer_id ).to.be.ok;
                                expect( wait_user ).to.be.equal( i === 0 );

                                if ( wait_user ) {
                                    checkBalance( as, user_account, '278.98' );
                                    checkBalance( as, fee_account, '0.01' );
                                    checkBalance( as, system_account, '-289.00' );
                                }

                                as.add( ( as ) => as.state.test_name = `On purchase reject #3 ${i}` );

                                retail.rejectPurchase( as,
                                    xfer_id,
                                    user_account,
                                    system_account,
                                    'I:EUR',
                                    '10.01',
                                    moment.utc().format(),
                                    {
                                        rel_account: fee_account,
                                        currency: 'I:EUR',
                                        amount: '0.01',
                                        reason: 'System fee',
                                    }
                                );
                                as.add( ( as, res ) => expect( res ).to.be.true );

                                if ( wait_user ) {
                                    checkBalance( as, user_account, '288.99' );
                                    checkBalance( as, fee_account, '0.01' );
                                    checkBalance( as, system_account, '-289.00' );
                                }

                                as.add(
                                    ( as ) => {
                                        retail.confirmPurchase( as,
                                            xfer_id,
                                            user_account,
                                            system_account,
                                            'I:EUR',
                                            '10.01',
                                            moment.utc().format(),
                                            {
                                                rel_account: fee_account,
                                                currency: 'I:EUR',
                                                amount: '0.01',
                                                reason: 'System fee',
                                            }
                                        );
                                        as.add( ( as ) => as.error( 'Fail' ) );
                                    },
                                    ( as, err ) => {
                                        if ( err === 'AlreadyCanceled' ) {
                                            as.success();
                                        }
                                    }
                                );
                            } );
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );
                    }

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'On purchase undef limit #4' );
                            retail.purchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.99',
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
                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'On purchase over limit #5' );
                            retail.purchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '100.01',
                                'T5',
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

                    checkBalance( as, user_account, '288.99' );
                    checkBalance( as, fee_account, '0.01' );
                    checkBalance( as, system_account, '-289.00' );

                    //----
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `Cancel purchase #1 ${i}` );
                        retail.cancelPurchase( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
                            'T1',
                            {},
                            moment.utc().format()
                        );

                        as.add( ( as ) => as.state.test_name = `Cancel purchase #2 ${i}` );
                        retail.cancelPurchase( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.01',
                            'T2',
                            {},
                            moment.utc().format(),
                            {
                                rel_account: fee_account,
                                currency: 'I:EUR',
                                amount: '0.01',
                                reason: 'System fee',
                            }
                        );

                        as.add( ( as ) => as.state.test_name = `Cancel purchase #3 ${i}` );
                        retail.cancelPurchase( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.01',
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

                        checkBalance( as, user_account, '300.00' );
                        checkBalance( as, fee_account, '0.00' );
                        checkBalance( as, system_account, '-300.00' );
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

        it ( 'should process simple preauth', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const retail = ccm.iface( 'xfer.retail' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `On preauth #1 ${i}` );
                        retail.preAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
                            'PA1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.false;
                        } );

                        if ( i === 0 ) {
                            checkBalance( as, user_account, '300.00', '1.00' );
                            checkBalance( as, fee_account, '0.00' );
                            checkBalance( as, system_account, '-300.00' );
                        }

                        as.add( ( as ) => as.state.test_name = `On preauth #2 ${i}` );
                        retail.preAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.01',
                            'PA2',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.equal( i === 0 );

                            if ( wait_user ) {
                                checkBalance( as, user_account, '300.00', '11.01' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );
                            }

                            as.add( ( as ) => as.state.test_name = `On preauth confirm #2 ${i}` );

                            retail.confirmPreAuth( as,
                                xfer_id,
                                user_account,
                                system_account,
                                'I:EUR',
                                '10.01',
                                moment.utc().format()
                            );
                            as.add( ( as, res ) => expect( res ).to.be.true );

                            if ( wait_user ) {
                                checkBalance( as, user_account, '300.00', '11.01' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );
                            }

                            as.add(
                                ( as ) => {
                                    retail.rejectPreAuth( as,
                                        xfer_id,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '10.01',
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


                        as.add( ( as ) => as.state.test_name = `On preauth #3 ${i}` );
                        as.add( ( as ) => {
                            retail.preAuth( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '10.01',
                                'PA3',
                                {},
                                moment.utc().format()
                            );
                            as.add( ( as, { xfer_id, wait_user } ) => {
                                expect( xfer_id ).to.be.ok;
                                expect( wait_user ).to.be.equal( i === 0 );

                                if ( wait_user ) {
                                    checkBalance( as, user_account, '300.00', '21.02' );
                                    checkBalance( as, fee_account, '0.00' );
                                    checkBalance( as, system_account, '-300.00' );
                                }

                                as.add( ( as ) => as.state.test_name = `On preauth reject #3 ${i}` );

                                retail.rejectPreAuth( as,
                                    xfer_id,
                                    user_account,
                                    system_account,
                                    'I:EUR',
                                    '10.01',
                                    moment.utc().format()
                                );
                                as.add( ( as, res ) => expect( res ).to.be.true );

                                if ( wait_user ) {
                                    checkBalance( as, user_account, '300.00', '11.01' );
                                    checkBalance( as, fee_account, '0.00' );
                                    checkBalance( as, system_account, '-300.00' );
                                }

                                as.add(
                                    ( as ) => {
                                        retail.confirmPreAuth( as,
                                            xfer_id,
                                            user_account,
                                            system_account,
                                            'I:EUR',
                                            '10.01',
                                            moment.utc().format()
                                        );
                                        as.add( ( as ) => as.error( 'Fail' ) );
                                    },
                                    ( as, err ) => {
                                        if ( err === 'AlreadyCanceled' ) {
                                            as.success();
                                        }
                                    }
                                );
                            } );
                        }, ( as, err ) => {
                            if ( i && err === 'AlreadyCanceled' ) {
                                as.success();
                            }
                        } );
                    }

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'On purchase undef limit #4' );
                            retail.preAuth( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '0.99',
                                'PA4',
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
                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = 'On purchase over limit #5' );
                            retail.preAuth( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '100.01',
                                'PA5',
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

                    checkBalance( as, user_account, '300.00', '11.01' );
                    checkBalance( as, fee_account, '0.00' );
                    checkBalance( as, system_account, '-300.00' );

                    //----
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `Clear preauth #1 ${i}` );
                        retail.clearPreAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '1.00',
                            'PA1',
                            {},
                            moment.utc().format()
                        );

                        as.add( ( as ) => as.state.test_name = `Clear preauth #2 ${i}` );
                        retail.clearPreAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.01',
                            'PA2',
                            {},
                            moment.utc().format()
                        );

                        as.add( ( as ) => as.state.test_name = `Clear preauth #3 ${i}` );
                        retail.clearPreAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.01',
                            'PA3',
                            {},
                            moment.utc().format()
                        );

                        checkBalance( as, user_account, '300.00', '0.00' );
                        checkBalance( as, fee_account, '0.00' );
                        checkBalance( as, system_account, '-300.00' );
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

        it ( 'should process purchase using preauth below limits', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const retail = ccm.iface( 'xfer.retail' );

                    // Below limits
                    //------------------
                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `below limits ${i}` );

                        retail.preAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.00',
                            'BL1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.false;


                            if ( i === 0 ) {
                                checkBalance( as, user_account, '300.00', '10.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );
                            }

                            as.add( ( as ) => as.state.test_name = `purchase ${i}` );
                            retail.purchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '9.00',
                                'BL2',
                                {},
                                moment.utc().format(),
                                null,
                                xfer_id
                            );
                            as.add( ( as, { xfer_id, wait_user } ) => {
                                expect( xfer_id ).to.be.ok;
                                expect( wait_user ).to.be.false;

                                checkBalance( as, user_account, '291.00', '0.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-291.00' );
                            } );
                        } );
                    }

                    retail.cancelPurchase( as,
                        user_account,
                        system_account,
                        'I:EUR',
                        '9.00',
                        'BL2',
                        {},
                        moment.utc().format()
                    );

                    checkBalance( as, user_account, '300.00', '0.00' );
                    checkBalance( as, fee_account, '0.00' );
                    checkBalance( as, system_account, '-300.00' );
                    //------------------
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


        it ( 'should process purchase using preauth over limits', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const retail = ccm.iface( 'xfer.retail' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `iter ${i}` );

                        retail.preAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '11.00',
                            'OL1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.equal( i === 0 );


                            if ( i === 0 ) {
                                checkBalance( as, user_account, '300.00', '11.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );

                                as.add( ( as ) => as.state.test_name = `On purchase #1 ${i}` );
                                as.add( ( as ) => {
                                    retail.purchase( as,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '9.00',
                                        'OL2',
                                        {},
                                        moment.utc().format(),
                                        null,
                                        xfer_id
                                    );
                                    as.add( ( as ) => as.error( 'Fail' ) );
                                }, ( as, err ) => {
                                    if ( err === 'UnavailablePreAuth' ) {
                                        as.success();
                                    }
                                } );
                            }

                            retail.confirmPreAuth( as,
                                xfer_id,
                                user_account,
                                system_account,
                                'I:EUR',
                                '11.00',
                                moment.utc().format()
                            );

                            if ( i === 0 ) {
                                checkBalance( as, user_account, '300.00', '11.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );
                            }

                            retail.purchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '9.00',
                                'OL2',
                                {},
                                moment.utc().format(),
                                null,
                                xfer_id
                            );

                            as.add( ( as, { xfer_id, wait_user } ) => {
                                expect( xfer_id ).to.be.ok;
                                expect( wait_user ).to.be.false;

                                checkBalance( as, user_account, '291.00', '0.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-291.00' );
                            } );
                        } );
                    }

                    retail.cancelPurchase( as,
                        user_account,
                        system_account,
                        'I:EUR',
                        '9.00',
                        'OL2',
                        {},
                        moment.utc().format()
                    );

                    checkBalance( as, user_account, '300.00', '0.00' );
                    checkBalance( as, fee_account, '0.00' );
                    checkBalance( as, system_account, '-300.00' );
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


        it ( 'should process purchase using preauth over limits plus', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const retail = ccm.iface( 'xfer.retail' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `iter ${i}` );

                        retail.preAuth( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '11.00',
                            'OLP1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.equal( i === 0 );


                            if ( i === 0 ) {
                                checkBalance( as, user_account, '300.00', '11.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );

                                as.add( ( as ) => as.state.test_name = `On purchase #1 ${i}` );
                                as.add( ( as ) => {
                                    retail.purchase( as,
                                        user_account,
                                        system_account,
                                        'I:EUR',
                                        '12.00',
                                        'OLP2',
                                        {},
                                        moment.utc().format(),
                                        null,
                                        xfer_id
                                    );
                                    as.add( ( as ) => as.error( 'Fail' ) );
                                }, ( as, err ) => {
                                    if ( err === 'UnavailablePreAuth' ) {
                                        as.success();
                                    }
                                } );
                            }

                            retail.confirmPreAuth( as,
                                xfer_id,
                                user_account,
                                system_account,
                                'I:EUR',
                                '11.00',
                                moment.utc().format()
                            );

                            if ( i === 0 ) {
                                checkBalance( as, user_account, '300.00', '11.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-300.00' );
                            }

                            retail.purchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '12.00',
                                'OLP2',
                                {},
                                moment.utc().format(),
                                null,
                                xfer_id
                            );

                            as.add( ( as, { xfer_id, wait_user } ) => {
                                expect( xfer_id ).to.be.ok;
                                expect( wait_user ).to.be.equal( i === 0 );

                                if ( i === 0 ) {
                                    checkBalance( as, user_account, '288.00', '0.00' );
                                    checkBalance( as, fee_account, '0.00' );
                                    checkBalance( as, system_account, '-300.00' );
                                }

                                retail.confirmPurchase( as,
                                    xfer_id,
                                    user_account,
                                    system_account,
                                    'I:EUR',
                                    '12.00',
                                    moment.utc().format()
                                );

                                checkBalance( as, user_account, '288.00', '0.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-288.00' );
                            } );
                        } );
                    }

                    retail.cancelPurchase( as,
                        user_account,
                        system_account,
                        'I:EUR',
                        '12.00',
                        'OLP2',
                        {},
                        moment.utc().format()
                    );

                    checkBalance( as, user_account, '300.00', '0.00' );
                    checkBalance( as, fee_account, '0.00' );
                    checkBalance( as, system_account, '-300.00' );
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

        it ( 'should process refunds', function( done ) {
            this.timeout( 5e3 );
            as.add(
                ( as ) => {
                    const payments = ccm.iface( 'xfer.payments' );
                    const retail = ccm.iface( 'xfer.retail' );

                    for ( let i = 0; i < 2; ++i ) {
                        as.add( ( as ) => as.state.test_name = `iter ${i}` );

                        retail.purchase( as,
                            user_account,
                            system_account,
                            'I:EUR',
                            '10.00',
                            'RFD1',
                            {},
                            moment.utc().format()
                        );
                        as.add( ( as, { xfer_id, wait_user } ) => {
                            expect( xfer_id ).to.be.ok;
                            expect( wait_user ).to.be.false;

                            retail.refund( as,
                                xfer_id,
                                moment.utc().format(),
                                user_account,
                                system_account,
                                'I:EUR',
                                '2.00',
                                'RFD2',
                                {},
                                moment.utc().format()
                            );

                            if ( i === 0 ) {
                                checkBalance( as, user_account, '292.00', '0.00' );
                                checkBalance( as, fee_account, '0.00' );
                                checkBalance( as, system_account, '-292.00' );

                                as.add(
                                    ( as ) => {
                                        retail.refund( as,
                                            xfer_id,
                                            moment.utc().format(),
                                            user_account,
                                            system_account,
                                            'I:EUR',
                                            '8.01',
                                            'RFD3',
                                            {},
                                            moment.utc().format()
                                        );
                                        as.add( ( as ) => as.error( 'Fail' ) );
                                    },
                                    ( as, err ) => {
                                        if ( err === 'AmountTooLarge' ) {
                                            as.success();
                                        }
                                    }
                                );

                                as.add(
                                    ( as ) => {
                                        retail.refund( as,
                                            '0123456789012345678901',
                                            moment.utc().format(),
                                            user_account,
                                            system_account,
                                            'I:EUR',
                                            '8.00',
                                            'RFD4',
                                            {},
                                            moment.utc().format()
                                        );
                                        as.add( ( as ) => as.error( 'Fail' ) );
                                    },
                                    ( as, err ) => {
                                        if ( err === 'PurchaseNotFound' ) {
                                            as.success();
                                        }
                                    }
                                );

                                as.add(
                                    ( as ) => {
                                        retail.refund( as,
                                            xfer_id,
                                            moment.utc().format(),
                                            fee_account,
                                            system_account,
                                            'I:EUR',
                                            '8.00',
                                            'RFD4',
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

                                as.add(
                                    ( as ) => {
                                        retail.refund( as,
                                            xfer_id,
                                            moment.utc().format(),
                                            user_account,
                                            system_account,
                                            'I:EUR',
                                            '8.00',
                                            'RFD5',
                                            {},
                                            moment.utc( '2017-01-01' ).format()
                                        );
                                        as.add( ( as ) => as.error( 'Fail' ) );
                                    },
                                    ( as, err ) => {
                                        if ( err === 'OriginalTooOld' ) {
                                            as.success();
                                        }
                                    }
                                );
                            }

                            retail.refund( as,
                                xfer_id,
                                moment.utc().format(),
                                user_account,
                                system_account,
                                'I:EUR',
                                '8.00',
                                'RFD6',
                                {},
                                moment.utc().format()
                            );
                        } );
                    }

                    as.add(
                        ( as ) => {
                            retail.cancelPurchase( as,
                                user_account,
                                system_account,
                                'I:EUR',
                                '10.00',
                                'RFD1',
                                {},
                                moment.utc().format()
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'AlreadyRefunded' ) {
                                as.success();
                            }
                        }
                    );

                    checkBalance( as, user_account, '300.00', '0.00' );
                    checkBalance( as, fee_account, '0.00' );
                    checkBalance( as, system_account, '-300.00' );
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
