'use strict';

const child_process = require('child_process');
const $as = require('futoin-asyncsteps');
const AdvancedCCM = require('futoin-invoker/AdvancedCCM');
const DBAutoConfig = require('futoin-database/AutoConfig');
const integration_suite = require('./integrationsuite');
const fs = require('fs');

describe('SQLite', function(){
    
    const xfers_db = `${__dirname}/xfers.db`;
    
    before(function(done){
        this.timeout(30e3);
        const ccm = new AdvancedCCM();

        $as().add(
            (as) => {
                as.add((as) => {
                    const Executor = require('futoin-executor/Executor');
                    const SQLiteService = require( 'futoin-database/SQLiteService' );
                    
                    for (let f of [xfers_db]) {
                        if (fs.existsSync(f))
                        {
                            fs.unlinkSync(f);
                        }
                        
                        const executor = new Executor(ccm);
                        SQLiteService.register(as, executor, {
                            port: f,
                        });
                        
                        as.add( (as) => executor.close() );
                    }
                });
                as.add((as) => {
                    ccm.close();
                    
                    let res;
                    
                    res = child_process.spawnSync(
                        'cid',
                        [
                            'tool', 'exec', 'flyway', '--',
                            'migrate',
                            `-url=jdbc:sqlite:${xfers_db}`,
                            '-user=fake',
                            '-password=fake',
                            `-locations=filesystem:${__dirname}/../sql/sqlite,filesystem:${__dirname}/node_modules/futoin-eventstream/sql/active/sqlite`,
                        ]
                    );
                    if (res.status) {
                        console.log(res.stderr.toString());
                        as.error('Fail');
                    }
                });
            },
            (as, err) => {
                console.log(err);
                console.log(as.state.error_info);
                done(as.state.last_exception || 'Fail');
            }
        ).add( (as) => done() )
        .execute();
    });
    
    const vars = {
        as: null,
        ccm: null,
    };
    
    beforeEach('specific', function(){
        const ccm = new AdvancedCCM();
        const as = $as();
        vars.ccm = ccm;
        vars.as = as;

        as.add(
            (as) => {
                DBAutoConfig(as, ccm, {
                    xfer: {},
                }, {
                    DB_XFER_TYPE: 'sqlite',
                    DB_XFER_SOCKET: xfers_db,
                });
            },
            (as, err) => {
                console.log(err);
                console.log(as.state.error_info);
                console.log(as.state.last_exception);
            }
        );
    });
    
    afterEach(function() {
        vars.ccm.close();
        vars.ccm = null;
    });
    
    integration_suite(describe, it, vars);
});
