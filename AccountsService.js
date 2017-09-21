'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );

const AccountsFace = require( './AccountsFace' );
const UUIDTool = require( './UUIDTool' );
const {
    DB_IFACEVER,
    DB_ACCOUNT_HOLDERS_TABLE,
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
                const ccm = reqinfo.executor().ccm();
                const db = ccm.db( 'xfer' );

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
                const ccm = reqinfo.executor().ccm();
                const db = ccm.db( 'xfer' );

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
        const ccm = reqinfo.executor().ccm();
        const db = ccm.db( 'xfer' );

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

    addAccount( as, _reqinfo ) {
        as.error( 'NotImplemented' );
    }

    updateAccount( as, _reqinfo ) {
        as.error( 'NotImplemented' );
    }

    listAccounts( as, _reqinfo ) {
        as.error( 'NotImplemented' );
    }

    convAccount( as, _reqinfo ) {
        as.error( 'NotImplemented' );
    }
}

module.exports = AccountsService;
