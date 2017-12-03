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

    describe( 'Generic', function() {
        const LimitsFace = require( '../LimitsFace' );
        const LimitsService = require( '../LimitsService' );
        const InfoFace = require( '../Currency/InfoFace' );
        const InfoService = require( '../Currency/InfoService' );
        const AccountsFace = require( '../AccountsFace' );
        const AccountsService = require( '../AccountsService' );

        const GenericFace = require( '../GenericFace' );
        const GenericService = require( '../GenericService' );

        let system_account;
        let fee_account;
        let account_holder;
        let user_account;
        const xfer_ids = [];

        const checkBalance = ( as, account, balance ) => {
            ccm.iface( 'xfer.accounts' ).getAccount( as, account );
            as.add( ( as, info ) => expect( info.balance ).to.equal( balance ) );
        };

        const checkBalanceAll = ( as, system_bal, fee_bal, user_bal ) => {
            let base;
            as.add( ( as ) => base = as.state.test_name );
            as.add( ( as ) => as.state.test_name = base + ' system' );
            checkBalance( as, system_account, system_bal );
            as.add( ( as ) => as.state.test_name = base + ' fee' );
            checkBalance( as, fee_account, fee_bal );
            as.add( ( as ) => as.state.test_name = base + ' user' );
            checkBalance( as, user_account, user_bal );
        };

        beforeEach( 'deposits', function() {
            as.add(
                ( as ) => {
                    InfoService.register( as, executor );
                    InfoFace.register( as, ccm, 'currency.info', executor );

                    LimitsService.register( as, executor );
                    LimitsFace.register( as, ccm, 'xfer.limits', executor );

                    AccountsService.register( as, executor );
                    AccountsFace.register( as, ccm, 'xfer.accounts', executor );

                    GenericService.register( as, executor );
                    GenericFace.register( as, ccm, 'xfer.generic', executor );
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

                    //--
                    const xferacct = ccm.iface( 'xfer.accounts' );

                    xferacct.addAccountHolder( as, 'GenericSystem', 'default', true, true, {}, {} );
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

                    xferacct.addAccountHolder( as, 'GenericUser', 'default', true, true, {}, {} );
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

        it ( 'should process settle', function( done ) {
            as.add(
                ( as ) => {
                    const generic = ccm.iface( 'xfer.generic' );

                    as.add( ( as ) => as.state.test_name = '#1' );
                    generic.settle( as,
                        user_account,
                        system_account,
                        'I:EUR',
                        '10.00',
                        'System settle',
                        'S1',
                        {},
                        moment.utc().format()
                    );
                    as.add( ( as, xfer_id ) => xfer_ids.push( xfer_id ) );
                    checkBalanceAll( as, '-10.00', '0.00', '10.00' );

                    as.add( ( as ) => as.state.test_name = '#2' );
                    generic.settle( as,
                        system_account,
                        user_account,
                        'I:EUR',
                        '9.00',
                        'System settle',
                        'S2',
                        {},
                        moment.utc().format()
                    );
                    as.add( ( as, xfer_id ) => xfer_ids.push( xfer_id ) );
                    checkBalanceAll( as, '-1.00', '0.00', '1.00' );
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

        it ( 'should process fee', function( done ) {
            as.add(
                ( as ) => {
                    const generic = ccm.iface( 'xfer.generic' );

                    as.add( ( as ) => as.state.test_name = '#1' );
                    generic.fee( as,
                        user_account,
                        fee_account,
                        'I:EUR',
                        '0.70',
                        'System fee',
                        'F1',
                        {},
                        moment.utc().format(),
                        false
                    );
                    as.add( ( as, xfer_id ) => xfer_ids.push( xfer_id ) );
                    checkBalanceAll( as, '-1.00', '0.70', '0.30' );

                    as.add(
                        ( as ) => {
                            as.add( ( as ) => as.state.test_name = '#2' );
                            generic.fee( as,
                                user_account,
                                fee_account,
                                'I:EUR',
                                '1.00',
                                'System fee',
                                'F2',
                                {},
                                moment.utc().format(),
                                false
                            );
                            as.add( ( as ) => as.error( 'Fail' ) );
                        },
                        ( as, err ) => {
                            if ( err === 'NotEnoughFunds' ) {
                                as.success();
                            }
                        }
                    );

                    as.add( ( as ) => as.state.test_name = '#3' );
                    generic.fee( as,
                        user_account,
                        fee_account,
                        'I:EUR',
                        '1.00',
                        'System fee',
                        'F2',
                        {},
                        moment.utc().format(),
                        true
                    );
                    as.add( ( as, xfer_id ) => xfer_ids.push( xfer_id ) );
                    checkBalanceAll( as, '-1.00', '1.70', '-0.70' );
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

        it ( 'should process cancel', function( done ) {
            as.add(
                ( as ) => {
                    const generic = ccm.iface( 'xfer.generic' );

                    as.add( ( as ) => as.state.test_name = 'Settle #1' );
                    generic.cancel( as,
                        xfer_ids[0],
                        'Settle',
                        system_account,
                        user_account,
                        'I:EUR',
                        '10.00',
                        moment.utc().format()
                    );
                    checkBalanceAll( as, '9.00', '1.70', '-10.70' );

                    as.add( ( as ) => as.state.test_name = 'Settle #2' );
                    generic.cancel( as,
                        xfer_ids[1],
                        'Settle',
                        user_account,
                        system_account,
                        'I:EUR',
                        '9.00',
                        moment.utc().format()
                    );
                    checkBalanceAll( as, '0.00', '1.70', '-1.70' );

                    as.add( ( as ) => as.state.test_name = 'Fee #1' );
                    generic.cancel( as,
                        xfer_ids[2],
                        'Fee',
                        user_account,
                        fee_account,
                        'I:EUR',
                        '0.70',
                        moment.utc().format()
                    );
                    checkBalanceAll( as, '0.00', '1.00', '-1.00' );

                    as.add( ( as ) => as.state.test_name = 'Fee #2' );
                    generic.cancel( as,
                        xfer_ids[3],
                        'Fee',
                        user_account,
                        fee_account,
                        'I:EUR',
                        '1.00',
                        moment.utc().format()
                    );
                    checkBalanceAll( as, '0.00', '0.00', '0.00' );
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
