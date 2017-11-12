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
        executor = vars.executor = new Executor(ccm);
        
        executor.on('notExpected', function() {
            console.dir(arguments);
        });

        as.add(
            (as) => {
                ccm.alias('#db.xfer', '#db.evt');
                DBGenService.register( as, executor );
                DBGenFace.register( as, ccm, 'xfer.evtgen', executor );
            },
            (as, err) => {
                console.log(err);
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
            }            
        );
    });
    
    require('./currency_suite')( describe, it, vars );
    require('./limits_suite')( describe, it, vars );
    require('./accounts_suite')( describe, it, vars );
    require('./xfertools_suite')( describe, it, vars );
    require('./deposits_suite')( describe, it, vars );
};
