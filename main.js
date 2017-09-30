'use strict';

const path = require( 'path' );
const moment = require( 'moment' );

const main = {
    specDirs : path.resolve( __dirname, 'specs' ),
    PING_VERSION : '1.0',
    FTN19_VERSION : '1.0',

    DB_ACCOUNT_HOLDERS_TABLE : 'account_holders',
    DB_ACCOUNTS_TABLE : 'accounts',
    DB_ACCOUNTS_VIEW : 'v_accounts',
    DB_CURRENCY_TABLE : 'currencies',
    DB_EXRATE_TABLE : 'exrates',
    DB_DOMAIN_LIMITS_TABLE : 'domain_limits',
    DB_LIMIT_GROUPS_TABLE : 'limit_groups',
    DB_UUID_HISTORY_TABLE : 'uuid_history',
    DB_XFERS_TABLE : 'active_xfers',
    limitStatsTable: ( domain ) => `limit_${domain.toLowerCase()}_stats`,

    DB_IFACEVER : 'futoin.db.l2:1.0',
    EVTGEN_IFACEVER : 'futoin.evt.gen:1.0',

    historyTimeBarrier : null,
    setHistoryTimeBarrier : ( count, units ) => {
        main.historyTimeBarrier = () => moment.utc().subtract( count, units );
    },
};

main.setHistoryTimeBarrier( 30, 'days' );

module.exports = main;
