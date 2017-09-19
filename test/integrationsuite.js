'use strict';

const expect = require( 'chai' ).expect;

const Executor = require('futoin-executor/Executor');

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
    });
};
