'use strict';

const BaseService = require( './BaseService' );
const moment = require( 'moment' );

const AccountsFace = require( './AccountsFace' );
const UUIDTool = require( './UUIDTool' );
const AmountTools = require( './AmountTools' );
const {
    DB_ACCOUNT_HOLDERS_TABLE,
    DB_ACCOUNTS_TABLE,
    DB_CURRENCY_TABLE,
    DB_DOMAIN_LIMITS_TABLE,
    DB_LIMIT_GROUPS_TABLE,
    limitStatsTable,
} = require( './main' );

const SYM_GET_AH_ID = Symbol( 'getAccountHolder' );
const SYM_GET_AH_EXTID = Symbol( 'getAccountHolderExt' );
const SYM_GET_ACCOUNT = Symbol( 'getAccount' );
const SYM_LIST_ACCOUNTS = Symbol( 'listAccounts' );
const SYM_GET_LIMIT_STATS = Symbol( 'getLimitStats1' );

/**
 * Accounts Service
 */
class AccountsService extends BaseService {
    static get IFACE_IMPL() {
        return AccountsFace;
    }

    //=============

    addAccountHolder( as, reqinfo ) {
        as.add(
            ( as ) => {
                const p = reqinfo.params();
                const db = reqinfo.executor().ccm().db( 'xfer' );

                const xfer = db.newXfer();
                const now = xfer.helpers().now();
                const uuidb64 = UUIDTool.genXfer( xfer );

                const sq = xfer.select( DB_LIMIT_GROUPS_TABLE, { selected: 1,
                    result: true } )
                    .get( 'id' )
                    .where( 'group_name', p.group );

                const iq = xfer.insert( DB_ACCOUNT_HOLDERS_TABLE );
                iq.set( {
                    uuidb64,
                    ext_id: p.ext_id,
                    group_id: iq.backref( sq, 'id' ),
                    enabled: p.enabled ? 'Y' : 'N',
                    kyc: p.kyc ? 'Y' : 'N',
                    data: JSON.stringify( p.data ),
                    internal: JSON.stringify( p.internal ),
                    created: now,
                    updated: now,
                } );

                xfer.execute( as );

                as.add( ( as ) => reqinfo.result( uuidb64 ) );
            },
            ( as, err ) => {
                if ( err === 'XferCondition' ) {
                    as.error( 'UnknownLimitGroup' );
                }

                if ( err === 'Duplicate' ) {
                    as.error( 'DuplicateExtID' );
                }
            }
        );
    }

    updateAccountHolder( as, reqinfo ) {
        as.add(
            ( as ) => {
                const p = reqinfo.params();
                const db = reqinfo.executor().ccm().db( 'xfer' );

                const xfer = db.newXfer();
                let sq;

                if ( p.group !== null ) {
                    sq = xfer.select( DB_LIMIT_GROUPS_TABLE, { selected: 1 } )
                        .get( 'id' )
                        .where( 'group_name', p.group );
                }

                const iq = xfer.update( DB_ACCOUNT_HOLDERS_TABLE, { affected: 1 } );
                const toset = {};

                if ( p.group !== null ) {
                    toset.group_id = iq.backref( sq, 'id' );
                }

                if ( p.enabled !== null ) {
                    toset.enabled = p.enabled ? 'Y' : 'N';
                }

                if ( p.kyc !== null ) {
                    toset.kyc = p.kyc ? 'Y' : 'N';
                }

                if ( p.data !== null ) {
                    toset.data = JSON.stringify( p.data );
                }

                if ( p.internal !== null ) {
                    toset.internal = JSON.stringify( p.internal );
                }

                iq.set( toset ).where( 'uuidb64', p.id );
                iq.set( 'updated', xfer.helpers().now() );

                xfer.execute( as );

                as.add( ( as ) => reqinfo.result( true ) );
            },
            ( as, err ) => {
                if ( err === 'XferCondition' ) {
                    if ( as.state.error_info.startsWith( 'Affected' ) ) {
                        as.error( 'UnknownAccountHolder' );
                    } else {
                        as.error( 'UnknownLimitGroup' );
                    }
                }
            }
        );
    }

    _getAccountHolderCommon( as, reqinfo, sym, field, value ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db
            .getPrepared( sym, ( db ) => {
                const qb = db.select( [ DB_ACCOUNT_HOLDERS_TABLE, 'A' ] )
                    .innerJoin( DB_LIMIT_GROUPS_TABLE,
                        `${DB_LIMIT_GROUPS_TABLE}.id = group_id` )
                    .get( [ 'A.*', 'group_name' ] );
                qb.where( field, qb.param( 'value' ) );
                return qb.prepare();
            } )
            .executeAssoc( as, { value } );

        as.add( ( as, rows ) => {
            if ( rows.length !== 1 ) {
                as.error( 'UnknownAccountHolder' );
            }

            const r = rows[0];

            reqinfo.result( {
                id: r.uuidb64,
                ext_id: r.ext_id,
                group: r.group_name,
                enabled: r.enabled === 'Y',
                kyc: r.kyc === 'Y',
                data: JSON.parse( r.data ),
                internal: JSON.parse( r.internal ),
                created: moment.utc( r.created ).format(),
                updated: moment.utc( r.updated ).format(),
            } );
        } );
    }

    getAccountHolder( as, reqinfo ) {
        this._getAccountHolderCommon( as, reqinfo,
            SYM_GET_AH_ID, 'uuidb64',
            reqinfo.params().id );
    }

    getAccountHolderExt( as, reqinfo ) {
        this._getAccountHolderCommon( as, reqinfo,
            SYM_GET_AH_EXTID,
            'ext_id', reqinfo.params().ext_id );
    }

    mergeAccountHolders( as, _reqinfo ) {
        // TODO:
        as.error( 'NotImplemented' );
    }

    //=============

    addAccount( as, reqinfo ) {
        as.add(
            ( as ) => {
                const p = reqinfo.params();
                const db = reqinfo.executor().ccm().db( 'xfer' );

                //---
                db.select( DB_ACCOUNT_HOLDERS_TABLE )
                    .get( 'uuidb64' )
                    .where( 'uuidb64', p.holder )
                    .execute( as );
                as.add( ( as, { rows } ) => {
                    if ( rows.length !== 1 ) {
                        as.error( 'UnknownHolderID' );
                    }
                } );

                //---
                const xfer = db.newXfer();
                const now = xfer.helpers().now();
                const uuidb64 = UUIDTool.genXfer( xfer );

                const cq = xfer.select( DB_CURRENCY_TABLE, { selected: 1 } )
                    .get( 'id' )
                    .where( 'code', p.currency );


                const iq = xfer.insert( DB_ACCOUNTS_TABLE );
                iq.set( {
                    uuidb64,
                    holder: p.holder,
                    currency_id: iq.backref( cq, 'id' ),
                    created: now,
                    updated: now,
                    balance: '0',
                    reserved: '0',
                    enabled: p.enabled ? 'Y' : 'N',
                    acct_type: p.type,
                    acct_alias: p.alias,
                    rel_uuidb64: p.rel_id,
                    ext_acct_id: p.ext_id,
                } );
                xfer.execute( as );

                as.add( ( as ) => reqinfo.result( uuidb64 ) );
            },
            ( as, err ) => {
                if ( err === 'XferCondition' ) {
                    as.error( 'UnknownCurrency' );
                }
            }
        );
    }

    updateAccount( as, reqinfo ) {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );

        const q = db.update( DB_ACCOUNTS_TABLE );
        q.set( 'updated', q.helpers().now() );
        q.where( 'uuidb64', p.id );

        if ( p.alias !== null ) {
            q.set( 'acct_alias', p.alias );
        }

        if ( p.enabled !== null ) {
            q.set( 'enabled', p.enabled ? 'Y' : 'N' );
        }

        q.execute( as );

        as.add( ( as, { affected } ) => {
            if ( affected !== 1 ) {
                as.error( 'UnknownAccountID' );
            }

            reqinfo.result( true );
        } );
    }

    _accountInfo( raw ) {
        return {
            id: raw.uuidb64,
            type: raw.acct_type,
            currency: raw.code,
            alias: raw.acct_alias,
            enabled: ( raw.enabled === 'Y' ),
            ext_id: raw.ext_acct_id,
            rel_id: raw.rel_uuidb64,
            balance: AmountTools.fromStorage( raw.balance, raw.dec_places ),
            reserved: AmountTools.fromStorage( raw.reserved, raw.dec_places ),
            created: moment.utc( raw.created ).format(),
            updated: moment.utc( raw.updated ).format(),
        };
    }

    getAccount( as, reqinfo ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db
            .getPrepared( SYM_GET_ACCOUNT, ( db ) => {
                const qb = db.select( [ DB_ACCOUNTS_TABLE, 'A' ] )
                    .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                        'C.id = A.currency_id' )
                    .get( [ 'A.*', 'C.code', 'C.dec_places' ] );
                qb.where( 'A.uuidb64', qb.param( 'id' ) );
                return qb.prepare();
            } )
            .executeAssoc( as, reqinfo.params() );

        as.add( ( as, rows ) => {
            if ( rows.length !== 1 ) {
                as.error( 'UnknownAccountID' );
            }

            reqinfo.result( this._accountInfo( rows[0] ) );
        } );
    }

    listAccounts( as, reqinfo ) {
        as.add(
            ( as ) => {
                const db = reqinfo.executor().ccm().db( 'xfer' );

                db
                    .getPrepared( SYM_LIST_ACCOUNTS, ( db ) => {
                        const xfer = db.newXfer();
                        const ph_holder = xfer.param( 'holder' );
                        xfer.select( DB_ACCOUNT_HOLDERS_TABLE,
                            { selected: 1 } )
                            .get( 'uuidb64' )
                            .where( 'uuidb64', ph_holder );
                        xfer.select( [ DB_ACCOUNTS_TABLE, 'A' ],
                            { result: true } )
                            .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                                'C.id = A.currency_id' )
                            .get( [ 'A.*', 'C.code', 'C.dec_places' ] )
                            .where( 'holder', ph_holder );
                        return xfer.prepare();
                    } )
                    .executeAssoc( as, reqinfo.params() );

                as.add( ( as, results ) => {
                    const res = results[0].rows.map(
                        v => this._accountInfo( v ) );
                    reqinfo.result( res );
                } );
            },
            ( as, err ) => {
                if ( err === 'XferCondition' ) {
                    as.error( 'UnknownHolderID' );
                }
            }
        );
    }

    convertAccount( as, _reqinfo ) {
        as.error( 'NotImplemented' );
    }

    //=============

    _limitStats( row ) {
        const stats = {};

        for ( let [ k, v ] of Object.entries( row ) ) {
            if ( k.endsWith( '_cnt' ) ) {
                stats[k] = v;
            } else if ( AmountTools.isAmountField( k ) ) {
                stats[k] = AmountTools.fromStorage( v, row.dec_places );
            }
        }

        return {
            currency: row.code,
            stats,
        };
    }

    _today() {
        // TODO: system timezone
        return moment().utc().format( 'YYYY-MM-DD' );
    }

    getLimitStats( as, reqinfo ) {
        const p = reqinfo.params();
        const holder = p.holder;
        const domain = p.domain;

        const db = reqinfo.executor().ccm().db( 'xfer' );
        const qb = db.queryBuilder();
        const table = limitStatsTable( domain );

        const today = this._today();

        as.add(
            ( as ) => {
                db
                    .getPrepared( SYM_GET_LIMIT_STATS, ( db ) => {
                        const xfer = db.newXfer();
                        const ph_holder = xfer.param( 'holder' );
                        xfer.select( DB_ACCOUNT_HOLDERS_TABLE,
                            { selected: 1 } )
                            .get( 'uuidb64' )
                            .where( 'uuidb64', ph_holder );
                        xfer.select( [ xfer.param( 'table' ), 'S' ],
                            { result: true } )
                            .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                                'C.id = S.currency_id' )
                            .get( [ 'S.*', 'C.code', 'C.dec_places' ] )
                            .where( 'holder', ph_holder );
                        return xfer.prepare();
                    } )
                    .executeAssoc( as, {
                        holder,
                        table : qb.expr( table ),
                    } );
            },
            ( as, err ) => {
                if ( err === 'XferCondition' ) {
                    as.error( 'UnknownHolderID' );
                }
            }
        );
        as.add(
            ( as, res ) => {
                const row = res[0].rows[0];

                if ( row &&
                     ( moment.utc( row.stats_date ).isSameOrAfter( today ) )
                ) {
                    reqinfo.result( this._limitStats( row ) );
                    return;
                }

                if ( !row ) {
                    const sel_currency_id = db
                        .select( [ DB_ACCOUNT_HOLDERS_TABLE, 'A' ] )
                        .innerJoin( [ DB_DOMAIN_LIMITS_TABLE, 'L' ],
                            'L.lim_id = A.group_id' )
                        .get( 'L.currency_id' )
                        .where( {
                            'A.uuidb64': holder,
                            'L.lim_domain' : domain,
                        } );

                    const xfer = db.newXfer();
                    xfer.insert( table )
                        .set( {
                            holder,
                            currency_id: sel_currency_id,
                            stats_date: today,
                        } );
                    xfer.select( [ table, 'S' ],
                        { selected: 1,
                            result: true } )
                        .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                            'C.id = S.currency_id' )
                        .get( [ 'S.*', 'C.code', 'C.dec_places' ] )
                        .where( 'holder', holder );

                    xfer.executeAssoc( as );

                    as.add( ( as, res ) => {
                        // For manual testing of race condition
                        //as.error('Duplicate');
                        reqinfo.result( this._limitStats( res[0].rows[0] ) );
                    } );
                } else {
                    as.success( 'Update', row );
                }
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    as.success( 'Select' );
                }
            }
        );
        as.add( ( as, action, row ) => {
            if ( action === 'Select' ) {
                db.select( [ table, 'S' ] )
                    .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                        'C.id = S.currency_id' )
                    .get( [ 'S.*', 'C.code', 'C.dec_places' ] )
                    .where( 'holder', holder )
                    .executeAssoc( as );
                as.add( ( as, rows ) => {
                    reqinfo.result( this._limitStats( rows[0] ) );
                } );
            } else if ( action == 'Update' ) {
                const stats_date = moment.utc( row.stats_date );
                const week_start = moment.utc( today ).startOf( 'week' );
                const month_start = moment.utc( today ).startOf( 'month' );

                // ---
                const stats = { stats_date: today };
                let full_reset = true;

                for ( let k in row ) {
                    if ( k.indexOf( '_daily_' ) > 0 ) {
                        stats[k] = '0';
                    }
                }

                if ( stats_date.isBefore( week_start ) ) {
                    for ( let k in row ) {
                        if ( k.indexOf( '_weekly_' ) > 0 ) {
                            stats[k] = '0';
                        }
                    }
                } else {
                    full_reset = false;
                }

                if ( stats_date.isBefore( month_start ) ) {
                    for ( let k in row ) {
                        if ( k.indexOf( '_monthly_' ) > 0 ) {
                            stats[k] = '0';
                        }
                    }
                } else {
                    full_reset = false;
                }
                // ---

                as.add(
                    ( as ) => {
                        // TODO: update currency for stats on mismatch
                        const sel_currency_id = db
                            .select( [ DB_ACCOUNT_HOLDERS_TABLE, 'A' ] )
                            .innerJoin( [ DB_DOMAIN_LIMITS_TABLE, 'L' ],
                                'L.lim_id = A.group_id' )
                            .get( 'L.currency_id' )
                            .where( {
                                'A.uuidb64': holder,
                                'L.lim_domain' : domain,
                            } );

                        const xfer = db.newXfer();
                        const uq = xfer.update( table, { affected: 1 } )
                            .set( stats )
                            .where( {
                                holder,
                                stats_date: row.stats_date,
                            } );

                        if ( full_reset ) {
                            uq.set( 'currency_id', sel_currency_id );
                        } else {
                            uq.where( 'currency_id', sel_currency_id );
                        }

                        xfer.select( [ table, 'S' ],
                            { selected: 1,
                                result: true } )
                            .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                                'C.id = S.currency_id' )
                            .get( [ 'S.*', 'C.code', 'C.dec_places' ] )
                            .where( 'holder', holder );

                        xfer.executeAssoc( as );

                        as.add( ( as, res ) => {
                            reqinfo.result( this._limitStats( res[0].rows[0] ) );
                        } );
                    },
                    ( as, err ) => {
                        if ( err === 'XferCondition' ) {
                            if ( as.state[ SYM_GET_LIMIT_STATS ] ) {
                                as.error(
                                    'InternalError',
                                    'Stats reset failure (currency mismatch?)'
                                );
                            } else {
                                as.state[ SYM_GET_LIMIT_STATS ] = true;
                                as.success( true );
                            }
                        }
                    }
                );
                as.add( ( as, retry ) => {
                    if ( retry ) {
                        this.getLimitStats( as, reqinfo );
                    }
                } );
            }
        } );
    }


    /**
     * Register futoin.xfer.accounts interface with Executor
     * 
     * @function AccountsService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {AccountsService} instance
     */
}

module.exports = AccountsService;
