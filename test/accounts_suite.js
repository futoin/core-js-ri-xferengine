'use strict';

const expect = require( 'chai' ).expect;
const moment = require( 'moment' );

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
        executor = vars.executor;
    });
    
    describe('Accounts', function() {
        const LimitsFace = require('../LimitsFace');
        const LimitsService = require('../LimitsService');
        const CurrencyInfoFace = require('../Currency/InfoFace');
        const CurrencyInfoService = require('../Currency/InfoService');

        const AccountsFace = require('../AccountsFace');
        const AccountsService = require('../AccountsService');
        
        const MOCK_TODAY = '2017-09-23';
        
        class MockAccountsService extends AccountsService {
            _today() {
                // TODO: system timezone
                return moment().utc().format( MOCK_TODAY );
            }
        }
        
        beforeEach('currency', function() {
            as.add(
                (as) => {
                    CurrencyInfoService.register(as, executor);
                    CurrencyInfoFace.register(as, ccm, 'currency.info', executor);

                    LimitsService.register(as, executor);
                    LimitsFace.register(as, ccm, 'xfer.limits', executor);

                    MockAccountsService.register(as, executor);
                    AccountsFace.register(as, ccm, 'xfer.accounts', executor);
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    console.log(as.state.last_exception);
                }
            );
        });
        
        it('should create account holders', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder(
                        as,
                        'user1@external.id',
                        'default',
                        true,
                        false,
                        { usr1: true },
                        { int1: true }
                    );
                    xferacct.addAccountHolder(
                        as,
                        'user2@external.id',
                        'other',
                        false,
                        true,
                        { usr2: true },
                        { int2: true }
                    );
                    as.add( (as, last_id) => {
                        xferacct.getAccountHolderExt( as, 'user1@external.id' );
                        as.add( (as, res) => {
                            expect(res).to.have.property('created');
                            expect(res).to.have.property('updated');
                            expect(res.created).to.equal(res.updated);
                            expect(res).to.eql({
                                id: res.id,
                                ext_id: 'user1@external.id',
                                group: 'default',
                                enabled: true,
                                kyc: false,
                                data: { usr1: true },
                                internal: { int1: true },
                                created: res.created,
                                updated: res.updated,
                            });
                        });
                        
                        xferacct.getAccountHolder( as, last_id );
                        as.add( (as, res) => {
                            expect(res).to.have.property('created');
                            expect(res).to.have.property('updated');
                            expect(res.created).to.equal(res.updated);
                            expect(res).to.eql({
                                id: last_id,
                                ext_id: 'user2@external.id',
                                group: 'other',
                                enabled: false,
                                kyc: true,
                                data: { usr2: true },
                                internal: { int2: true },
                                created: res.created,
                                updated: res.updated,
                            });
                        });
                    } );
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should update account holders', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder(
                        as,
                        'user3@external.id',
                        'default',
                        true,
                        true,
                        {},
                        {}
                    );
                    as.add( (as, last_id) => {
                        xferacct.updateAccountHolder(
                            as,
                            last_id,
                            'other',
                            false,
                            null,
                            { d: true },
                            null
                        );
                        xferacct.getAccountHolder( as, last_id );
                        as.add( (as, res) => {
                            expect(res).to.eql({
                                id: last_id,
                                ext_id: 'user3@external.id',
                                group: 'other',
                                enabled: false,
                                kyc: true,
                                data: { d: true },
                                internal: {},
                                created: res.created,
                                updated: res.updated,
                            });
                        });
                        
                        xferacct.updateAccountHolder(
                            as,
                            last_id,
                            null,
                            null,
                            false,
                            null,
                            { i: 1 }
                        );
                        xferacct.getAccountHolder( as, last_id );
                        as.add( (as, res) => {
                            expect(res).to.eql({
                                id: last_id,
                                ext_id: 'user3@external.id',
                                group: 'other',
                                enabled: false,
                                kyc: false,
                                data: { d: true },
                                internal: { i: 1 },
                                created: res.created,
                                updated: res.updated,
                            });
                        });
                    } );
                    
                    xferacct.addAccountHolder(
                        as,
                        'user4@external.id',
                        'default',
                        false,
                        false,
                        {},
                        {}
                    );
                    as.add( (as, last_id) => {
                        ccm.db('xfer')
                            .update('account_holders')
                            .set('updated', '2010-10-10')
                            .where('uuidb64', last_id)
                            .execute(as);
                        xferacct.updateAccountHolder(
                            as,
                            last_id,
                            'other',
                            null,
                            true,
                            { d: true },
                            null
                        );
                        xferacct.getAccountHolder( as, last_id );
                        as.add( (as, res) => {
                            expect(res.updated.substr(0,4)).not.equal('2010');
                            expect(res).to.eql({
                                id: last_id,
                                ext_id: 'user4@external.id',
                                group: 'other',
                                enabled: false,
                                kyc: true,
                                data: { d: true },
                                internal: {},
                                created: res.created,
                                updated: res.updated,
                            });
                        });
                        
                        xferacct.updateAccountHolder(
                            as,
                            last_id,
                            null,
                            true,
                            null,
                            null,
                            { i: 1 }
                        );
                        xferacct.getAccountHolder( as, last_id );
                        as.add( (as, res) => {
                            //expect(res.created).not.equal(res.updated);
                            expect(res).to.eql({
                                id: last_id,
                                ext_id: 'user4@external.id',
                                group: 'other',
                                enabled: true,
                                kyc: true,
                                data: { d: true },
                                internal: { i: 1 },
                                created: res.created,
                                updated: res.updated,
                            });
                        });
                    } );
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should create account holders in time', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    const p = as.parallel();
                    
                    for ( let i = 0; i < 100; ++i ) {
                        p.add( (as) => {
                            xferacct.addAccountHolder(
                                as,
                                `spi${i}@external.id`,
                                'default',
                                !!(i%2),
                                !!((i+1)%2),
                                { pub: i },
                                { int: i, bafsafasfa: 'asdsadsasdfa' }
                            );
                        });
                    }
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should detect account holder errors', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownLimitGroup on add';
                            xferacct.addAccountHolder(
                                as,
                                'errortest@example.org',
                                'UnknownGroup',
                                false, false, {}, {}
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownLimitGroup' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'DuplicateExtID on add';
                            xferacct.addAccountHolder(
                                as,
                                'dup@example.org',
                                'default',
                                false, false, {}, {}
                            );
                             xferacct.addAccountHolder(
                                as,
                                'dup@example.org',
                                'default',
                                false, false, {}, {}
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'DuplicateExtID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownLimitGroup on update';
                            xferacct.addAccountHolder(
                                as,
                                'updateerrtest@example.org',
                                'default',
                                false, false, {}, {}
                            );
                            as.add( (as, last_id) => {
                                xferacct.updateAccountHolder(
                                    as,
                                    last_id,
                                    'UnknownGroup'
                                );
                            });
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownLimitGroup' ) {
                                as.success();
                            }
                        }
                    );
                    
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownAccountHolder on update';
                            xferacct.updateAccountHolder(
                                as,
                                '1234567890123456789012',
                                'default'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountHolder' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownAccountHolder on get';
                            xferacct.getAccountHolder(
                                as,
                                '1234567890123456789012'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountHolder' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownAccountHolder on getext';
                            xferacct.getAccountHolderExt(
                                as,
                                'unknown@example.org'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountHolder' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'NotImplemented on merge';
                            xferacct.mergeAccountHolders(
                                as,
                                '1234567890123456789012',
                                '1234567890123456789012'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'NotImplemented' ) {
                                as.success();
                            }
                        }
                    );
                },
                (as, err) => {
                    console.log(as.state.test_name);
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should create accounts', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder(
                        as,
                        'SYSTEM',
                        'default',
                        true,
                        true,
                        {},
                        {}
                    );
                    
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'Source'
                        );
                        xferacct.addAccount(
                            as,
                            holder,
                            'System',
                            'I:EUR',
                            'Sync'
                        );
                        
                        xferacct.listAccounts(as, holder);
                        
                        as.add( (as, res) => {
                            expect(res).to.be.lengthOf(2);
                            xferacct.getAccount(as, res[0].id);
                            xferacct.getAccount(as, res[1].id);
                        });
                    });
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should update accounts', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder(
                        as,
                        'EXTSVC',
                        'default',
                        true,
                        true,
                        {},
                        {}
                    );
                    
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'External',
                            'I:EUR',
                            'Buffer'
                        );
                        
                        as.add( (as, last_id) => {
                            xferacct.updateAccount(
                                as,
                                last_id,
                                'Buffer2',
                                false
                            );
                            as.add( (as, res) => expect(res).to.be.true );
                        
                            xferacct.listAccounts(as, holder);
                            
                            as.add( (as, res) => {
                                expect(res).to.be.lengthOf(1);
                                xferacct.getAccount(as, res[0].id);
                                as.add( (as, res) => expect(res).to.eql({
                                    id: last_id,
                                    type: 'External',
                                    currency: 'I:EUR',
                                    alias: 'Buffer2',
                                    enabled: false,
                                    ext_id: null,
                                    rel_id: null,
                                    balance: '0.00',
                                    reserved: '0.00',
                                    overdraft: '0.00',
                                    created: res.created,
                                    updated: res.updated,
                                }) );
                            });
                        });
                    });
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should set overdraft', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder(
                        as,
                        'Overdrafter',
                        'default',
                        true,
                        true,
                        {},
                        {}
                    );
                    
                    as.add( (as, holder) => {
                        xferacct.addAccount(
                            as,
                            holder,
                            'Regular',
                            'I:EUR',
                            'Overdraft'
                        );
                        
                        as.add( (as, last_id) => {
                            xferacct.setOverdraft(
                                as,
                                last_id,
                                'I:EUR',
                                '123.45'
                            );
                            as.add( (as, res) => expect(res).to.be.true );
                        
                            xferacct.listAccounts(as, holder);
                            
                            as.add( (as, res) => {
                                expect(res).to.be.lengthOf(1);
                                xferacct.getAccount(as, res[0].id);
                                as.add( (as, res) => expect(res).to.eql({
                                    id: last_id,
                                    type: 'Regular',
                                    currency: 'I:EUR',
                                    alias: 'Overdraft',
                                    enabled: true,
                                    ext_id: null,
                                    rel_id: null,
                                    balance: '0.00',
                                    reserved: '0.00',
                                    overdraft: '123.45',
                                    created: res.created,
                                    updated: res.updated,
                                }) );
                            });
                            
                            xferacct.setOverdraft(
                                as,
                                last_id,
                                'I:EUR',
                                '0'
                            );
                            as.add( (as, res) => expect(res).to.be.true );
                        
                            xferacct.listAccounts(as, holder);
                            
                            as.add( (as, res) => {
                                expect(res).to.be.lengthOf(1);
                                xferacct.getAccount(as, res[0].id);
                                as.add( (as, res) => expect(res).to.eql({
                                    id: last_id,
                                    type: 'Regular',
                                    currency: 'I:EUR',
                                    alias: 'Overdraft',
                                    enabled: true,
                                    ext_id: null,
                                    rel_id: null,
                                    balance: '0.00',
                                    reserved: '0.00',
                                    overdraft: '0.00',
                                    created: res.created,
                                    updated: res.updated,
                                }) );
                            });
                        });
                    });
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        });
        
        it('should detect account errors', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownHolderID on add';
                            xferacct.addAccount(
                                as,
                                '1234567890123456789012',
                                'External',
                                'I:EUR',
                                'Buffer'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownHolderID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownCurrency on add';
                    
                            xferacct.addAccountHolder(
                                as,
                                'INVCURR',
                                'default',
                                true,
                                true,
                                {},
                                {}
                            );
                    
                            as.add( (as, holder) => {
                                xferacct.addAccount(
                                    as,
                                    holder,
                                    'External',
                                    'I:MISS',
                                    'Buffer'
                                );
                            });
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
                            as.state.test_name = 'UnknownAccountID on update';
                            xferacct.updateAccount(
                                as,
                                '1234567890123456789012',
                                'Alias',
                                false
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownAccountID on overdraft';
                            xferacct.setOverdraft(
                                as,
                                '1234567890123456789012',
                                'I:EUR',
                                '123'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'CurrencyMismatch on overdraft';
                    
                            xferacct.addAccountHolder(
                                as,
                                'INVCURROVER',
                                'default',
                                true,
                                true,
                                {},
                                {}
                            );
                    
                            as.add( (as, holder) => {
                                xferacct.addAccount(
                                    as,
                                    holder,
                                    'Regular',
                                    'I:EUR',
                                    'OV'
                                );
                                
                                as.add( (as, account_id) => {
                                    xferacct.setOverdraft(
                                        as,
                                        account_id,
                                        'I:USD',
                                        '123'
                                    );
                                });
                            });
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'CurrencyMismatch' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownAccountID on get';
                            xferacct.getAccount(
                                as,
                                '1234567890123456789012'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownAccountID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownHolderID on list';
                            xferacct.listAccounts(
                                as,
                                '1234567890123456789012'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownHolderID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'NotImplemented on convert';
                            xferacct.convertAccount(
                                as,
                                '1234567890123456789012',
                                'I:MISS'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'NotImplemented' ) {
                                as.success();
                            }
                        }
                    );
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();            
        });
        
        it('should get account holder limit stats', function(done) {
            as.add(
                ( as ) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    xferacct.addAccountHolder(
                        as,
                        'LimitsTest@example.com',
                        'default',
                        true, true,
                        {}, {} );
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add(
                (as, holder) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    const db = ccm.db('xfer');
                    
                    // Insert + select
                    //---
                    const retail_val = {
                        currency: 'I:EUR',
                        stats:
                        {
                            retail_daily_amt: '0.00',
                            retail_daily_cnt: 0,
                            retail_weekly_amt: '0.00',
                            retail_weekly_cnt: 0,
                            retail_monthly_amt: '0.00',
                            retail_monthly_cnt: 0,
                        }
                    }
                    
                    xferacct.getLimitStats( as, holder, 'Retail' );
                    
                    as.add( (as, res) => {
                        expect(res).to.eql(retail_val);
                    });
                    
                                                            
                    xferacct.getLimitStats( as, holder, 'Retail' );
                    
                    as.add( (as, res) => {
                        expect(res).to.eql(retail_val);
                    });
                    //---
                    
                    // just select
                    //---
                    db.insert('limit_deposits_stats').set({
                        holder,
                        currency_id: 1,
                        stats_date: moment.utc(MOCK_TODAY).format('YYYY-MM-DD'),
                        deposit_daily_amt: '123',
                        deposit_daily_cnt: 2,
                        withdrawal_daily_amt: '345',
                        withdrawal_daily_cnt: 4,
                        deposit_weekly_amt: '567',
                        deposit_weekly_cnt: 6,
                        withdrawal_weekly_amt: '789',
                        withdrawal_weekly_cnt: 8,
                        deposit_monthly_amt: '901',
                        deposit_monthly_cnt: 10,
                        withdrawal_monthly_amt: '1134',
                        withdrawal_monthly_cnt: 12,
                    }).execute(as);
                    xferacct.getLimitStats( as, holder, 'Deposits' );
                    
                    as.add( (as, res) => {
                        expect(res).to.eql({
                            currency: 'I:EUR',
                            stats:
                            {
                                deposit_daily_amt: '1.23',
                                deposit_daily_cnt: 2,
                                withdrawal_daily_amt: '3.45',
                                withdrawal_daily_cnt: 4,
                                deposit_weekly_amt: '5.67',
                                deposit_weekly_cnt: 6,
                                withdrawal_weekly_amt: '7.89',
                                withdrawal_weekly_cnt: 8,
                                deposit_monthly_amt: '9.01',
                                deposit_monthly_cnt: 10,
                                withdrawal_monthly_amt: '11.34',
                                withdrawal_monthly_cnt: 12, } });
                    });
                    
                    // select + reset day
                    //---
                     db.insert('limit_payments_stats').set({
                        holder,
                        currency_id: 1,
                        stats_date: moment.utc(MOCK_TODAY).subtract(1, 'days').format('YYYY-MM-DD'),
                        outbound_daily_amt: '123',
                        outbound_daily_cnt: 2,
                        inbound_daily_amt: '345',
                        inbound_daily_cnt: 3,
                        outbound_weekly_amt: '456',
                        outbound_weekly_cnt: 5,
                        inbound_weekly_amt: '678',
                        inbound_weekly_cnt: 9,
                        outbound_monthly_amt: '1211',
                        outbound_monthly_cnt: 13,
                        inbound_monthly_amt: '1456',
                        inbound_monthly_cnt: 15,
                    }).execute(as);
                    
                    xferacct.getLimitStats( as, holder, 'Payments' );
                    as.add( (as, res) => {
                        expect(res).to.eql({
                            currency: 'I:EUR',
                            stats:
                            {
                                outbound_daily_amt: '0.00',
                                outbound_daily_cnt: 0,
                                inbound_daily_amt: '0.00',
                                inbound_daily_cnt: 0,
                                outbound_weekly_amt: '4.56',
                                outbound_weekly_cnt: 5,
                                inbound_weekly_amt: '6.78',
                                inbound_weekly_cnt: 9,
                                outbound_monthly_amt: '12.11',
                                outbound_monthly_cnt: 13,
                                inbound_monthly_amt: '14.56',
                                inbound_monthly_cnt: 15,
                            } });
                    });
                    
                    // select + reset week
                    //---
                    db.insert('limit_gaming_stats').set({
                        holder,
                        currency_id: 1,
                        stats_date: moment.utc(MOCK_TODAY).subtract(1, 'weeks').format('YYYY-MM-DD'),
                        bet_daily_amt: '123',
                        bet_daily_cnt: 2,
                        win_daily_amt: '345',
                        win_daily_cnt: 4,
                        profit_daily_amt: '567',
                        bet_weekly_amt: '678',
                        bet_weekly_cnt: 7,
                        win_weekly_amt: '890',
                        win_weekly_cnt: 9,
                        profit_weekly_amt: '1011',
                        bet_monthly_amt: '1112',
                        bet_monthly_cnt: 12,
                        win_monthly_amt: '1314',
                        win_monthly_cnt: 13,
                        profit_monthly_amt: '1415',
                    }).execute(as);
                    
                    xferacct.getLimitStats( as, holder, 'Gaming' );
                    as.add( (as, res) => {
                        expect(res).to.eql({
                            currency: 'I:EUR',
                            stats:
                            {
                                bet_daily_amt: '0.00',
                                bet_daily_cnt: 0,
                                win_daily_amt: '0.00',
                                win_daily_cnt: 0,
                                profit_daily_amt: '0.00',
                                bet_weekly_amt: '0.00',
                                bet_weekly_cnt: 0,
                                win_weekly_amt: '0.00',
                                win_weekly_cnt: 0,
                                profit_weekly_amt: '0.00',
                                bet_monthly_amt: '11.12',
                                bet_monthly_cnt: 12,
                                win_monthly_amt: '13.14',
                                win_monthly_cnt: 13,
                                profit_monthly_amt: '14.15',
                            }
                        });
                    });
                    
                    // select + reset month
                    //---
                    db.insert('limit_misc_stats').set({
                        holder,
                        currency_id: 1,
                        stats_date: moment.utc(MOCK_TODAY).subtract(1, 'month').format('YYYY-MM-DD'),
                        message_daily_cnt: 1,
                        failure_daily_cnt: 2,
                        limithit_daily_cnt: 3,
                        message_weekly_cnt: 4,
                        failure_weekly_cnt: 5,
                        limithit_weekly_cnt: 6,
                        message_monthly_cnt: 7,
                        failure_monthly_cnt: 8,
                        limithit_monthly_cnt: 9,
                    }).execute(as);
                    
                    xferacct.getLimitStats( as, holder, 'Misc' );
                    as.add( (as, res) => {
                        expect(res).to.eql({
                            currency: 'I:EUR',
                            stats:
                            {
                                message_daily_cnt: 0,
                                failure_daily_cnt: 0,
                                limithit_daily_cnt: 0,
                                message_weekly_cnt: 0,
                                failure_weekly_cnt: 0,
                                limithit_weekly_cnt: 0,
                                message_monthly_cnt: 0,
                                failure_monthly_cnt: 0,
                                limithit_monthly_cnt: 0,
                            },
                        });
                    });
                    
                    //---
                    xferacct.getLimitStats( as, holder, 'Personnel' );
                },
                (as, err) => {
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();
        } );
        
        it('should update stats currency on full reset', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
            
                    xferacct.addAccountHolder(
                        as,
                        'CurrencyMismatchUpdate@example.com',
                        'default',
                        true, true,
                        {}, {} );
                    
                    as.add( (as, holder) => {
                        ccm.db('xfer').insert('limit_retail_stats').set({
                            holder,
                            currency_id: 2,
                            stats_date: moment.utc(MOCK_TODAY).subtract(1, 'month').format('YYYY-MM-DD'),
                        }).execute(as);
                        
                        xferacct.getLimitStats(
                            as,
                            holder,
                            'Retail'
                        );
                    } );
                },
                (as, err) => {
                    console.log(as.state.test_name);
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();  
        });
        
        it('should workaround insert duplicate', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    const impl = executor._impls['futoin.xfer.accounts']['1'];
                    const orig_f = impl.getLimitStats;
                    
                    impl.getLimitStats = function(as, reqinfo) {
                        const orig_res = reqinfo.result;
                        let first = true;
                        reqinfo.result = function( res ) {
                            if (first) {
                                first = false;
                                throw new Error('Duplicate');
                            }
                            
                            orig_res.apply( this, [ res ] );
                        };
                        orig_f.apply(this, [as, reqinfo]);
                    };
            
                    xferacct.addAccountHolder(
                        as,
                        'InsertRace@example.com',
                        'default',
                        true, true,
                        {}, {} );
                    
                    as.add( (as, holder) => {
                        xferacct.getLimitStats(
                            as,
                            holder,
                            'Retail'
                        );
                    } );
                },
                (as, err) => {
                    console.log(as.state.test_name);
                    console.log(err);
                    console.log(as.state.error_info);
                    done(as.state.last_exception || 'Fail');
                }
            );
            as.add( (as) => done() );
            as.execute();  
        });
        
        it('should get account holder limit stats', function(done) {
            as.add(
                (as) => {
                    const xferacct = ccm.iface('xfer.accounts');
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'UnknownHolderID';
                            xferacct.getLimitStats(
                                as,
                                '1234567890123456789012',
                                'Retail'
                            );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'UnknownHolderID' ) {
                                as.success();
                            }
                        }
                    );
                    
                    as.add(
                        (as) => {
                            as.state.test_name = 'InternalError on currency mismatch';
                         
                            xferacct.addAccountHolder(
                                as,
                                'CurrencyMismatch@example.com',
                                'default',
                                true, true,
                                {}, {} );
                            
                            as.add( (as, holder) => {
                                ccm.db('xfer').insert('limit_retail_stats').set({
                                    holder,
                                    currency_id: 2,
                                    stats_date: moment.utc(MOCK_TODAY).subtract(1, 'day').format('YYYY-MM-DD'),
                                }).execute(as);
                                xferacct.getLimitStats(
                                    as,
                                    holder,
                                    'Retail'
                                );
                                as.add( (as, res) => console.log(res) );
                            } );
                            as.add( (as) => as.error('Fail') );
                        },
                        (as, err) => {
                            if ( err === 'InternalError' ) {
                                as.success();
                            }
                        }
                    );
                },
                (as, err) => {
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
