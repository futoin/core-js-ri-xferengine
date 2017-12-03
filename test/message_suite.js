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

    describe( 'Messages', function() {
        const LimitsFace = require( '../LimitsFace' );
        const LimitsService = require( '../LimitsService' );
        const InfoFace = require( '../Currency/InfoFace' );
        const InfoService = require( '../Currency/InfoService' );
        const AccountsFace = require( '../AccountsFace' );
        const AccountsService = require( '../AccountsService' );

        const MessageFace = require( '../MessageFace' );
        const MessageService = require( '../MessageService' );

        let operator_holder;
        let user_holder;

        beforeEach( 'messages', function() {
            as.add(
                ( as ) => {
                    InfoService.register( as, executor );
                    InfoFace.register( as, ccm, 'currency.info', executor );

                    LimitsService.register( as, executor );
                    LimitsFace.register( as, ccm, 'xfer.limits', executor );

                    AccountsService.register( as, executor );
                    AccountsFace.register( as, ccm, 'xfer.accounts', executor );

                    MessageService.register( as, executor );
                    MessageFace.register( as, ccm, 'xfer.message', executor );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                    console.log( as.state.last_exception );
                }
            );
            as.add(
                ( as ) => {
                    if ( user_holder ) {
                        return;
                    }

                    const xferlim = ccm.iface( 'xfer.limits' );

                    xferlim.addLimitGroup( as, 'MessageTest' );

                    xferlim.setLimits( as, 'MessageTest', 'Misc', 'I:EUR', {
                        message_daily_cnt : 3,
                        failure_daily_cnt : 1,
                        limithit_daily_cnt : 1,
                        message_weekly_cnt : 3,
                        failure_weekly_cnt : 1,
                        limithit_weekly_cnt : 1,
                        message_monthly_cnt : 3,
                        failure_monthly_cnt : 1,
                        limithit_monthly_cnt : 1,
                    }, false, false );

                    xferlim.addLimitGroup( as, 'MessageOperatorTest' );

                    xferlim.setLimits( as, 'MessageOperatorTest', 'Personnel', 'I:EUR', {
                        message_daily_cnt : 1,
                        manual_daily_amt : "1.00",
                        manual_daily_cnt : 1,
                        message_weekly_cnt : 1,
                        manual_weekly_amt : "1.00",
                        manual_weekly_cnt : 1,
                        message_monthly_cnt : 1,
                        manual_monthly_amt : "1.00",
                        manual_monthly_cnt : 1,
                    }, false, false );


                    //--
                    const xferacct = ccm.iface( 'xfer.accounts' );

                    xferacct.addAccountHolder( as, 'MessageUser', 'MessageTest', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        user_holder = holder;
                    } );

                    xferacct.addAccountHolder( as, 'MessageOperator', 'MessageOperatorTest', true, true, {}, {} );
                    as.add( ( as, holder ) => {
                        operator_holder = holder;
                    } );
                },
                ( as, err ) => {
                    console.log( err );
                    console.log( as.state.error_info );
                }
            );
        } );

        it ( 'should process messages', function( done ) {
            as.add(
                ( as ) => {
                    const message = ccm.iface( 'xfer.message' );
                    const msg_ids = [];

                    for ( let i = 0; i < 2; ++i ) {
                        //---
                        as.add( ( as ) => as.state.test_name = 'User #1' );
                        message.userSend( as,
                            user_holder,
                            'M1',
                            moment.utc().format(),
                            {
                                subject: 'aaa',
                                body: 'bbb',
                            }
                        );
                        as.add( ( as, msg_id ) => {
                            if ( i ) {
                                expect( msg_id ).to.equal( msg_ids[0] );
                            } else {
                                msg_ids.push( msg_id );
                            }

                            message.systemSend( as,
                                operator_holder,
                                user_holder,
                                'M2',
                                moment.utc().format(),
                                {
                                    subject: 'Re: aaa',
                                    body: 'reply',
                                },
                                msg_id
                            );

                            as.add( ( as, msg_id ) => {
                                if ( i ) {
                                    expect( msg_id ).to.equal( msg_ids[1] );
                                } else {
                                    msg_ids.push( msg_id );
                                }

                                //---
                                as.add( ( as ) => as.state.test_name = 'User #2' );
                                message.userSend( as,
                                    user_holder,
                                    'M2', // check overlap with different senders
                                    moment.utc().format(),
                                    {
                                        subject: 'Re-Re: aaa',
                                        body: 'reply',
                                        other: {
                                            files: [ 'aaa', 'bbb' ],
                                        },
                                    },
                                    msg_id
                                );
                                as.add( ( as, msg_id ) => msg_ids.push( msg_id ) );
                            } );
                        } );
                    }

                    ccm.db( 'xfer' )
                        .select( 'evt_queue' )
                        .get( 'c', 'COUNT(*)' )
                        .where( 'type', 'MSG' )
                        .execute( as );
                    as.add( ( as, { rows } ) => expect( parseInt( rows[0][0] ) ).to.equal( 3 ) );
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


        it ( 'should detect errors', function( done ) {
            as.add(
                ( as ) => {
                    const message = ccm.iface( 'xfer.message' );

                    message.userSend( as,
                        user_holder,
                        'ME1',
                        moment.utc().format(),
                        {
                            subject: 'aaa',
                            body: 'bbb',
                        }
                    );

                    as.add( ( as ) => {
                        message.userSend( as,
                            user_holder,
                            'ME1',
                            moment.utc().format(),
                            {
                                subject: 'aaa',
                                body: 'bbba',
                            }
                        );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'OriginalMismatch' ) {
                            as.success();
                        }
                    } );

                    as.add( ( as ) => {
                        message.userSend( as,
                            user_holder,
                            'ME1',
                            moment.utc( '2017-01-01' ).format(),
                            {
                                subject: 'aaa',
                                body: 'bbb',
                            }
                        );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'OriginalTooOld' ) {
                            as.success();
                        }
                    } );

                    as.add( ( as ) => {
                        message.userSend( as,
                            user_holder,
                            'ME2',
                            moment.utc().format(),
                            {
                                subject: 'aaa',
                                body: 'bbb',
                            },
                            '0123456789012345678912'
                        );
                        as.add( ( as ) => as.error( 'Fail' ) );
                    }, ( as, err ) => {
                        if ( err === 'UnknownRelID' ) {
                            as.success();
                        }
                    } );
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
