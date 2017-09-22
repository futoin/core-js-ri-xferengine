'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );

const AccountsFace = require( './AccountsFace' );
const UUIDTool = require( './UUIDTool' );
const AmountTools = require( './AmountTools' );
const {
    DB_IFACEVER,
    DB_ACCOUNT_HOLDERS_TABLE,
    DB_ACCOUNTS_TABLE,
    DB_CURRENCY_TABLE,
    DB_LIMIT_GROUPS_TABLE,
} = require( './main' );

/**
 * Accounts Service
 */
class AccountsService extends PingService {
    /**
     * Register futoin.xfer.accounts interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {AccountsService} instance
     */
    static register( as, executor, options={} ) {
        const ifacename = 'futoin.xfer.accounts';
        const ifacever = ifacename + ':' + AccountsFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ AccountsFace.spec(), PingFace.spec( AccountsFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.ccm().assertIface( '#db.xfer', DB_IFACEVER );

        return impl;
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

    _getAccountHolderCommon( as, reqinfo, field, value ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        const q = db.select( DB_ACCOUNT_HOLDERS_TABLE )
            .innerJoin( DB_LIMIT_GROUPS_TABLE,
                `${DB_LIMIT_GROUPS_TABLE}.id = group_id` )
            .get( [
                'uuidb64',
                'ext_id', 'group_name', 'enabled', 'kyc', 'data', 'internal',
                'created', 'updated',
            ] )
            .where( field, value );
        q.executeAssoc( as );

        as.add( ( as, rows ) => {
            if ( rows.length !== 1 ) {
                as.error( 'UnknownAccountHolder' );
            }

            const helpers = q.helpers();
            const r = rows[0];

            reqinfo.result( {
                id: r.uuidb64,
                ext_id: r.ext_id,
                group: r.group_name,
                enabled: r.enabled === 'Y',
                kyc: r.kyc === 'Y',
                data: JSON.parse( r.data ),
                internal: JSON.parse( r.internal ),
                created: helpers.nativeDate( r.created ).format(),
                updated: helpers.nativeDate( r.updated ).format(),
            } );
        } );
    }

    getAccountHolder( as, reqinfo ) {
        this._getAccountHolderCommon( as, reqinfo, 'uuidb64', reqinfo.params().id );
    }

    getAccountHolderExt( as, reqinfo ) {
        this._getAccountHolderCommon( as, reqinfo, 'ext_id', reqinfo.params().ext_id );
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
                    rel_uuid64: p.rel_id,
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

    _accountInfo( raw, helpers ) {
        return {
            id: raw.uuidb64,
            type: raw.acct_type,
            currency: raw.code,
            alias: raw.acct_alias,
            enabled: ( raw.enabled === 'Y' ),
            ext_id: raw.ext_acct_id,
            rel_id: raw.rel_uuid64,
            balance: AmountTools.fromStorage( raw.balance, raw.dec_places ),
            reserved: AmountTools.fromStorage( raw.reserved, raw.dec_places ),
            created: helpers.nativeDate( raw.created ).format(),
            updated: helpers.nativeDate( raw.updated ).format(),
        };
    }

    getAccount( as, reqinfo ) {
        const id = reqinfo.params().id;
        const db = reqinfo.executor().ccm().db( 'xfer' );

        const q = db.select( [ DB_ACCOUNTS_TABLE, 'A' ], { result: true } )
            .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                'C.id = A.currency_id' )
            .get( [ 'A.*', 'C.code', 'C.dec_places' ] )
            .where( 'A.uuidb64', id );
        q.executeAssoc( as );

        const helpers = q.helpers();

        as.add( ( as, rows ) => {
            if ( rows.length !== 1 ) {
                as.error( 'UnknownAccountID' );
            }

            reqinfo.result( this._accountInfo( rows[0], helpers ) );
        } );
    }

    listAccounts( as, reqinfo ) {
        as.add(
            ( as ) => {
                const holder = reqinfo.params().holder;
                const db = reqinfo.executor().ccm().db( 'xfer' );

                const xfer = db.newXfer();
                const helpers = xfer.helpers();
                xfer.select( DB_ACCOUNT_HOLDERS_TABLE,
                    { selected: 1 } )
                    .get( 'uuidb64' )
                    .where( 'uuidb64', holder );
                xfer.select( [ DB_ACCOUNTS_TABLE, 'A' ], { result: true } )
                    .leftJoin( [ DB_CURRENCY_TABLE, 'C' ],
                        'C.id = A.currency_id' )
                    .get( [ 'A.*', 'C.code', 'C.dec_places' ] )
                    .where( 'holder', holder );
                xfer.executeAssoc( as );

                as.add( ( as, results ) => {
                    const res = results[0].rows.map(
                        v => this._accountInfo( v, helpers ) );
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
}

module.exports = AccountsService;
