'use strict';

const PingService = require( 'futoin-executor/PingService' );
const PingFace = require( 'futoin-invoker/PingFace' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

const LimitsFace = require( './LimitsFace' );
const {
    DB_IFACEVER,
    DB_LIMIT_GROUPS_TABLE,
    DB_DOMAIN_LIMITS_TABLE,
    DB_CURRENCY_TABLE,
} = require( './main' );

/**
 * Limits Service
 */
class LimitsService extends PingService {
    /**
     * Register futoin.currency.manage interface with Executor
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {ManageService} instance
     */
    static register( as, executor, options={} ) {
        const ifacename = 'futoin.xfer.limits';
        const ifacever = ifacename + ':' + LimitsFace.LATEST_VERSION;
        const impl = new this( options );
        const spec_dirs = [ LimitsFace.spec(), PingFace.spec( LimitsFace.PING_VERSION ) ];

        executor.register( as, ifacever, impl, spec_dirs );
        executor.ccm().assertIface( '#db.xfer', DB_IFACEVER );

        as.add( ( as ) => {
            const mjr = LimitsFace.LATEST_VERSION.split( '.' )[0];
            impl._iface_info = executor._ifaces[ifacename][mjr];
        } );

        return impl;
    }

    addLimitGroup( as, reqinfo ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        as.add(
            ( as ) => {
                db.insert( DB_LIMIT_GROUPS_TABLE )
                    .set( 'group_name', reqinfo.params().group )
                    .execute( as );
                as.add( ( as ) => reqinfo.result( true ) );
            },
            ( as, res ) => {
                if ( res === 'Duplicate' ) {
                    as.error( 'AlreadyExists' );
                }
            }
        );
    }

    getLimitGroups( as, reqinfo ) {
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db.select( DB_LIMIT_GROUPS_TABLE )
            .get( 'group_name' )
            .order( 'id' )
            .execute( as );
        as.add( ( as, { rows } ) => reqinfo.result( rows.map( v => v[0] ) ) );
    }

    getLimits( as, reqinfo ) {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db.select( DB_LIMIT_GROUPS_TABLE )
            .innerJoin( DB_DOMAIN_LIMITS_TABLE,
                `lim_id = ${DB_LIMIT_GROUPS_TABLE}.id` )
            .innerJoin( DB_CURRENCY_TABLE,
                `currency_id = ${DB_CURRENCY_TABLE}.id` )
            .get( [ 'code', 'lim_hard', 'lim_check', 'lim_risk' ] )
            .where( {
                group_name: p.group,
                lim_domain: p.domain,
            } )
            .executeAssoc( as );

        as.add( ( as, rows ) => {
            if ( rows.length !== 1 ) {
                as.error( 'LimitsNotSet' );
            }

            const v = rows[0];
            reqinfo.result( {
                currency: v.code,
                hard: JSON.parse( v.lim_hard ),
                check: v.lim_check ? JSON.parse( v.lim_check ) : false,
                risk: v.lim_risk ? JSON.parse( v.lim_risk ) : false,
            } );
        } );
    }

    setLimits( as, reqinfo ) {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );

        let lim_id;
        let currency_id;

        //---
        db.select( DB_LIMIT_GROUPS_TABLE )
            .get( 'id' )
            .where( 'group_name', p.group )
            .execute( as );

        as.add( ( as, { rows } ) => {
            if ( rows.length !== 1 ) {
                as.error( 'UnknownGroup' );
            }

            lim_id = rows[0][0];
        } );
        //---
        db.select( DB_CURRENCY_TABLE )
            .get( 'id' )
            .where( 'code', p.currency )
            .execute( as );

        as.add( ( as, { rows } ) => {
            if ( rows.length !== 1 ) {
                as.error( 'UnknownCurrency' );
            }

            currency_id = rows[0][0];
        } );
        //---

        const iface_info = this._iface_info;
        const lim_hard = p.hard;
        const lim_check = p.check;
        const lim_risk = p.risk;
        const lim_domain = p.domain;

        if ( !SpecTools.checkType( iface_info, `${lim_domain}LimitValues`, lim_hard ) ) {
            as.error( 'InvalidRequest', `Hard limits do not match ${lim_domain}LimitValues` );
        }

        if ( lim_check && !SpecTools.checkType( iface_info, `${lim_domain}LimitValues`, lim_check ) ) {
            as.error( 'InvalidRequest', `Check limits do not match ${lim_domain}LimitValues` );
        }

        if ( lim_risk && !SpecTools.checkType( iface_info, `${lim_domain}LimitValues`, lim_risk ) ) {
            as.error( 'InvalidRequest', `Risk limits do not match ${lim_domain}LimitValues` );
        }

        //---
        const toset = {
            currency_id: null,
            lim_hard: JSON.stringify( lim_hard ),
            lim_check: lim_check ? JSON.stringify( lim_check ) : null,
            lim_risk: lim_risk ? JSON.stringify( lim_risk ) : null,
        };

        reqinfo.result( true );

        as.repeat( 2, ( as, retry ) => as.add(
            ( as ) => {
                const cond = {
                    lim_id,
                    lim_domain,
                };

                toset.currency_id = currency_id;

                if ( retry ) {
                    const xfer = db.newXfer();
                    xfer.update( DB_DOMAIN_LIMITS_TABLE, { affected: 1 } )
                        .set( toset )
                        .where( cond );
                    xfer.execute( as );
                } else {
                    db.insert( DB_DOMAIN_LIMITS_TABLE )
                        .set( toset )
                        .set( cond )
                        .execute( as );
                }

                as.add( ( as ) => as.break() );
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    as.success();
                }
            }
        ) );
    }
}

module.exports = LimitsService;
