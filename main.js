'use strict';

/**
 * @file
 *
 * Copyright 2017 FutoIn Project (https://futoin.org)
 * Copyright 2017 Andrey Galkin <andrey@futoin.org>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
    DB_XFERS_TABLE : 'xfers',
    DB_RESERVATIONS_TABLE : 'reservations',
    DB_ROUNDS_TABLE : 'rounds',
    DB_ROUND_XFERS_TABLE : 'round_xfers',
    limitStatsTable: ( domain ) => `limit_${domain.toLowerCase()}_stats`,

    DB_IFACEVER : 'futoin.db.l2:1.0',
    EVTGEN_IFACEVER : 'futoin.evt.gen:1.0',

    EVTGEN_ALIAS : 'xfer.evtgen',

    historyTimeBarrier : null,
    setHistoryTimeBarrier : ( count, units ) => {
        main.historyTimeBarrier = () => moment.utc().subtract( count, units );
    },
};

main.setHistoryTimeBarrier( 30, 'days' );

module.exports = main;
