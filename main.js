'use strict';

const path = require( 'path' );

module.exports = {
    specDirs : path.resolve( __dirname, 'specs' ),
    PING_VERSION : '1.0',
    FTN19_VERSION : '1.0',

    DB_CURRENCY_TABLE : 'currencies',
    DB_EXRATE_TABLE : 'exrates',
    DB_LIMIT_GROUPS_TABLE : 'limit_groups',
    DB_DOMAIN_LIMITS_TABLE : 'domain_limits',
    DB_IFACEVER : 'futoin.db.l2:1.0',
    EVTGEN_IFACEVER : 'futoin.evt.gen:1.0',
};
