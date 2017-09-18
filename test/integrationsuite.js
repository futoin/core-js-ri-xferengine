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

        as.add( (as) => {
            ccm.alias('#db.xfer', '#db.evt');
            ccm.alias('#db.xferdwh', '#db.evtdwh');
        } );
    });
    
    describe('Currency', function() {
        it('should work', function() {
            as.execute();
        });
    });
};
