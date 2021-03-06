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

const assert = require( 'assert' );
const moment = require( 'moment' );
const { SpecTools } = require( 'futoin-invoker' );
const { Mutex } = require( 'futoin-asyncsteps' );

const AmountTools = require( './AmountTools' );
const UUIDTool = require( './UUIDTool' );

const {
    DB_ACCOUNTS_TABLE,
    DB_ACCOUNTS_VIEW,
    DB_XFERS_TABLE,
    DB_RESERVATIONS_TABLE,
    EVTGEN_ALIAS,
    limitStatsTable,
    historyTimeBarrier,
} = require( './main' );

const g_xfer_types = {
    iface : 'xfertools.types',
    version : '1.0',
};

const TypeSpec = Object.assign( {
    ftn3rev: '1.9',
    types: {
        AccountID: 'string',
        Fee: {
            type: 'map',
            fields: {
                dst_account : 'AccountID',
                currency: 'string',
                amount: 'string',
                misc_data: {
                    type: 'map',
                    optional: true,
                },
            },
        },
        PrefixOrFalse: [ 'string', 'boolean' ],
        XferInfo : {
            type: 'map',
            fields: {
                id : {
                    type: 'string',
                    optional: true,
                },

                src_account: 'AccountID',
                src_limit_domain: {
                    type: 'string',
                    optional: true,
                },
                src_limit_prefix: "PrefixOrFalse",
                src_limit_extra: {
                    type: 'map',
                    optional: true,
                },

                dst_account: 'AccountID',
                dst_limit_domain: {
                    type: 'string',
                    optional: true,
                },
                dst_limit_prefix: "PrefixOrFalse",
                dst_limit_extra: {
                    type: 'map',
                    optional: true,
                },

                currency: 'string',
                amount: 'string',
                preauth: {
                    type: 'boolean',
                    optional: true,
                },
                user_confirm: {
                    type: 'boolean',
                    optional: true,
                },
                reject_mode: {
                    type: 'boolean',
                    optional: true,
                },
                noop: {
                    type: 'boolean',
                    optional: true,
                },
                type: 'string',

                ext_id : {
                    type: 'string',
                    optional: true,
                },
                misc_data: {
                    type: 'map',
                    optional: true,
                },
                orig_ts: {
                    type: 'string',
                    optional: true,
                },
                extra_fee: {
                    type: 'Fee',
                    optional: true,
                },
                xfer_fee: {
                    type: 'Fee',
                    optional: true,
                },
                use_preauth: {
                    type: "string",
                    optional: true,
                },
            },
        },
    },
}, g_xfer_types );
const g_load_mutex = new Mutex();

const BY_EXT_ID = Symbol( 'by-ext-id' );
const BY_FEE_ID = Symbol( 'by-fee-id' );
const BY_XFER_ID = Symbol( 'by-xfer-id' );
const ACC_INFO = Symbol( 'get-account-info' );

/**
 * Actual transaction core
 * @private
 */
class XferTools {
    get ST_WAIT_USER() {
        return 'WaitUser';
    }
    get ST_WAIT_EXT_IN() {
        return 'WaitExtIn';
    }
    get ST_WAIT_EXT_OUT() {
        return 'WaitExtOut';
    }
    get ST_DONE() {
        return 'Done';
    }
    get ST_CANCELED() {
        return 'Canceled';
    }
    get ST_REJECTED() {
        return 'Rejected';
    }

    get ACCT_SYSTEM() {
        return 'System';
    }
    get ACCT_REGULAR() {
        return 'Regular';
    }
    get ACCT_EXTERNAL() {
        return 'External';
    }
    get ACCT_TRANSIT() {
        return 'Transit';
    }
    get ACCT_BONUS() {
        return 'Bonus';
    }

    constructor( ccm, domain ) {
        this._ccm = ccm;
        this._domain = domain;
    }

    get db() {
        return this._ccm.db( 'xfer' );
    }

    // Processing of Limits & Stats
    //-----------------------

    _processLimits( as, dbxfer, domain, holder, delta_currency, deltas ) {
        const ccm = this._ccm;
        const limface = ccm.iface( 'xfer.limits' );
        const acctface = ccm.iface( 'xfer.accounts' );
        const currface = ccm.iface( 'currency.info' );

        let currency;
        let currency_info;
        let stats;
        let lim_hard;
        let lim_check;
        let lim_risk;

        // Limits statistics
        acctface.getLimitStats( as, holder, domain );
        as.add( ( as, res ) => {
            currency = res.currency;
            stats = res.stats;

            currface.getCurrency( as, currency );
            as.add( ( as, res ) => {
                currency_info = res;

                if ( delta_currency && ( currency !== delta_currency ) ) {
                    // expect stats limits in "base currency"
                    currface.getExRate( as, currency, delta_currency );

                    as.add( ( as, { rate } ) => {
                        rate = AmountTools.backRate( rate );
                        // round up amounts
                        deltas = AmountTools.convAllAmounts(
                            deltas, rate, currency_info.dec_places, true );
                    } );
                }
            } );
        } );

        // Global limits
        acctface.getAccountHolder( as, holder );
        as.add( ( as, res ) => {
            limface.getLimits( as, res.group, domain );
        } );
        as.add( ( as, limits ) => {
            lim_hard = limits.hard;
            lim_check = limits.check;
            lim_risk = limits.risk;
            const lim_currency = limits.currency;

            if ( currency !== lim_currency ) {
                // expect global limits in "main base currency"
                currface.getExRate( as, lim_currency, currency );

                as.add( ( as, { rate } ) => {
                    rate = AmountTools.backRate( rate );
                    // round down limits
                    lim_hard = AmountTools.convAllAmounts(
                        lim_hard, rate, currency_info.dec_places, false );
                    lim_check = AmountTools.convAllAmounts(
                        lim_check, rate, currency_info.dec_places, false );
                    lim_risk = AmountTools.convAllAmounts(
                        lim_risk, rate, currency_info.dec_places, false );
                } );
            }
        } );

        //
        as.add( ( as ) => {
            const new_stats = AmountTools.prepNewStats( stats, deltas );

            if ( !AmountTools.checkStatsLimit( new_stats, lim_hard ) ) {
                if ( 'limithit_daily_cnt' in deltas ) {
                    // inner loop
                    as.error( 'LimitReject' );
                }

                as.add(
                    ( as ) => {
                        if ( 'failure_daily_cnt' in deltas ) {
                            // no need to update limit-hit on failure limit
                            as.error( 'LimitReject' );
                        }

                        const dbxfer2 = this.db.newXfer();

                        this._processLimits(
                            as, dbxfer2, 'Misc', holder, null,
                            {
                                limithit_daily_cnt: 1,
                                limithit_weekly_cnt: 1,
                                limithit_monthly_cnt: 1,
                            }
                        );

                        as.add( ( as ) => dbxfer2.execute( as ) );
                    },
                    ( as, err ) => {
                        if ( err === 'LimitReject' ) {
                            acctface.call( as, 'updateAccountHolder', {
                                id: holder,
                                enabled: false,
                            } );
                        }
                    }
                );
                as.add( ( as ) => as.error( 'LimitReject' ) );
                return;
            }

            const do_check = lim_check && !AmountTools.checkStatsLimit( new_stats, lim_check );
            const do_risk = lim_risk && !AmountTools.checkStatsLimit( new_stats, lim_risk );

            const dec_places = currency_info.dec_places;

            const lq = dbxfer.update( limitStatsTable( domain ), { affected: 1 } );
            lq.where( { holder } );

            for ( let k in deltas ) {
                let dv = deltas[k];

                if ( k in stats ) {
                    let lv = lim_hard[k];

                    if ( AmountTools.isAmountField( k ) ) {
                        dv = AmountTools.toStorage( dv, dec_places );
                        lv = AmountTools.toStorage( lv, dec_places );
                    }

                    // Next value based on ACTUAL transactional data !
                    const val = `${k} + ${lq.escape( dv )}`;
                    lq.set( k, lq.expr( val ) );

                    // Double check in database based on ACTUAL data
                    lq.where( `(${val}) <= ${lq.escape( lv )}` );
                }
            }

            as.success( { do_check, do_risk } );
        } );
    }

    addLimitProcessing( as, dbxfer, domain, holder, currency, amount, prefix, extra={} ) {
        let deltas = prefix ? {
            [`${prefix}_min_amt`] : amount,
            [`${prefix}_daily_amt`] : amount,
            [`${prefix}_daily_cnt`] : 1,
            [`${prefix}_weekly_amt`] : amount,
            [`${prefix}_weekly_cnt`] : 1,
            [`${prefix}_monthly_amt`] : amount,
            [`${prefix}_monthly_cnt`] : 1,
        } : {};
        Object.assign( deltas, extra );

        this._processLimits( as, dbxfer, domain, holder, currency, deltas );
    }

    // Reverting transaction stats
    //-----------------------
    _cancelStats( as, dbxfer, domain, holder, date, delta_currency, deltas ) {
        const ccm = this._ccm;
        const acctface = ccm.iface( 'xfer.accounts' );
        const currface = ccm.iface( 'currency.info' );

        let currency;
        let currency_info;

        // Limits statistics
        acctface.getLimitStats( as, holder, domain );
        as.add( ( as, res ) => {
            currency = res.currency;

            currface.getCurrency( as, currency );
            as.add( ( as, res ) => {
                currency_info = res;

                if ( currency !== delta_currency ) {
                    // expect stats limits in "base currency"
                    currface.getExRate( as, currency, delta_currency );

                    as.add( ( as, { rate } ) => {
                        rate = AmountTools.backRate( rate );
                        // round up amounts
                        deltas = AmountTools.convAllAmounts(
                            deltas, rate, currency_info.dec_places, true );
                    } );
                }
            } );
        } );

        //
        as.add( ( as ) => {
            const dec_places = currency_info.dec_places;

            date = moment.utc( date );
            const now = moment.utc();
            const do_daily = date.format( 'YYYY-MM-DD' ) === now.format( 'YYYY-MM-DD' );
            const do_weekly = now.startOf( 'week' ).isSameOrBefore( date );
            const do_monthly = now.startOf( 'month' ).isSameOrBefore( date );

            if ( !do_daily && !do_weekly && !do_monthly ) {
                return;
            }

            const lq = dbxfer.update( limitStatsTable( domain ) );
            lq.where( { holder } );

            const q_zero = lq.escape( 0 );

            for ( let k in deltas ) {
                let dv = deltas[k];

                if ( !do_daily && ( k.indexOf( '_daily_' ) > 0 ) ) {
                    continue;
                }

                if ( !do_weekly && ( k.indexOf( '_weekly_' ) > 0 ) ) {
                    continue;
                }

                if ( !do_monthly && ( k.indexOf( '_monthly_' ) > 0 ) ) {
                    continue;
                }

                if ( AmountTools.isAmountField( k ) ) {
                    dv = AmountTools.toStorage( dv, dec_places );
                }

                // Next value based on ACTUAL transactional data !
                const val = `${k} - ${lq.escape( dv )}`;
                lq.set( k, lq.expr( val ) );

                // Double check in database based on ACTUAL data
                lq.where( `(${val}) >= ${q_zero}` );
            }
        } );
    }

    addStatsCancel( as, dbxfer, domain, holder, date, currency, amount, prefix, extra={} ) {
        // cancel must be accounted as transaction for security reasons
        // cnt - (-1) = cnt + 1
        let deltas = prefix ? {
            [`${prefix}_daily_amt`] : amount,
            [`${prefix}_daily_cnt`] : -1,
            [`${prefix}_weekly_amt`] : amount,
            [`${prefix}_weekly_cnt`] : -1,
            [`${prefix}_monthly_amt`] : amount,
            [`${prefix}_monthly_cnt`] : -1,
        } : {};
        Object.assign( deltas, extra );

        this._cancelStats( as, dbxfer, domain, holder, date, currency, deltas );
    }

    // Ttransaction processing
    //-----------------------
    makeExtId( rel_account, rel_ext_id ) {
        return `${rel_ext_id}:${rel_account}`;
    }

    _checkExisting( as, xfer ) {
        const ext_id = xfer.ext_id;

        if ( ext_id ) {
            //---
            if ( !ext_id.endsWith( xfer.src_account ) &&
                !ext_id.endsWith( xfer.dst_account )
            ) {
                as.error( 'XferError', 'Invalid external ID format' );
            }

            //---
            const barrier = historyTimeBarrier();

            if ( !xfer.orig_ts || barrier.isAfter( xfer.orig_ts ) ) {
                as.error( 'OriginalTooOld' );
            }

            //---
            this.db
                .getPrepared( BY_EXT_ID, ( db ) => {
                    const q = db.select( DB_XFERS_TABLE );
                    q.where( 'ext_id', q.param( 'ext_id' ) );
                    return q.prepare();
                } )
                .executeAssoc( as, { ext_id } );
        } else if ( xfer.id ) {
            this.db
                .getPrepared( BY_XFER_ID, ( db ) => {
                    const q = db.select( DB_XFERS_TABLE );
                    q.where( 'uuidb64', q.param( 'id' ) );
                    return q.prepare();
                } )
                .executeAssoc( as, { id: xfer.id } );
        } else {
            return;
        }

        as.add( ( as, rows ) => {
            if ( rows.length <= 0 ) {
                if ( xfer.user_confirm || xfer.reject_mode ) {
                    as.error( 'UnknownXferID' );
                }

                return;
            }

            const r = rows[0];
            r.src_amount = AmountTools.fromStorage(
                r.src_amount, xfer.src_info.dec_places );
            r.dst_amount = AmountTools.fromStorage(
                r.dst_amount, xfer.dst_info.dec_places );
            xfer.orig_misc_data = r.misc_data;
            r.misc_data = JSON.parse( r.misc_data );

            if ( ( xfer.src_account !== r.src ) ||
                    ( xfer.src_info.currency_id !== r.src_currency_id ) ||
                    ( xfer.dst_account !== r.dst ) ||
                    ( xfer.dst_info.currency_id !== r.dst_currency_id ) ||
                    ( xfer.type !== r.xfer_type )
            ) {
                as.error( "OriginalMismatch", 'Account/Currency/Type' );
            }

            if ( ( xfer.src_info.currency !== xfer.currency ) &&
                    ( xfer.dst_info.currency !== xfer.currency )
            ) {
                if ( xfer.currency !== r.misc_data.currency ) {
                    as.error( "OriginalMismatch", 'Currency' );
                }

                if ( !AmountTools.isEqual( xfer.amount, r.misc_data.amount ) ) {
                    as.error( "OriginalMismatch", 'Currency' );
                }

                // Make sure to use original exrate
                xfer.src_amount = r.src_amount;
                xfer.dst_amount = r.dst_amount;
            } else if ( xfer.src_info.currency === xfer.currency ) {
                if ( !AmountTools.isEqual( xfer.amount, r.src_amount ) ) {
                    as.error( "OriginalMismatch", 'Currency' );
                }

                // Make sure to use original exrate
                xfer.dst_amount = r.dst_amount;
            } else { // if ( xfer.dst_info.currency === xfer.currency )
                if ( !AmountTools.isEqual( xfer.amount, r.dst_amount ) ) {
                    as.error( "OriginalMismatch", 'Currency' );
                }

                // Make sure to use original exrate
                xfer.src_amount = r.src_amount;
            }

            xfer.id = r.uuidb64;
            xfer.ext_id = r.ext_id;
            xfer.status = r.xfer_status;
            xfer.created = moment.utc( r.created ).format();
            xfer.updated = moment.utc( r.updated ).format();
            Object.assign( xfer.misc_data, r.misc_data );
            xfer.repeat = true;

            if ( xfer.misc_data.rel_in_id ) {
                xfer.in_xfer.id = xfer.misc_data.rel_in_id;
                this._readTransitXfer( as, xfer.in_xfer );
            }

            if ( xfer.misc_data.rel_out_id ) {
                xfer.out_xfer.id = xfer.misc_data.rel_out_id;
                this._readTransitXfer( as, xfer.out_xfer );
            }

            if ( r.extra_fee_id ) {
                if ( !xfer.extra_fee ) {
                    as.error( "OriginalMismatch", 'ExtraFee' );
                }

                xfer.extra_fee.id = r.extra_fee_id;
                xfer.extra_fee.src_account = xfer.src_account;
                xfer.extra_fee.force = xfer.force;
                xfer.extra_fee.in_cancel = xfer.in_cancel;
                this._readFeeXfer( as, xfer.extra_fee );
            }

            if ( r.xfer_fee_id ) {
                if ( !xfer.xfer_fee ) {
                    as.error( "OriginalMismatch", 'Fee' );
                }

                xfer.xfer_fee.id = r.xfer_fee_id;
                xfer.xfer_fee.src_account = xfer.dst_account;
                xfer.xfer_fee.force = xfer.force;
                xfer.xfer_fee.in_cancel = xfer.in_cancel;
                this._readFeeXfer( as, xfer.xfer_fee );
            }
        } );
    }

    _readTransitXfer( as, xfer ) {
        this._getAccountsInfo( as, xfer );
        this._convXferAmounts( as, xfer );

        this.db
            .getPrepared( BY_FEE_ID, ( db ) => {
                const q = db.select( DB_XFERS_TABLE );
                q.where( 'uuidb64', q.param( 'uuidb64' ) );
                return q.prepare();
            } )
            .executeAssoc( as, { uuidb64: xfer.id } );

        as.add( ( as, rows ) => {
            if ( !rows.length ) {
                as.error( 'XferError', 'Missing transit xfer' );
            }

            const r = rows[0];

            if ( ( xfer.src_account !== r.src ) ||
                ( xfer.src_info.currency_id !== r.src_currency_id ) ||
                ( xfer.dst_account !== r.dst ) ||
                ( xfer.dst_info.currency_id !== r.dst_currency_id ) ||
                ( xfer.type !== r.xfer_type )
            ) {
                as.error( "OriginalMismatch" );
            }

            xfer.status = r.xfer_status;
            xfer.created = moment.utc( r.created ).format();
            xfer.updated = moment.utc( r.updated ).format();
            xfer.orig_misc_data = r.misc_data;
            Object.assign( xfer.misc_data, JSON.parse( r.misc_data ) );

            // fee amounts may change on repeat calls - use original
            xfer.src_amount = AmountTools.fromStorage(
                r.src_amount, xfer.src_info.dec_places );
            xfer.dst_amount = AmountTools.fromStorage(
                r.dst_amount, xfer.dst_info.dec_places );

            xfer.repeat = true;
        } );
    }

    _readFeeXfer( as, fee_xfer ) {
        fee_xfer.type = 'Fee';
        fee_xfer.misc_data = fee_xfer.misc_data || {};

        this._getAccountsInfo( as, fee_xfer );
        this._convXferAmounts( as, fee_xfer );
        this._prepareTransit( as, fee_xfer );

        this.db
            .getPrepared( BY_FEE_ID, ( db ) => {
                const q = db.select( DB_XFERS_TABLE );
                q.where( 'uuidb64', q.param( 'uuidb64' ) );
                return q.prepare();
            } )
            .executeAssoc( as, { uuidb64: fee_xfer.id } );

        as.add( ( as, rows ) => {
            if ( !rows.length ) {
                as.error( 'XferError', 'Missing fee xfer' );
            }

            const r = rows[0];

            if ( ( fee_xfer.src_account !== r.src ) ||
                ( fee_xfer.src_info.currency_id !== r.src_currency_id ) ||
                ( fee_xfer.dst_account !== r.dst ) ||
                ( fee_xfer.dst_info.currency_id !== r.dst_currency_id ) ||
                ( fee_xfer.type !== r.xfer_type )
            ) {
                as.error( "OriginalMismatch" );
            }

            fee_xfer.status = r.xfer_status;
            fee_xfer.created = moment.utc( r.created ).format();
            fee_xfer.updated = moment.utc( r.updated ).format();
            fee_xfer.orig_misc_data = r.misc_data;
            Object.assign( fee_xfer.misc_data, JSON.parse( r.misc_data ) );

            // fee amounts may change on repeat calls - use original
            fee_xfer.src_amount = AmountTools.fromStorage(
                r.src_amount, fee_xfer.src_info.dec_places );
            fee_xfer.dst_amount = AmountTools.fromStorage(
                r.dst_amount, fee_xfer.dst_info.dec_places );

            fee_xfer.repeat = true;

            if ( fee_xfer.misc_data.rel_in_id ) {
                fee_xfer.in_xfer.id = fee_xfer.misc_data.rel_in_id;
                this._readTransitXfer( as, fee_xfer.in_xfer );
            }
        } );
    }

    _getAccountsInfo( as, xfer ) {
        this.db
            .getPrepared( ACC_INFO, ( db ) => {
                const q = db.select( DB_ACCOUNTS_VIEW );
                q.where( 'uuidb64 IN', [
                    q.param( 'src' ),
                    q.param( 'dst' ),
                ] );
                return q.prepare();
            } )
            .executeAssoc( as, {
                src: xfer.src_account,
                dst: xfer.dst_account,
            } );

        as.add( ( as, rows ) => {
            if ( ( xfer.src_account === xfer.dst_account ) && rows.length ) {
                // artificial case
                rows.push( Object.assign( {}, rows[0] ) );
            }

            if ( rows.length !== 2 ) {
                as.error( 'UnknownAccountID' );
            }

            for ( let i = 0; i < 2; ++i ) {
                AmountTools.accountFromStorage( rows[i] );
            }

            if ( rows[0].uuidb64 === xfer.src_account ) {
                xfer.src_info = rows[0];
                xfer.dst_info = rows[1];
            } else {
                xfer.src_info = rows[1];
                xfer.dst_info = rows[0];
            }

            if ( xfer.force || xfer.in_cancel ) {
                // ignore
            } else if (
                ( xfer.src_info.account_enabled !== 'Y' ) ||
                ( xfer.src_info.holder_enabled !== 'Y' )
            ) {
                as.error( 'DisabledAccount' );
            }
        } );
    }

    _convXferAmounts( as, xfer ) {
        as.add( ( as ) => {
            // common
            if ( ( xfer.src_info.currency !== xfer.currency ) ||
                 ( xfer.dst_info.currency !== xfer.currency )
            ) {
                xfer.misc_data.amount = xfer.amount;
                xfer.misc_data.currency = xfer.currency;
            }

            const currinfo = this._ccm.iface( 'currency.info' );

            // src -> buy rate & round up
            if ( xfer.src_info.currency === xfer.currency ) {
                xfer.src_amount = xfer.amount;
            } else {
                currinfo.getExRate( as, xfer.currency, xfer.src_info.currency );
                as.add( ( as, { rate, margin } ) => {
                    rate = AmountTools.buyRate( rate, margin );
                    xfer.src_amount = AmountTools.convAmount(
                        xfer.amount, rate, xfer.src_info.dec_places, true
                    );
                } );
            }

            // dst -> sell rate & round down
            if ( xfer.dst_info.currency === xfer.currency ) {
                xfer.dst_amount = xfer.amount;
            } else {
                currinfo.getExRate( as, xfer.currency, xfer.dst_info.currency );
                as.add( ( as, { rate, margin } ) => {
                    rate = AmountTools.sellRate( rate, margin );
                    xfer.dst_amount = AmountTools.convAmount(
                        xfer.amount, rate, xfer.dst_info.dec_places, false
                    );
                } );
            }
        } );
    }

    _prepareTransit( as, xfer ) {
        as.add( ( as ) => {
            if ( xfer.in_transit ) {
                return;
            }

            if ( xfer.src_info.acct_type === this.ACCT_TRANSIT ) {
                xfer.in_xfer = {
                    id: xfer.misc_data.rel_in_id,
                    src_account: xfer.src_info.rel_uuidb64,
                    src_limit_domain: 'Payments',
                    src_limit_prefix: 'outbound',
                    dst_account: xfer.src_account,
                    currency: xfer.src_info.currency,
                    amount: xfer.src_amount,
                    type: xfer.type,
                    misc_data: Object.assign( {}, xfer.misc_data, {
                        xfer_id: xfer.id,
                    } ),
                    in_transit: true,
                    force: xfer.force,
                    in_cancel: xfer.in_cancel,
                };
            }

            if ( ( xfer.dst_info.acct_type === this.ACCT_TRANSIT ) &&
                 !xfer.preauth
            ) {
                xfer.out_xfer = {
                    id: xfer.misc_data.rel_out_id,
                    src_account: xfer.dst_account,
                    dst_account: xfer.dst_info.rel_uuidb64,
                    src_limit_domain: 'Payments',
                    src_limit_prefix: 'inbound',
                    currency: xfer.dst_info.currency,
                    amount: xfer.dst_amount,
                    type: xfer.type,
                    misc_data: Object.assign( {}, xfer.misc_data, {
                        xfer_id: xfer.id,
                    } ),
                    in_transit: true,
                    force: xfer.force,
                    in_cancel: xfer.in_cancel,
                };
            }
        } );
    }

    _checkXferLimits( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            // Check if enough balance, if not Transit account
            if ( xfer.src_info.acct_type !== this.ACCT_TRANSIT &&
                 xfer.src_info.acct_type !== this.ACCT_SYSTEM &&
                 !xfer.force
            ) {
                let req_amt = xfer.src_amount;

                if ( xfer.extra_fee ) {
                    req_amt = AmountTools.add(
                        req_amt,
                        xfer.extra_fee.src_amount,
                        xfer.src_info.dec_places
                    );
                }

                if ( !AmountTools.checkXferAmount( req_amt, xfer.src_info, xfer.preauth_amount ) ) {
                    as.error( 'NotEnoughFunds' );
                }
            }

            const misc_data = xfer.misc_data;

            if ( xfer.src_limit_prefix || xfer.src_limit_extra ) {
                misc_data.src_limit = {
                    domain: xfer.src_limit_domain || this._domain,
                    prefix: xfer.src_limit_prefix,
                    extra: xfer.src_limit_extra || {},
                };
                this.addLimitProcessing(
                    as, dbxfer,
                    misc_data.src_limit.domain,
                    xfer.src_info.holder,
                    xfer.src_info.currency, xfer.src_amount,
                    misc_data.src_limit.prefix,
                    misc_data.src_limit.extra );

                as.add( ( as, { do_check, do_risk } ) => {
                    misc_data.do_check = misc_data.do_check || do_check;
                    misc_data.do_risk = misc_data.do_risk || do_risk;
                } );
            }

            if ( xfer.dst_limit_prefix || xfer.dst_limit_extra ) {
                misc_data.dst_limit = {
                    domain: xfer.dst_limit_domain || this._domain,
                    prefix: xfer.dst_limit_prefix,
                    extra: xfer.dst_limit_extra || {},
                };
                this.addLimitProcessing(
                    as, dbxfer,
                    misc_data.dst_limit.domain,
                    xfer.dst_info.holder,
                    xfer.dst_info.currency, xfer.dst_amount,
                    misc_data.dst_limit.prefix,
                    misc_data.dst_limit.extra );

                as.add( ( as, { do_risk } ) => {
                    // NO user confirmation on destination check limits
                    //misc_data.do_check = misc_data.do_check || do_check;
                    misc_data.do_risk = misc_data.do_risk || do_risk;
                } );
            }
        } );
    }

    _checkCancel( as, xfer ) {
        // Check if enough balance, if not Transit account
        if ( xfer.dst_info.acct_type !== this.ACCT_TRANSIT &&
                xfer.dst_info.acct_type !== this.ACCT_SYSTEM &&
                ( xfer.status !== this.ST_CANCELED ) &&
                ! xfer.force
        ) {
            let cancel_amt = xfer.dst_amount;

            if ( xfer.xfer_fee ) {
                cancel_amt = AmountTools.subtract(
                    cancel_amt,
                    xfer.xfer_fee.src_amount,
                    xfer.dst_info.dec_places
                );
            }

            if ( !AmountTools.checkXferAmount( cancel_amt, xfer.dst_info ) ) {
                as.error( 'NotEnoughFunds' );
            }
        }
    }

    _cancelLimits( as, dbxfer, xfer ) {
        const misc_data = xfer.misc_data;

        if ( misc_data.src_limit && misc_data.src_limit.prefix ) {
            this.addStatsCancel(
                as, dbxfer,
                misc_data.src_limit.domain,
                xfer.src_info.holder,
                xfer.orig_ts,
                xfer.src_info.currency, xfer.src_amount,
                misc_data.src_limit.prefix,
                misc_data.src_limit.extra
            );
        }

        if ( misc_data.dst_limit && misc_data.dst_limit.prefix ) {
            this.addStatsCancel(
                as, dbxfer,
                misc_data.dst_limit.domain,
                xfer.dst_info.holder,
                xfer.orig_ts,
                xfer.dst_info.currency, xfer.dst_amount,
                misc_data.dst_limit.prefix,
                misc_data.dst_limit.extra );
        }
    }

    _analyzeXferRisk( as, xfer ) {
        as.add( ( as ) => {
            if ( !xfer.misc_data.do_risk ) {
                return;
            }

            // TODO: call external risk analysis service
            as.error( 'TODO', 'Risk analysis' );
        } );
    }

    _genRelIDs( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            if ( xfer.in_xfer ) {
                if ( !xfer.in_xfer.id ) {
                    const rel_in_id = UUIDTool.genXfer( dbxfer );
                    xfer.misc_data.rel_in_id = rel_in_id;
                    xfer.in_xfer.id = rel_in_id;
                    xfer.in_xfer.misc_data.xfer_id = xfer.id;
                }
            }

            if ( xfer.out_xfer ) {
                if ( !xfer.out_xfer.id ) {
                    // new case
                    const rel_out_id = UUIDTool.genXfer( dbxfer );
                    xfer.misc_data.rel_out_id = rel_out_id;
                    xfer.out_xfer.id = rel_out_id;
                    xfer.out_xfer.misc_data.xfer_id = xfer.id;
                }
            }
        } );
    }

    _createTransitInbound( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            if ( !xfer.in_xfer ) {
                return;
            }

            xfer.status = this.ST_WAIT_EXT_IN;

            const in_xfer = xfer.in_xfer;
            in_xfer.status = xfer.status;
            this._startXfer( as, dbxfer, in_xfer );
        } );
    }

    _createTransitOutbound( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            if ( !xfer.out_xfer ) {
                return;
            }

            const out_xfer = xfer.out_xfer;
            out_xfer.status = xfer.status;
            this._startXfer( as, dbxfer, out_xfer );
        } );
    }

    _decreaseBalance( dbxfer, xfer, cancel=false ) {
        let acct_info;
        let account;
        let balance_field;
        let q_amt;

        if ( cancel && xfer.preauth ) {
            return;
        }

        const xfer_q = dbxfer.select( DB_XFERS_TABLE, { selected: 1 } )
            .where( 'uuidb64', xfer.id );

        //---
        const acct_q = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );

        if ( cancel ) {
            acct_info = xfer.dst_info;
            account = xfer.dst_account;
            balance_field = 'dst_post_balance';

            xfer_q.get( [ 'dst', 'dst_amount', 'dst_currency_id' ] );
            xfer_q.where( 'dst_post_balance IS NOT NULL' );

            q_amt = acct_q.backref( xfer_q, 'dst_amount' );

            acct_q.where( 'uuidb64', acct_q.backref( xfer_q, 'dst' ) );
            acct_q.where( 'currency_id', acct_q.backref( xfer_q, 'dst_currency_id' ) );
        } else {
            acct_info = xfer.src_info;
            account = xfer.src_account;
            balance_field = 'src_post_balance';

            xfer_q.get( [ 'src', 'src_amount', 'src_currency_id' ] );
            xfer_q.where( 'src_post_balance IS NULL' );

            q_amt = acct_q.backref( xfer_q, 'src_amount' );

            acct_q.where( 'uuidb64', acct_q.backref( xfer_q, 'src' ) );
            acct_q.where( 'currency_id', acct_q.backref( xfer_q, 'src_currency_id' ) );
        }

        const q_zero = dbxfer.escape( '0' );

        acct_q.set( 'updated', dbxfer.helpers().now() );

        if ( xfer.preauth ) {
            acct_q.set( 'reserved', dbxfer.expr( `reserved + ${q_amt}` ) );
        } else {
            acct_q.set( 'balance', dbxfer.expr( `balance - ${q_amt}` ) );
        }

        acct_q.where( 'uuidb64', account ); // double safety
        acct_q.where( 'currency_id', acct_info.currency_id ); // double safety

        if ( ( acct_info.acct_type !== this.ACCT_SYSTEM ) && !xfer.force ) {
            acct_q.where( `(balance + COALESCE(overdraft, ${q_zero}) - reserved - ${q_amt}) >= 0` );
        }

        //---
        if ( xfer.preauth ) {
            assert( xfer.ext_id );

            const reserve_q = dbxfer.insert( DB_RESERVATIONS_TABLE, { affected: 1 } );
            reserve_q.set( {
                ext_id: xfer.ext_id || null,
                account: reserve_q.backref( xfer_q, 'src' ),
                currency_id: reserve_q.backref( xfer_q, 'src_currency_id' ),
                amount: reserve_q.backref( xfer_q, 'src_amount' ),
                created: reserve_q.helpers().now(),
            } );
        }

        this._recordBalance( dbxfer, xfer, account, balance_field, acct_info.dec_places );
    }

    _increaseBalance( dbxfer, xfer, cancel=false ) {
        if ( !cancel && xfer.preauth ) {
            return;
        }

        let acct_info;
        let account;
        let balance_field;

        const xfer_q = dbxfer.select( DB_XFERS_TABLE, { selected: 1 } )
            .where( 'uuidb64', xfer.id );

        const acct_q = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );

        if ( cancel ) {
            acct_info = xfer.src_info;
            account = xfer.src_account;
            balance_field = 'src_post_balance';

            xfer_q.get( [ 'src', 'src_amount', 'src_currency_id' ] );
            xfer_q.where( 'xfer_status', this.ST_CANCELED );
            xfer_q.where( 'src_post_balance IS NOT NULL' );

            if ( xfer.preauth ) {
                acct_q.set( 'reserved', acct_q.expr( `reserved - ${acct_q.backref( xfer_q, 'src_amount' )}` ) );
            } else {
                acct_q.set( 'balance', acct_q.expr( `balance + ${acct_q.backref( xfer_q, 'src_amount' )}` ) );
            }

            acct_q.set( 'updated', dbxfer.helpers().now() );
            acct_q.where( 'uuidb64', acct_q.backref( xfer_q, 'src' ) );
            acct_q.where( 'currency_id', acct_q.backref( xfer_q, 'src_currency_id' ) );

            if ( xfer.preauth ) {
                acct_q.where( 'reserved >=', acct_q.backref( xfer_q, 'src_amount' ) );

                // NOTE: it's only allowed to cancel full pre-auth - we check current amount
                const reserve_q = dbxfer.update( DB_RESERVATIONS_TABLE, { affected: 1 } );
                reserve_q.set( {
                    amount: 0,
                    cleared: reserve_q.helpers().now(),
                } );
                reserve_q.where( {
                    ext_id: xfer.ext_id || null,
                    account: reserve_q.backref( xfer_q, 'src' ),
                    currency_id: reserve_q.backref( xfer_q, 'src_currency_id' ),
                    amount: reserve_q.backref( xfer_q, 'src_amount' ),
                } );
            }
        } else {
            acct_info = xfer.dst_info;
            account = xfer.dst_account;
            balance_field = 'dst_post_balance';

            xfer_q.get( [ 'dst', 'dst_amount', 'dst_currency_id' ] );
            xfer_q.where( 'xfer_status', this.ST_DONE );
            xfer_q.where( 'dst_post_balance IS NULL' );

            acct_q.set( 'balance', acct_q.expr( `balance + ${acct_q.backref( xfer_q, 'dst_amount' )}` ) );
            acct_q.set( 'updated', dbxfer.helpers().now() );
            acct_q.where( 'uuidb64', acct_q.backref( xfer_q, 'dst' ) );
            acct_q.where( 'currency_id', acct_q.backref( xfer_q, 'dst_currency_id' ) );
        }

        // double safety
        acct_q.where( 'uuidb64', account );
        acct_q.where( 'currency_id', acct_info.currency_id );

        this._recordBalance( dbxfer, xfer, account, balance_field, acct_info.dec_places );
    }

    _recordBalance( dbxfer, xfer, account, target_field, dec_places ) {
        const helpers = dbxfer.helpers();

        const acct_q = dbxfer.select( DB_ACCOUNTS_TABLE, { selected: 1 } );
        acct_q.get( [ 'balance', 'reserved' ] ).where( 'uuidb64', account );

        if ( target_field ) {
            const xfer_q = dbxfer.update( DB_XFERS_TABLE, { affected: 1 } );
            xfer_q.set( target_field, xfer_q.backref( acct_q, 'balance' ) );
            xfer_q.where( 'uuidb64', xfer.id );
        }

        const evtgen = this._ccm.iface( EVTGEN_ALIAS );
        const evt_q = dbxfer.insert( evtgen.DB_EVENT_TABLE, { affected: 1 } )
            .set( 'type', 'ACCT_BAL' )
            .set( 'ts', helpers.now() );

        //=========
        let evt_data;

        if ( typeof account === 'string' ) {
            evt_data = [
                `{"id":${JSON.stringify( account )},"balance":"`,
            ];
        } else {
            evt_data = [
                '{"id":"',
                evt_q.backref( account, 'account' ),
                '","balance":"',
            ];
        }

        const format_amt = ( backref ) => helpers.cast(
            helpers.div( backref, AmountTools.place2div( dec_places ) ),
            `DECIMAL(${AmountTools.MAX_DIGITS},${dec_places})`
        );

        evt_data = evt_data.concat( [
            format_amt( evt_q.backref( acct_q, 'balance' ) ),
            '","reserved":"',
            format_amt( evt_q.backref( acct_q, 'reserved' ) ),
            `"}`,
        ] );
        evt_data = helpers.concat( ...evt_data );
        evt_data = helpers.cast( evt_data, 'JSON' );
        //=========

        evt_q.set( 'data', evt_data );
    }

    _usePreAuth( as, dbxfer, xfer ) {
        if ( !xfer.use_preauth ) {
            return;
        }

        const src_info = xfer.src_info;
        const helpers = dbxfer.helpers();

        const db = dbxfer.lface();
        const preauth_ext_id = ( xfer.type == 'Bet' )
            ? xfer.use_preauth
            : db.select( DB_XFERS_TABLE )
                .get( 'ext_id' )
                .where( {
                    uuidb64 : xfer.use_preauth,
                    xfer_status : this.ST_DONE,
                } );
        db.select( DB_RESERVATIONS_TABLE )
            .get( [ 'account', 'amount' ] )
            .where( {
                ext_id: preauth_ext_id,
                currency_id: src_info.currency_id,
            } )
            .executeAssoc( as );

        as.add( ( as, rows ) => {
            if ( xfer.type === 'Bet' ) {
                const used_amounts = {};
                let total_reserved = '0';
                let main;

                for ( let r of rows ) {
                    if ( r.account === src_info.uuidb64 ) {
                        main = r;
                    }

                    if ( AmountTools.isZero( r.amount ) ) {
                        continue;
                    }

                    used_amounts[ r.account ] = AmountTools.fromStorage(
                        r.amount, src_info.dec_places );
                    total_reserved = AmountTools.add( total_reserved, r.amount, 0 );

                    dbxfer.update( DB_RESERVATIONS_TABLE, { affected: 1 } )
                        .set( {
                            amount: 0,
                            cleared: helpers.now(),
                        } )
                        .where( {
                            ext_id: xfer.ext_id,
                            account: r.account,
                            amount: r.amount,
                        } );

                    if ( r.account !== src_info.uuidb64 ) {
                        const amt_q = helpers.escape( r.amount );

                        dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                            .set( 'reserved', helpers.expr( `reserved - ${amt_q}` ) )
                            .set( 'balance', helpers.expr( `balance - ${amt_q}` ) )
                            .where( {
                                uuidb64: r.account,
                                'reserved >=': r.amount,
                                'balance >=': r.amount,
                                // extra safety
                                enabled: 'Y', // only for Bonus here
                                currency_id: src_info.currency_id,
                                holder: src_info.holder,
                            } );

                        this._recordBalance( dbxfer, null, r.account,
                            null, src_info.dec_places );
                    }
                }

                assert( main );

                let bonus_part = AmountTools.subtract( total_reserved, main.amount, 0 );

                dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                    .set( 'reserved', helpers.expr( `reserved - ${helpers.escape( main.amount )}` ) )
                    .set( 'balance', helpers.expr( `balance + ${helpers.escape( bonus_part )}` ) )
                    .where( {
                        uuidb64: main.account,
                        'reserved >=': main.amount,
                        // extra safety
                        currency_id: src_info.currency_id,
                        holder: src_info.holder,
                    } );

                this._recordBalance( dbxfer, null, main.account, null, src_info.dec_places );


                //---
                total_reserved = AmountTools.fromStorage( total_reserved, src_info.dec_places );
                bonus_part = AmountTools.fromStorage( bonus_part, src_info.dec_places );

                if ( !AmountTools.isEqual( total_reserved, xfer.src_amount ) ) {
                    as.error( 'InternalError',
                        `Bet reservation mismatch ${total_reserved} != ${xfer.src_amount}` );
                }

                xfer.misc_data.used_amounts = used_amounts;
                xfer.misc_data.bonus_part = bonus_part;
                xfer.preauth_amount = total_reserved;
            } else if ( rows.length === 1 ) {
                const r = rows[0];

                if ( r.account !== xfer.src_account ) {
                    as.error( 'InternalError', 'Pre-auth account mismatch' );
                }

                dbxfer.update( DB_RESERVATIONS_TABLE, { affected: 1 } )
                    .set( {
                        amount: 0,
                        cleared: helpers.now(),
                    } )
                    .where( {
                        ext_id: preauth_ext_id,
                        account: r.account,
                        amount: r.amount,
                    } );
                dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                    .set( 'reserved', dbxfer.expr( `reserved - ${dbxfer.escape( r.amount )}` ) )
                    .where( {
                        uuidb64: r.account,
                        'reserved >=': r.amount,
                        // extra safety
                        currency_id: src_info.currency_id,
                        holder: src_info.holder,
                    } );
                this._recordBalance( dbxfer, null, r.account, null, src_info.dec_places );

                xfer.misc_data.used_preauth = xfer.use_preauth;
                xfer.preauth_amount = AmountTools.fromStorage( r.amount, src_info.dec_places );

                if ( AmountTools.isLessOrEqual( xfer.src_amount, xfer.preauth_amount ) ) {
                    xfer.user_confirm = true;
                }
            } else {
                as.error( 'UnavailablePreAuth' );
            }
        } );
    }

    _preLockAccounts( dbxfer, xfer ) {
        const accounts = [
            xfer.src_account,
            xfer.dst_account,
        ];

        //---
        const in_xfer = xfer.in_xfer;
        in_xfer && accounts.push( in_xfer.src_account );

        //---
        const out_xfer = xfer.out_xfer;
        out_xfer && accounts.push( out_xfer.dst_account );

        //---
        const fee_xfer = xfer.fee_xfer;
        fee_xfer && accounts.push( fee_xfer.dst_account );

        //---
        const extra_fee = xfer.extra_fee;
        extra_fee && accounts.push( extra_fee.dst_account );

        //---
        dbxfer.select( DB_ACCOUNTS_TABLE )
            .get( 'enabled' )
            .where( 'uuidb64 IN', accounts )
            .forUpdate();
    }

    _createXfer( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            let cancel = ( xfer.status === this.ST_CANCELED );
            let decrease_now = false;
            const misc_data = xfer.misc_data;

            if ( misc_data.do_check && !xfer.user_confirm &&
                 !cancel && !xfer.in_transit &&
                 ( xfer.status === this.ST_DONE )
            ) {
                xfer.status = this.ST_WAIT_USER;
            }

            if ( cancel ) {
                // pass all
            } else if ( xfer.status === this.ST_WAIT_EXT_IN ) {
                /// pass all
            } else if ( ( xfer.in_transit || xfer.in_xfer_fee ) &&
                        ( xfer.status === this.ST_WAIT_USER ||
                          xfer.status === this.ST_WAIT_EXT_OUT )
            ) {
                // pass only on out
            } else {
                decrease_now = true;
            }

            if ( xfer.out_xfer && ( xfer.status === this.ST_DONE ) ) {
                xfer.status = this.ST_WAIT_EXT_OUT;
            }

            //=========================

            xfer.created = xfer.updated = moment.utc().format();
            const q_now = dbxfer.helpers().date( xfer.created );

            // Xfer
            const xfer_q = dbxfer.insert( DB_XFERS_TABLE, { affected: 1 } );

            xfer_q.set( {
                uuidb64 : xfer.id,
                src : xfer.src_account,
                src_currency_id : xfer.src_info.currency_id,
                src_amount : AmountTools.toStorage( xfer.src_amount, xfer.src_info.dec_places ),
                dst : xfer.dst_account,
                dst_currency_id : xfer.dst_info.currency_id,
                dst_amount : AmountTools.toStorage( xfer.dst_amount, xfer.dst_info.dec_places ),
                created : q_now,
                updated : q_now,
                xfer_type: xfer.type,
                xfer_status: xfer.status,
            } );

            const xfer_event = {
                id: xfer.id,
                src : xfer.src_account,
                src_amount : xfer.src_amount,
                src_currency : xfer.src_info.currency,
                dst : xfer.dst_account,
                dst_amount : xfer.dst_amount,
                dst_currency : xfer.dst_info.currency,
                amount: xfer.amount,
                currency: xfer.currency,
                type: xfer.type,
                status: xfer.status,
            };

            if ( xfer.ext_id ) {
                xfer_q.set( 'ext_id', xfer.ext_id );
                xfer_event.ext_id = xfer.ext_id;
            }

            if ( misc_data ) {
                xfer.orig_misc_data = JSON.stringify( misc_data );
                xfer_q.set( 'misc_data', xfer.orig_misc_data );
                xfer_event.misc_data = misc_data;
            }

            if ( xfer.extra_fee && !cancel ) {
                if ( xfer.extra_fee.dst_info.acct_type !== this.ACCT_TRANSIT ) {
                    xfer_q.set( 'extra_fee_id', xfer.extra_fee.id );
                    xfer_event.extra_fee_id = xfer.extra_fee.id;
                } else {
                    as.error( 'XferError',
                        'Transit Extra Fee destination is not allowed' );
                }
            }

            //=========================
            if ( decrease_now ) {
                this._decreaseBalance( dbxfer, xfer );
            }

            if ( xfer.status === this.ST_DONE ) {
                this._increaseBalance( dbxfer, xfer );
            }

            //=========================

            // Transaction Fee
            if ( xfer.xfer_fee && !cancel ) {
                if ( xfer.out_xfer ) {
                    as.error( 'XferError',
                        'Xfer fee is not allowed for Transit destination' );
                }

                xfer.xfer_fee.id = UUIDTool.genXfer( dbxfer );
                xfer.xfer_fee.type = 'Fee';
                xfer.xfer_fee.status = xfer.status;
                xfer.xfer_fee.src_account = xfer.dst_account;
                xfer.xfer_fee.force = xfer.force;
                xfer.xfer_fee.in_xfer_fee = true;
                this._startXfer( as, dbxfer, xfer.xfer_fee );

                xfer_q.set( 'xfer_fee_id', xfer.xfer_fee.id );
                xfer_event.xfer_fee_id = xfer.xfer_fee.id;

                // Fee ID gets generated in async step
                as.add( ( as ) => {
                    if ( xfer.xfer_fee.dst_info.acct_type === this.ACCT_TRANSIT ) {
                        as.error( 'XferError',
                            'Transit Xfer Fee destination is not allowed' );
                    }
                } );
            }

            //---
            this._ccm.iface( EVTGEN_ALIAS )
                .addXferEvent( dbxfer, 'XFER_NEW', xfer_event );
        } );
    }

    _startXfer( as, dbxfer, xfer ) {
        xfer.misc_data = xfer.misc_data || {};

        this._getAccountsInfo( as, xfer );
        this._convXferAmounts( as, xfer );
        this._prepareTransit( as, xfer );

        // Check for previous attempts, if related external ID
        this._checkExisting( as, xfer );

        as.add( ( as ) => {
            // Insert new xfer
            if ( !xfer.id ) {
                xfer.id = UUIDTool.genXfer( dbxfer );
                xfer.status = xfer.status || this.ST_DONE;

                if ( !xfer.in_xfer ) {
                    // useless to lock with no balance moves
                    this._preLockAccounts( dbxfer, xfer );
                }

                // Extra Fee
                if ( xfer.extra_fee ) {
                    xfer.extra_fee.type = 'Fee';
                    xfer.extra_fee.src_account = xfer.src_account;
                    xfer.extra_fee.force = xfer.force;
                    this._startXfer( as, dbxfer, xfer.extra_fee );
                }

                this._usePreAuth( as, dbxfer, xfer );
                this._checkXferLimits( as, dbxfer, xfer );
                this._analyzeXferRisk( as, xfer );

                this._genRelIDs( as, dbxfer, xfer );
                this._createTransitInbound( as, dbxfer, xfer );
                this._createXfer( as, dbxfer, xfer );
                this._createTransitOutbound( as, dbxfer, xfer );
            } else if ( xfer.status === this.ST_CANCELED ) {
                as.error( 'AlreadyCanceled' );
            } else if ( xfer.in_transit ) {
                this._checkXferLimits( as, dbxfer, xfer );
                this._createXfer( as, dbxfer, xfer );
            } else if ( xfer.in_xfer_fee ) {
                this._createXfer( as, dbxfer, xfer );
            }
        } );
    }

    _completeXfer( dbxfer, xfer, next_state=this.ST_DONE ) {
        assert( xfer.status !== undefined );
        assert( xfer.status !== next_state );

        dbxfer.update( DB_XFERS_TABLE, { affected: 1 } )
            .set( 'xfer_status', next_state )
            .set( 'updated', dbxfer.helpers().now() )
            .where( 'uuidb64', xfer.id )
            .where( 'xfer_status', xfer.status );

        xfer.status = next_state;

        //---
        this._ccm.iface( EVTGEN_ALIAS )
            .addXferEvent( dbxfer, 'XFER_UPD', {
                id: xfer.id,
                status: xfer.status,
            } );
    }

    _updateMiscData( dbxfer, xfer ) {
        const new_misc_data = JSON.stringify( xfer.misc_data );

        dbxfer.update( DB_XFERS_TABLE, { affected: 1 } )
            .set( 'misc_data', new_misc_data )
            .where( 'uuidb64', xfer.id )
            .where( 'misc_data', xfer.orig_misc_data );

        xfer.orig_misc_data = new_misc_data;

        //---
        this._ccm.iface( EVTGEN_ALIAS )
            .addXferEvent( dbxfer, 'XFER_UPD', {
                id: xfer.id,
                misc_data: xfer.misc_data,
            } );
    }

    _cancelXfer( as, dbxfer, xfer ) {
        xfer.misc_data = xfer.misc_data || {};

        this._getAccountsInfo( as, xfer );
        this._convXferAmounts( as, xfer );
        this._prepareTransit( as, xfer );
        this._checkExisting( as, xfer );

        as.add( ( as ) => {
            const extra_fee = xfer.extra_fee;
            const in_xfer = xfer.in_xfer;
            const out_xfer = xfer.out_xfer;

            // Insert new xfer
            if ( !xfer.id ) {
                xfer.id = UUIDTool.genXfer( dbxfer );
                xfer.status = this.ST_CANCELED;

                if ( extra_fee ) {
                    extra_fee.status = this.ST_CANCELED;
                }

                if ( xfer.xfer_fee ) {
                    xfer.xfer_fee.status = this.ST_CANCELED;
                }

                if ( in_xfer ) {
                    in_xfer.status = this.ST_CANCELED;
                }

                if ( out_xfer ) {
                    out_xfer.status = this.ST_CANCELED;
                }

                this._createXfer( as, dbxfer, xfer );
            } else {
                this._checkCancel( as, xfer );

                if ( xfer.status !== this.ST_CANCELED ) {
                    // record cancel_reason
                    this._updateMiscData( dbxfer, xfer );
                }
            }
        } );
    }

    _completeCancel( as, xfer ) {
        const dbxfer = this.db.newXfer();

        //---
        const xfer_fee = xfer.xfer_fee;

        if ( xfer_fee && xfer_fee.id ) {
            const move_balance = ( xfer_fee.status === this.ST_DONE );

            if ( move_balance ) {
                this._decreaseBalance( dbxfer, xfer_fee, true );
            }

            this._completeXfer( dbxfer, xfer_fee, this.ST_CANCELED );

            if ( move_balance ) {
                this._increaseBalance( dbxfer, xfer_fee, true );
            }
        }

        //---
        if ( xfer.status === this.ST_DONE ) {
            this._decreaseBalance( dbxfer, xfer, true );
        }

        this._cancelLimits( as, dbxfer, xfer );
        this._completeXfer( dbxfer, xfer, this.ST_CANCELED );
        this._increaseBalance( dbxfer, xfer, true );

        as.add( ( as ) => dbxfer.execute( as ) );
    }

    _completeExtIn( as, xfer ) {
        const dbxfer = this.db.newXfer();
        this._preLockAccounts( dbxfer, xfer );
        this._decreaseBalance( dbxfer, xfer.in_xfer );
        this._completeXfer( dbxfer, xfer.in_xfer );

        this._increaseBalance( dbxfer, xfer.in_xfer );
        this._decreaseBalance( dbxfer, xfer );

        if ( xfer.misc_data.do_check && !xfer.user_confirm ) {
            this._completeXfer( dbxfer, xfer, this.ST_WAIT_USER );

            if ( xfer.out_xfer ) {
                this._completeXfer( dbxfer, xfer.out_xfer, this.ST_WAIT_USER );
            }

            if ( xfer.xfer_fee ) {
                this._completeXfer( dbxfer, xfer.xfer_fee, this.ST_WAIT_USER );
            }
        } else if ( xfer.out_xfer ) {
            this._completeXfer( dbxfer, xfer, this.ST_WAIT_EXT_OUT );

            // NOTE: balance operation is done in _completeExtOut

            this._completeXfer( dbxfer, xfer.out_xfer, this.ST_WAIT_EXT_OUT );
        } else {
            this._completeXfer( dbxfer, xfer );
            this._increaseBalance( dbxfer, xfer );

            if ( xfer.xfer_fee ) {
                this._decreaseBalance( dbxfer, xfer.xfer_fee );
                this._completeXfer( dbxfer, xfer.xfer_fee );
                this._increaseBalance( dbxfer, xfer.xfer_fee );
            }
        }

        if ( xfer.update_misc_data ) {
            this._updateMiscData( dbxfer, xfer );
            xfer.update_misc_data = false;
        }

        dbxfer.execute( as );
    }

    _completeCancelExtIn( as, xfer ) {
        const dbxfer = this.db.newXfer();

        this._preLockAccounts( dbxfer, xfer );

        if ( ( xfer.in_xfer.status === this.ST_DONE ) &&
             !xfer.out_xfer &&
             ( xfer.status !== this.ST_WAIT_USER )
        ) {
            this._decreaseBalance( dbxfer, xfer.in_xfer, true );
        }

        this._cancelLimits( as, dbxfer, xfer.in_xfer );
        this._completeXfer( dbxfer, xfer.in_xfer, this.ST_CANCELED );
        this._increaseBalance( dbxfer, xfer.in_xfer, true );

        as.add( ( as ) => dbxfer.execute( as ) );
    }

    _completeExtOut( as, xfer ) {
        const dbxfer = this.db.newXfer();

        this._preLockAccounts( dbxfer, xfer );

        this._completeXfer( dbxfer, xfer, this.ST_DONE );

        this._increaseBalance( dbxfer, xfer );
        this._decreaseBalance( dbxfer, xfer.out_xfer );

        this._completeXfer( dbxfer, xfer.out_xfer, this.ST_DONE );
        this._increaseBalance( dbxfer, xfer.out_xfer );

        dbxfer.execute( as );
    }

    _completeCancelExtOut( as, xfer ) {
        const dbxfer = this.db.newXfer();

        this._preLockAccounts( dbxfer, xfer );

        const xfer_status = xfer.status;

        if ( xfer.out_xfer.status === this.ST_DONE ) {
            this._decreaseBalance( dbxfer, xfer.out_xfer, true );
        }

        this._cancelLimits( as, dbxfer, xfer.out_xfer );
        this._completeXfer( dbxfer, xfer.out_xfer, this.ST_CANCELED );

        this._cancelLimits( as, dbxfer, xfer );
        this._completeXfer( dbxfer, xfer, this.ST_CANCELED );

        if ( xfer_status == this.ST_DONE ) {
            this._increaseBalance( dbxfer, xfer.out_xfer, true );
            this._decreaseBalance( dbxfer, xfer, true );
        }

        if ( ( xfer_status === this.ST_DONE ) ||
             ( xfer_status === this.ST_WAIT_EXT_OUT ) ||
             ( xfer_status === this.ST_WAIT_USER )
        ) {
            this._increaseBalance( dbxfer, xfer, true );

            if ( xfer.in_xfer ) {
                this._decreaseBalance( dbxfer, xfer.in_xfer, true );
            }
        }

        as.add( ( as ) => dbxfer.execute( as ) );
    }

    _completeUser( as, xfer ) {
        const dbxfer = this.db.newXfer();

        if ( xfer.out_xfer ) {
            this._completeXfer( dbxfer, xfer, this.ST_WAIT_EXT_OUT );

            // NOTE: balance operation is done in _completeExtOut

            this._completeXfer( dbxfer, xfer.out_xfer, this.ST_WAIT_EXT_OUT );
        } else {
            this._completeXfer( dbxfer, xfer );
            this._increaseBalance( dbxfer, xfer );

            if ( xfer.xfer_fee ) {
                this._decreaseBalance( dbxfer, xfer.xfer_fee );
                this._completeXfer( dbxfer, xfer.xfer_fee );
                this._increaseBalance( dbxfer, xfer.xfer_fee );
            }
        }

        dbxfer.execute( as );
    }

    _handleError( as, err, evt_type, xfer, holder=null ) {
        if ( ( err === 'DisabledAccount' ) &&
             ( evt_type === 'XFER_ERR' )
        ) {
            // minimize impact on DB
            return;
        }

        const error_info = as.state.error_info;
        const async_stack = as.state.async_stack;
        as.state.orig_last_exception = as.state.last_exception;

        this._ccm.iface( EVTGEN_ALIAS ).addEvent(
            as,
            evt_type,
            {
                err: err,
                info: error_info,
                [evt_type === 'MSG_ERR' ? 'msg' : 'xfer']: xfer,
            }
        );

        if ( holder ) {
            as.add(
                ( as ) => {
                    const dbxfer = this.db.newXfer();
                    this._processLimits(
                        as, dbxfer, 'Misc', holder, null, {
                            failure_daily_cnt: 1,
                            failure_weekly_cnt: 1,
                            failure_monthly_cnt: 1,
                        }
                    );
                    as.add( ( as ) => dbxfer.execute( as ) );
                },
                ( as, err ) => {
                    if ( err === 'LimitReject' ) {
                        // ignore
                        as.success();
                    }
                }
            );
        }

        //---
        as.add(
            ( as ) => as.error( err, error_info ),
            ( as, err ) => {
                as.state.async_stack = async_stack;
            }
        );
    }

    processXfer( as, xfer ) {
        this._load_local_face( as, g_xfer_types, TypeSpec );

        as.add( ( as ) => {
            // check data for consistency
            // TODO; disable for production
            if ( !SpecTools.checkCompiledType( as, g_xfer_types, 'XferInfo', xfer ) ) {
                as.error( 'XferError', 'Invalid xfer data' );
            }
        } );

        const dbxfer = this.db.newXfer();

        // Main logic
        as.add(
            ( as ) => {
                as.add( ( as ) => this._startXfer( as, dbxfer, xfer ) );
                as.add( ( as ) => this._domainDbStep( as, dbxfer, xfer ) );
            },
            ( as, err ) => this._handleError( as, err, 'XFER_ERR', xfer )
        );

        // Handle NOOP
        if ( xfer.noop ) {
            as.add( ( as ) => as.success( 'NOOP' ) );
            return;
        }

        // Actual DB xfer
        as.add(
            ( as ) => {
                dbxfer.executeAssoc( as );
                as.add( ( as, result ) => this._domainDbResult( as, xfer, result ) );
            },
            ( as, err ) => this._handleError( as, err, 'XFER_ERR', xfer )
        );

        // Process external logic
        as.add( ( as ) => {
            if ( xfer.in_xfer && ( xfer.in_xfer.status === this.ST_WAIT_EXT_IN ) ) {
                const extra_fee = xfer.extra_fee;

                if ( extra_fee && ( extra_fee.status !== this.ST_DONE ) ) {
                    as.add(
                        ( as ) => {
                            as.add( ( as ) => this._rawExtIn( as, extra_fee ) );
                            as.add( ( as ) => this._completeExtIn( as, extra_fee ) );
                        },
                        ( as, err ) => this._handleError(
                            as, err, 'XFER_EXTERR',
                            extra_fee, extra_fee.src_info.holder )
                    );
                }

                as.add(
                    ( as ) => {
                        as.add( ( as ) => this._domainExtIn( as, xfer ) );
                        as.add( ( as ) => this._completeExtIn( as, xfer ) );
                    },
                    ( as, err ) => this._handleError(
                        as, err, 'XFER_EXTERR', xfer, xfer.src_info.holder )
                );
            }

            as.add( ( as ) => {
                if ( xfer.status === this.ST_WAIT_USER ) {
                    if ( xfer.user_confirm ) {
                        this._completeUser( as, xfer );
                    } else {
                        as.error( this.ST_WAIT_USER, 'User confirmation is required' );
                    }
                }
            } );

            as.add(
                ( as ) => {
                    if ( xfer.status === this.ST_WAIT_EXT_OUT ) {
                        as.add( ( as ) => this._domainExtOut( as, xfer ) );
                        as.add( ( as ) => this._completeExtOut( as, xfer ) );
                    }
                },
                ( as, err ) => this._handleError(
                    as, err, 'XFER_EXTERR', xfer, xfer.dst_info.holder )
            );

            as.add( ( as ) => this._domainPostExternal( as, xfer ) );
        } );

        // Once done
        as.add( ( as ) => {
            as.success( xfer.id );
        } );
    }

    processCancel( as, xfer ) {
        if ( !g_xfer_types.types ) {
            SpecTools.loadIface( as, g_xfer_types, [ TypeSpec ] );
        }

        as.add( ( as ) => {
            // check data for consistency
            // TODO; disable for production
            if ( !SpecTools.checkCompiledType( as, g_xfer_types, 'XferInfo', xfer ) ) {
                as.error( 'XferError', 'Invalid xfer data' );
            }

            xfer.in_cancel = true;
        } );

        const dbxfer = this.db.newXfer();

        // Main logic
        as.add(
            ( as ) => {
                as.add( ( as ) => this._cancelXfer( as, dbxfer, xfer ) );
                as.add( ( as ) => this._domainDbCancelStep( as, dbxfer, xfer ) );
            },
            ( as, err ) => this._handleError( as, err, 'XFER_ERR', xfer )
        );

        // Handle NOOP
        if ( xfer.noop ) {
            as.add( ( as ) => as.success( 'NOOP' ) );
            return;
        }

        // Actual DB xfer
        as.add(
            ( as ) => {
                if ( xfer.reject_mode && ( xfer.status !== this.ST_WAIT_USER ) ) {
                    as.error( 'AlreadyCompleted' );
                }

                dbxfer.executeAssoc( as );
                as.add( ( as, result ) => this._domainDbCancelResult( as, xfer, result ) );
            },
            ( as, err ) => this._handleError( as, err, 'XFER_ERR', xfer )
        );

        // Process external logic
        as.add( ( as ) => {
            if ( xfer.out_xfer && ( xfer.out_xfer.status !== this.ST_CANCELED ) ) {
                as.add(
                    ( as ) => {
                        if ( ( xfer.out_xfer.status === this.ST_DONE ) ||
                             ( xfer.out_xfer.status === this.ST_WAIT_EXT_OUT )
                        ) {
                            as.add( ( as ) => this._domainCancelExtOut( as, xfer ) );
                        }

                        as.add( ( as ) => this._completeCancelExtOut( as, xfer ) );
                    },
                    ( as, err ) => this._handleError(
                        as, err, 'XFER_EXTERR', xfer, xfer.dst_info.holder )
                );
            } else if ( xfer.status !== this.ST_CANCELED ) {
                as.add(
                    ( as ) => this._completeCancel( as, xfer ),
                    ( as, err ) => this._handleError( as, err, 'XFER_ERR', xfer )
                );
            }


            if ( xfer.in_xfer && ( xfer.in_xfer.status !== this.ST_CANCELED ) ) {
                as.add(
                    ( as ) => {
                        as.add( ( as ) => this._domainCancelExtIn( as, xfer ) );
                        as.add( ( as ) => this._completeCancelExtIn( as, xfer ) );
                    },
                    ( as, err ) => this._handleError(
                        as, err, 'XFER_EXTERR', xfer, xfer.src_info.holder )
                );
            }

            const extra_fee = xfer.extra_fee;

            if ( extra_fee && extra_fee.id ) {
                if ( extra_fee.status != this.ST_CANCELED ) {
                    as.add(
                        ( as ) => this._completeCancel( as, extra_fee ),
                        ( as, err ) => this._handleError( as, err, 'XFER_ERR', extra_fee )
                    );
                }

                if ( extra_fee.in_xfer && ( extra_fee.in_xfer.status != this.ST_CANCELED ) ) {
                    as.add(
                        ( as ) => {
                            as.add( ( as ) => this._rawCancelExtIn( as, extra_fee ) );
                            as.add( ( as ) => this._completeCancelExtIn( as, extra_fee ) );
                        },
                        ( as, err ) => this._handleError(
                            as, err, 'XFER_EXTERR', extra_fee, extra_fee.src_info.holder )
                    );
                }
            }

            as.add( ( as ) => this._domainPostExternal( as, xfer ) );
        } );

        // Once done
        as.add( ( as ) => {
            as.success( xfer.id );
        } );
    }

    _peerXferData( xfer, to_external ) {
        return {
            to_external: to_external,
            xfer_type: xfer.type,
            orig_currency: xfer.currency,
            orig_amount: xfer.amount,
            dst_account: xfer.src_info.ext_acct_id,
            dst_currency: xfer.src_info.currency,
            dst_amount: xfer.src_amount,
            src_account: xfer.dst_info.ext_acct_id,
            src_currency: xfer.dst_info.currency,
            src_amount: xfer.dst_amount,
            ext_id: xfer.id,
            ext_info: xfer.misc_data.info || {},
            orig_ts : xfer.created,
        };
    }

    _peerXferCancelData( xfer, to_external ) {
        return Object.assign(
            this._peerXferData( xfer, to_external ),
            { reason: xfer.misc_data.cancel_reason || "Unknown" }
        );
    }

    _rawExtIn( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.src_account );
        as.add( ( as, iface ) => iface.call( as, 'rawXfer', this._peerXferData( xfer, true ) ) );
    }

    _rawCancelExtIn( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.src_account );
        as.add( ( as, iface ) => iface.call( as, 'cancelXfer', this._peerXferCancelData( xfer, true ) ) );
    }

    _rawExtOut( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.dst_account );
        as.add( ( as, iface ) => iface.call( as, 'rawXfer', this._peerXferData( xfer, false ) ) );
    }

    _rawCancelExtOut( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.dst_account );
        as.add( ( as, iface ) => iface.call( as, 'cancelXfer', this._peerXferCancelData( xfer, false ) ) );
    }

    _domainDbStep( as, _dbxfer, _xfer ) {
        // noop
        // mind xfer.repeat
    }

    _domainDbResult( as, _xfer, _result ) {
        // noop
    }

    _domainDbCancelStep( as, _dbxfer, _xfer ) {
        // noop
        // mind xfer.repeat
    }

    _domainDbCancelResult( as, _xfer, _result ) {
        // noop
    }

    _domainExtIn( as, xfer ) {
        this._rawExtIn( as, xfer.in_xfer );
    }

    _domainExtOut( as, xfer ) {
        this._rawExtOut( as, xfer.out_xfer );
    }

    _domainCancelExtIn( as, xfer ) {
        this._rawCancelExtIn( as, xfer.in_xfer );
    }

    _domainCancelExtOut( as, xfer ) {
        this._rawCancelExtOut( as, xfer.out_xfer );
    }

    _domainPostExternal( as, _xfer ) {
        // noop
    }

    pairPeer( as, holder, currency, alias=null ) {
        const ccm = this._ccm;
        const xferacct = ccm.iface( 'xfer.accounts' );
        let account_id;
        let already_peered_ext_id = false;

        alias = alias || `${currency} exchange`;

        xferacct.listAccounts(
            as,
            holder
        );
        as.add( ( as, accounts ) => {
            for ( let v of accounts ) {
                if ( ( v.type === this.ACCT_EXTERNAL ) &&
                     ( v.currency === currency ) &&
                     ( v.alias === alias )
                ) {
                    account_id = v.id;
                    already_peered_ext_id = v.ext_id;

                    return;
                }
            }

            // else
            xferacct.addAccount(
                as,
                holder,
                this.ACCT_EXTERNAL,
                currency,
                alias,
                true
            );
            as.add( ( as, res ) => account_id = res );
        } );

        as.add( ( as ) => {
            ccm.xferIface( as, 'futoin.xfer.peer', account_id );
            as.add( ( as, peerface ) => {
                peerface.pair( as, account_id, currency, alias );
            } );
            as.add( ( as, ext_id ) => {
                if ( already_peered_ext_id ) {
                    assert( already_peered_ext_id === ext_id );
                } else {
                    const dbxfer = ccm.db( 'xfer' ).newXfer();
                    dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } )
                        .set( 'ext_acct_id', ext_id )
                        .where( 'uuidb64', account_id );
                    dbxfer.execute( as );
                }
            } );
        } );
        as.add( ( as ) => as.success( account_id ) );
    }

    validatePeerRequest( as, holder, peer_account, rel_account ) {
        // NOTE: it's NOT security, it's only consistency check !!!

        const dbxfer = this.db.newXfer();
        // 1. peer_account belongs to holder and External
        dbxfer.select( DB_ACCOUNTS_VIEW, { selected: 1 } )
            .where( 'uuidb64', peer_account )
            .where( 'ext_holder_id', holder )
            .where( 'acct_type', this.ACCT_EXTERNAL );
        // 2. rel_account is Regular
        dbxfer.select( DB_ACCOUNTS_TABLE, { selected: 1 } )
            .where( 'uuidb64', rel_account )
            .where( 'acct_type IN', [ this.ACCT_EXTERNAL, this.ACCT_REGULAR ] );
        dbxfer.execute( as );
    }

    _load_local_face( as, iface, spec ) {
        if ( !iface.types ) {
            as.sync( g_load_mutex, ( as ) => {
                if ( !iface.types ) {
                    SpecTools.loadIface( as, iface, [ spec ] );
                }
            } );
        }
    }
}

module.exports = XferTools;
