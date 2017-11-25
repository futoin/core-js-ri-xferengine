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

const BaseService = require( './BaseService' );

const LimitsFace = require( './LimitsFace' );
const {
    DB_LIMIT_GROUPS_TABLE,
    DB_DOMAIN_LIMITS_TABLE,
    DB_CURRENCY_TABLE,
    EVTGEN_ALIAS,
} = require( './main' );

const SYM_GETLIMGRP = Symbol( 'getLimitGroups' );
const SYM_GETLIMITS = Symbol( 'getLimits' );

/**
 * Limits Service
 */
class LimitsService extends BaseService {
    static get IFACE_IMPL() {
        return LimitsFace;
    }

    addLimitGroup( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const db = ccm.db( 'xfer' );
        const evtgen = ccm.iface( EVTGEN_ALIAS );

        as.add(
            ( as ) => {
                const xfer = db.newXfer();
                const p = reqinfo.params();

                db.insert( DB_LIMIT_GROUPS_TABLE )
                    .set( 'group_name', p.group )
                    .execute( as );

                evtgen.addXferEvent( xfer, 'LIM_ADD', p );

                xfer.execute( as );

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

        db
            .getPrepared( SYM_GETLIMGRP, ( db ) =>
                db.select( DB_LIMIT_GROUPS_TABLE )
                    .get( 'group_name' )
                    .order( 'id' )
                    .prepare()
            )
            .execute( as );
        as.add( ( as, { rows } ) => reqinfo.result( rows.map( v => v[0] ) ) );
    }

    getLimits( as, reqinfo ) {
        const p = reqinfo.params();
        const db = reqinfo.executor().ccm().db( 'xfer' );

        db
            .getPrepared( SYM_GETLIMITS, ( db ) => {
                const qb = db.select( DB_LIMIT_GROUPS_TABLE )
                    .innerJoin( DB_DOMAIN_LIMITS_TABLE,
                        `lim_id = ${DB_LIMIT_GROUPS_TABLE}.id` )
                    .innerJoin( DB_CURRENCY_TABLE,
                        `currency_id = ${DB_CURRENCY_TABLE}.id` )
                    .get( [ 'code', 'lim_hard', 'lim_check', 'lim_risk' ] );

                qb.where( {
                    group_name: qb.param( 'group' ),
                    lim_domain: qb.param( 'domain' ),
                } );

                return qb.prepare();
            } )
            .executeAssoc( as, p );

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
        const ccm = reqinfo.executor().ccm();
        const db = ccm.db( 'xfer' );
        const evtgen = ccm.iface( EVTGEN_ALIAS );

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

        const lim_hard = p.hard;
        const lim_check = p.check;
        const lim_risk = p.risk;
        const lim_domain = p.domain;

        if ( !this._checkType( `${lim_domain}LimitValues`, lim_hard ) ) {
            as.error( 'InvalidRequest', `Hard limits do not match ${lim_domain}LimitValues` );
        }

        if ( lim_check && !this._checkType( `${lim_domain}LimitValues`, lim_check ) ) {
            as.error( 'InvalidRequest', `Check limits do not match ${lim_domain}LimitValues` );
        }

        if ( lim_risk && !this._checkType( `${lim_domain}LimitValues`, lim_risk ) ) {
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

                const xfer = db.newXfer();

                if ( retry ) {
                    xfer.update( DB_DOMAIN_LIMITS_TABLE, { affected: 1 } )
                        .set( toset )
                        .where( cond );
                } else {
                    xfer.insert( DB_DOMAIN_LIMITS_TABLE )
                        .set( toset )
                        .set( cond );
                }

                evtgen.addXferEvent( xfer, 'LIM_SET', p );

                xfer.execute( as );

                as.add( ( as ) => as.break() );
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    as.success();
                }
            }
        ) );
    }

    /**
     * Register futoin.xfers.limits interface with Executor
     *
     * @function LimitsService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {LimitsService} instance
     */
}

module.exports = LimitsService;
