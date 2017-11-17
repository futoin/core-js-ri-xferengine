'use strict';

const assert = require( 'assert' );
const moment = require( 'moment' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

const AmountTools = require( './AmountTools' );
const UUIDTool = require( './UUIDTool' );

const {
    DB_ACCOUNTS_TABLE,
    DB_ACCOUNTS_VIEW,
    DB_XFERS_TABLE,
    EVTGEN_ALIAS,
    limitStatsTable,
    historyTimeBarrier,
} = require( './main' );

const TypeSpec = {
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
                src_limit_prefix: "PrefixOrFalse",
                src_limit_extra: {
                    type: 'map',
                    optional: true,
                },

                dst_account: 'AccountID',
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
            },
        },
    },
};

const BY_EXT_ID = Symbol( 'by-ext-id' );
const BY_FEE_ID = Symbol( 'by-fee-id' );
const BY_XFER_ID = Symbol( 'by-xfer-id' );
const ACC_INFO = Symbol( 'get-account-info' );

const ST_WAIT_USER = 'WaitUser';
const ST_WAIT_EXT_IN = 'WaitExtIn';
const ST_WAIT_EXT_OUT = 'WaitExtOut';
const ST_DONE = 'Done';
const ST_CANCELED = 'Canceled';
//const ST_REJECTED = 'Rejected';

const ACCT_SYSTEM = 'System';
//const ACCT_REGULAR = 'Regular';
//const ACCT_EXTERNAL = 'External';
const ACCT_TRANSIT = 'Transit';
//const ACCT_BONUS = 'Bonus';

/**
 * Actual transaction core
 * @private
 */
class XferTools {
    constructor( ccm, domain ) {
        this._ccm = ccm;
        this._domain = domain;
    }

    // Processing of Limits & Stats
    //-----------------------

    _processLimits( as, dbxfer, holder, delta_currency, deltas ) {
        const ccm = this._ccm;
        const limface = ccm.iface( 'xfer.limits' );
        const acctface = ccm.iface( 'xfer.accounts' );
        const currface = ccm.iface( 'currency.info' );
        const domain = this._domain;

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
                as.error( 'LimitReject' );
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

    addLimitProcessing( as, dbxfer, holder, currency, amount, prefix, extra={} ) {
        let deltas = Object.assign( {
            [`${prefix}_min_amt`] : amount,
            [`${prefix}_daily_amt`] : amount,
            [`${prefix}_daily_cnt`] : 1,
            [`${prefix}_weekly_amt`] : amount,
            [`${prefix}_weekly_cnt`] : 1,
            [`${prefix}_monthly_amt`] : amount,
            [`${prefix}_monthly_cnt`] : 1,
        }, extra );

        this._processLimits( as, dbxfer, holder, currency, deltas );
    }

    // Reverting transaction stats
    //-----------------------
    _cancelStats( as, dbxfer, holder, date, delta_currency, deltas ) {
        const ccm = this._ccm;
        const acctface = ccm.iface( 'xfer.accounts' );
        const currface = ccm.iface( 'currency.info' );
        const domain = this._domain;

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

    addStatsCancel( as, dbxfer, holder, date, currency, amount, prefix, extra={} ) {
        // cancel must be accounted as transaction for security reasons
        // cnt - (-1) = cnt + 1
        let deltas = Object.assign( {
            [`${prefix}_daily_amt`] : amount,
            [`${prefix}_daily_cnt`] : -1,
            [`${prefix}_weekly_amt`] : amount,
            [`${prefix}_weekly_cnt`] : -1,
            [`${prefix}_monthly_amt`] : amount,
            [`${prefix}_monthly_cnt`] : -1,
        }, extra );

        this._cancelStats( as, dbxfer, holder, date, currency, deltas );
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
            this._ccm.db( 'xfer' )
                .getPrepared( BY_EXT_ID, ( db ) => {
                    const q = db.select( DB_XFERS_TABLE );
                    q.where( 'ext_id', q.param( 'ext_id' ) );
                    return q.prepare();
                } )
                .executeAssoc( as, { ext_id } );
        } else if ( xfer.id ) {
            this._ccm.db( 'xfer' )
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
            xfer.status = r.xfer_status;
            xfer.created = moment.utc( r.created ).format();
            xfer.misc_data = Object.assign(
                xfer.misc_data,
                r.misc_data
            );
            xfer.repeat = true;

            if ( xfer.misc_data.rel_in_id ) {
                xfer.in_xfer.id = xfer.misc_data.rel_in_id;

                if ( xfer.status === ST_WAIT_EXT_IN ) {
                    xfer.in_xfer.status = ST_WAIT_EXT_IN;
                } else {
                    xfer.in_xfer.status = ST_DONE;
                }
            }

            if ( xfer.misc_data.rel_out_id ) {
                xfer.out_xfer.id = xfer.misc_data.rel_out_id;
                xfer.out_xfer.status = xfer.status;
            }

            if ( r.extra_fee_id ) {
                if ( !xfer.extra_fee ) {
                    as.error( "OriginalMismatch", 'ExtraFee' );
                }

                xfer.extra_fee.id = r.extra_fee_id;
                xfer.extra_fee.src_account = xfer.src_account;
                xfer.extra_fee.force = xfer.force;
                this._readFeeXfer( as, xfer.extra_fee );
            }

            if ( r.xfer_fee_id ) {
                if ( !xfer.xfer_fee ) {
                    as.error( "OriginalMismatch", 'Fee' );
                }

                xfer.xfer_fee.id = r.xfer_fee_id;
                xfer.xfer_fee.src_account = xfer.dst_account;
                xfer.xfer_fee.force = xfer.force;
                this._readFeeXfer( as, xfer.xfer_fee );
            }
        } );
    }

    _readFeeXfer( as, fee_xfer ) {
        fee_xfer.type = 'Fee';
        fee_xfer.misc_data = fee_xfer.misc_data || {};

        this._getAccountsInfo( as, fee_xfer );
        this._convXferAmounts( as, fee_xfer );
        this._prepareTransit( as, fee_xfer );

        this._ccm.db( 'xfer' )
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
            fee_xfer.misc_data = Object.assign(
                fee_xfer.misc_data,
                JSON.parse( r.misc_data )
            );

            // fee amounts may change on repeat calls - use original
            fee_xfer.src_amount = AmountTools.fromStorage(
                r.src_amount, fee_xfer.src_info.dec_places );
            fee_xfer.dst_amount = AmountTools.fromStorage(
                r.dst_amount, fee_xfer.dst_info.dec_places );

            fee_xfer.repeat = true;

            if ( fee_xfer.misc_data.rel_in_id ) {
                fee_xfer.in_xfer.id = fee_xfer.misc_data.rel_in_id;

                if ( fee_xfer.status === ST_WAIT_EXT_IN ) {
                    fee_xfer.in_xfer.status = ST_WAIT_EXT_IN;
                } else {
                    fee_xfer.in_xfer.status = ST_DONE;
                }
            }
        } );
    }

    _getAccountsInfo( as, xfer ) {
        this._ccm.db( 'xfer' )
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
                const r = rows[i];
                r.balance = AmountTools.fromStorage( r.balance, r.dec_places );
                r.reserved = AmountTools.fromStorage( r.reserved, r.dec_places );
                r.overdraft = AmountTools.fromStorage( r.overdraft, r.dec_places );
            }

            if ( rows[0].uuidb64 === xfer.src_account ) {
                xfer.src_info = rows[0];
                xfer.dst_info = rows[1];
            } else {
                xfer.src_info = rows[1];
                xfer.dst_info = rows[0];
            }

            if ( xfer.force ) {
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

            if ( xfer.src_info.acct_type === ACCT_TRANSIT ) {
                xfer.in_xfer = {
                    id: xfer.misc_data.rel_in_id,
                    src_account: xfer.src_info.rel_uuidb64,
                    dst_account: xfer.src_account,
                    currency: xfer.src_info.currency,
                    amount: xfer.src_amount,
                    type: xfer.type,
                    misc_data: Object.assign( {}, xfer.misc_data, {
                        xfer_id: xfer.id,
                    } ),
                    in_transit: true,
                    force: xfer.force,
                };
            }

            if ( xfer.dst_info.acct_type === ACCT_TRANSIT ) {
                xfer.out_xfer = {
                    id: xfer.misc_data.rel_out_id,
                    src_account: xfer.dst_account,
                    dst_account: xfer.dst_info.rel_uuidb64,
                    currency: xfer.dst_info.currency,
                    amount: xfer.dst_amount,
                    type: xfer.type,
                    misc_data: Object.assign( {}, xfer.misc_data, {
                        xfer_id: xfer.id,
                    } ),
                    in_transit: true,
                    force: xfer.force,
                };
            }
        } );
    }

    _checkXferLimits( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            // Check if enough balance, if not Transit account
            if ( xfer.src_info.acct_type !== ACCT_TRANSIT &&
                 xfer.src_info.acct_type !== ACCT_SYSTEM
            ) {
                let req_amt = xfer.src_amount;

                if ( xfer.extra_fee ) {
                    req_amt = AmountTools.add(
                        req_amt,
                        xfer.extra_fee.src_amount,
                        xfer.src_info.dec_places
                    );
                }

                if ( !AmountTools.checkXferAmount( req_amt, xfer.src_info ) ) {
                    as.error( 'NotEnoughFunds' );
                }
            }

            if ( xfer.src_limit_prefix ) {
                this.addLimitProcessing(
                    as, dbxfer,
                    xfer.src_info.holder,
                    xfer.src_info.currency, xfer.src_amount,
                    xfer.src_limit_prefix, xfer.src_limit_extra || {} );

                as.add( ( as, { do_check, do_risk } ) => {
                    xfer.do_check = xfer.do_check || do_check;
                    xfer.do_risk = xfer.do_risk || do_risk;
                } );
            }

            if ( xfer.dst_limit_prefix ) {
                this.addLimitProcessing(
                    as, dbxfer,
                    xfer.dst_info.holder,
                    xfer.dst_info.currency, xfer.dst_amount,
                    xfer.dst_limit_prefix, xfer.dst_limit_extra || {} );

                as.add( ( as, { do_check, do_risk } ) => {
                    xfer.do_check = xfer.do_check || do_check;
                    xfer.do_risk = xfer.do_risk || do_risk;
                } );
            }
        } );
    }

    _checkCancelLimits( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            // Check if enough balance, if not Transit account
            if ( xfer.dst_info.acct_type !== ACCT_TRANSIT &&
                 xfer.dst_info.acct_type !== ACCT_SYSTEM &&
                 ( xfer.status !== ST_CANCELED )
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

            if ( xfer.src_limit_prefix ) {
                this.addStatsCancel(
                    as, dbxfer,
                    xfer.src_info.holder,
                    xfer.orig_ts,
                    xfer.src_info.currency, xfer.src_amount,
                    xfer.src_limit_prefix, xfer.src_limit_extra || {} );
            }

            if ( xfer.dst_limit_prefix ) {
                this.addStatsCancel(
                    as, dbxfer,
                    xfer.dst_info.holder,
                    xfer.orig_ts,
                    xfer.dst_info.currency, xfer.dst_amount,
                    xfer.dst_limit_prefix, xfer.dst_limit_extra || {} );
            }
        } );
    }

    _analyzeXferRisk( as, xfer ) {
        as.add( ( as ) => {
            if ( !xfer.do_risk ) {
                return;
            }

            // TODO: call external risk analysis service
            as.error( 'TODO', 'Risk analysis' );
        } );
    }

    _genRelIDs( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            if ( xfer.in_xfer ) {
                xfer.user_confirm = true; // force for external wallet

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

            xfer.status = ST_WAIT_EXT_IN;

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
        const acct_q = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );

        if ( cancel ) {
            acct_info = xfer.dst_info;
            account = xfer.dst_account;
            balance_field = 'dst_post_balance';

            xfer_q.get( [ 'dst', 'dst_amount', 'dst_currency_id' ] );
            q_amt = acct_q.backref( xfer_q, 'dst_amount' );

            acct_q.where( 'uuidb64', acct_q.backref( xfer_q, 'dst' ) );
            acct_q.where( 'currency_id', acct_q.backref( xfer_q, 'dst_currency_id' ) );
        } else {
            acct_info = xfer.src_info;
            account = xfer.src_account;
            balance_field = 'src_post_balance';

            xfer_q.get( [ 'src', 'src_amount', 'src_currency_id' ] );
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

        if ( acct_info.acct_type !== ACCT_SYSTEM ) {
            acct_q.where( `(balance + COALESCE(overdraft, ${q_zero}) - reserved - ${q_amt}) >= 0` );
        }

        this._recordBalance( dbxfer, xfer, account, balance_field );
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
            xfer_q.where( 'xfer_status', ST_CANCELED );

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
            }
        } else {
            acct_info = xfer.dst_info;
            account = xfer.dst_account;
            balance_field = 'dst_post_balance';

            xfer_q.get( [ 'dst', 'dst_amount', 'dst_currency_id' ] );
            xfer_q.where( 'xfer_status', ST_DONE );

            acct_q.set( 'balance', acct_q.expr( `balance + ${acct_q.backref( xfer_q, 'dst_amount' )}` ) );
            acct_q.set( 'updated', dbxfer.helpers().now() );
            acct_q.where( 'uuidb64', acct_q.backref( xfer_q, 'dst' ) );
            acct_q.where( 'currency_id', acct_q.backref( xfer_q, 'dst_currency_id' ) );
        }

        // double safety
        acct_q.where( 'uuidb64', account );
        acct_q.where( 'currency_id', acct_info.currency_id );

        this._recordBalance( dbxfer, xfer, account, balance_field );
    }

    _recordBalance( dbxfer, xfer, account, target_field ) {
        const acct_q = dbxfer.select( DB_ACCOUNTS_TABLE, { selected: 1 } );
        acct_q.get( [ 'balance', 'reserved' ] ).where( 'uuidb64', account );

        const xfer_q = dbxfer.update( DB_XFERS_TABLE, { affected: 1 } );
        xfer_q.set( target_field, xfer_q.backref( acct_q, 'balance' ) );
        xfer_q.where( 'uuidb64', xfer.id );

        const evtgen = this._ccm.iface( EVTGEN_ALIAS );
        const evt_q = dbxfer.insert( evtgen.DB_EVENT_TABLE, { affected: 1 } )
            .set( 'type', 'ACCT_BAL' )
            .set( 'ts', dbxfer.helpers().now() );

        const json_id = JSON.stringify( account );

        // TODO: cleanup this mess
        //=========
        const evt_data_parts = [
            evt_q.escape( `{"id":${json_id},"raw_balance":"` ),
            evt_q.backref( acct_q, 'balance' ),
            evt_q.escape( '","raw_reserved":"' ),
            evt_q.backref( acct_q, 'reserved' ),
            evt_q.escape( '"}' ),
        ];
        let evt_data;

        if ( dbxfer._db_type === 'mysql' ) {
            evt_data = `CONCAT(${evt_data_parts.join( ',' )})`;
        } else {
            evt_data = evt_data_parts.join( '||' );
        }

        if ( dbxfer._db_type === 'postgresql' ) {
            evt_data = `(${evt_data})::json`;
        }

        //=========
        evt_q.set( 'data', evt_q.expr( evt_data ) );
    }

    _createXfer( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            let cancel = ( xfer.status === ST_CANCELED );
            let decrease_now = false;

            if ( xfer.do_check && !xfer.user_confirm && !cancel ) {
                xfer.status = ST_WAIT_USER;
            }

            if ( cancel ) {
                // pass all
            } else if ( xfer.status === ST_WAIT_EXT_IN ) {
                /// pass all
            } else if ( xfer.in_transit &&
                       ( xfer.status === ST_WAIT_USER || xfer.status === ST_WAIT_EXT_OUT )
            ) {
                // pass only on out
            } else {
                decrease_now = true;
            }

            if ( xfer.out_xfer && ( xfer.status === ST_DONE ) ) {
                xfer.status = ST_WAIT_EXT_OUT;
            }

            //=========================

            const q_now = dbxfer.helpers().now();

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

            if ( xfer.misc_data ) {
                xfer_q.set( 'misc_data', JSON.stringify( xfer.misc_data ) );
                xfer_event.misc_data = xfer.misc_data;
            }

            if ( xfer.extra_fee && !cancel ) {
                if ( xfer.extra_fee.dst_info.acct_type !== ACCT_TRANSIT ) {
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

            if ( xfer.status === ST_DONE ) {
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
                    if ( xfer.xfer_fee.dst_info.acct_type === ACCT_TRANSIT ) {
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
                xfer.status = xfer.status || ST_DONE;

                // Extra Fee
                if ( xfer.extra_fee ) {
                    xfer.extra_fee.type = 'Fee';
                    xfer.extra_fee.src_account = xfer.src_account;
                    xfer.extra_fee.force = xfer.force;
                    this._startXfer( as, dbxfer, xfer.extra_fee );
                }

                this._checkXferLimits( as, dbxfer, xfer );
                this._analyzeXferRisk( as, xfer );

                this._genRelIDs( as, dbxfer, xfer );
                this._createTransitInbound( as, dbxfer, xfer );
                this._createXfer( as, dbxfer, xfer );
                this._createTransitOutbound( as, dbxfer, xfer );
            } else if ( xfer.status === ST_CANCELED ) {
                as.error( 'AlreadyCanceled' );
            } else if ( xfer.in_transit || xfer.in_xfer_fee ) {
                this._createXfer( as, dbxfer, xfer );
            } else if ( xfer.user_confirm &&
                        ( xfer.status === ST_WAIT_USER )
            ) {
                xfer.repeat = false;

                if ( xfer.out_xfer ) {
                    this._getAccountsInfo( as, xfer.out_xfer );

                    as.add( ( as ) => {
                        this._completeXfer( dbxfer, xfer, ST_WAIT_EXT_OUT );
                        // no balance updates
                        this._completeXfer( dbxfer, xfer.out_xfer, ST_WAIT_EXT_OUT );
                    } );
                } else {
                    this._completeXfer( dbxfer, xfer );
                    this._increaseBalance( dbxfer, xfer );
                }
            }
        } );
    }

    _completeXfer( dbxfer, xfer, next_state=ST_DONE ) {
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
                xfer.id = xfer.id || UUIDTool.genXfer( dbxfer );
                xfer.status = ST_CANCELED;

                if ( extra_fee ) {
                    extra_fee.status = ST_CANCELED;
                }

                if ( xfer.xfer_fee ) {
                    xfer.xfer_fee.status = ST_CANCELED;
                }

                if ( in_xfer ) {
                    in_xfer.status = ST_CANCELED;
                }

                if ( out_xfer ) {
                    out_xfer.status = ST_CANCELED;
                }

                this._createXfer( as, dbxfer, xfer );
            }

            if ( in_xfer ) {
                this._getAccountsInfo( as, in_xfer );
            }

            if ( out_xfer ) {
                this._getAccountsInfo( as, out_xfer );
            }

            if ( extra_fee && extra_fee.in_xfer ) {
                this._getAccountsInfo( as, extra_fee.in_xfer );
            }

            this._checkCancelLimits( as, dbxfer, xfer );
        } );
    }

    _completeCancel( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        if ( xfer.status === ST_DONE ) {
            if ( xfer.xfer_fee && xfer.xfer_fee.id ) {
                this._completeCancel( as, xfer.xfer_fee );
            }

            this._decreaseBalance( dbxfer, xfer, true );
        }

        this._completeXfer( dbxfer, xfer, ST_CANCELED );
        this._increaseBalance( dbxfer, xfer, true );

        dbxfer.execute( as );
    }

    _completeExtIn( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();
        this._decreaseBalance( dbxfer, xfer.in_xfer );
        this._completeXfer( dbxfer, xfer.in_xfer );

        // optimized out
        //this._increaseBalance( dbxfer, xfer.in_xfer );
        //this._decreaseBalance( dbxfer, xfer );

        if ( xfer.out_xfer ) {
            this._completeXfer( dbxfer, xfer, ST_WAIT_EXT_OUT );

            // optimized out
            //this._increaseBalance( dbxfer, xfer );
            //this._decreaseBalance( dbxfer, xfer.out_xfer );

            this._completeXfer( dbxfer, xfer.out_xfer, ST_WAIT_EXT_OUT );
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

    _completeCancelExtIn( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        if ( xfer.in_xfer.status === ST_DONE ) {
            this._decreaseBalance( dbxfer, xfer.in_xfer, true );
        }

        this._completeXfer( dbxfer, xfer.in_xfer, ST_CANCELED );
        this._increaseBalance( dbxfer, xfer.in_xfer, true );

        dbxfer.execute( as );
    }

    _completeExtOut( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        this._completeXfer( dbxfer, xfer, ST_DONE );

        // optimized out
        //this._increaseBalance( dbxfer, xfer );
        //this._decreaseBalance( dbxfer, xfer.out_xfer );

        this._completeXfer( dbxfer, xfer.out_xfer, ST_DONE );
        this._increaseBalance( dbxfer, xfer.out_xfer );

        dbxfer.execute( as );
    }

    _completeCancelExtOut( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();
        const xfer_status = xfer.status;

        if ( xfer.out_xfer.status === ST_DONE ) {
            this._decreaseBalance( dbxfer, xfer.out_xfer, true );
        }

        this._completeXfer( dbxfer, xfer.out_xfer, ST_CANCELED );

        // optimized out
        //this._increaseBalance( dbxfer, xfer.out_xfer, true );
        //this._decreaseBalance( dbxfer, xfer, true );

        this._completeXfer( dbxfer, xfer, ST_CANCELED );

        if ( ( xfer_status === ST_DONE ) ||
             ( xfer_status === ST_WAIT_EXT_OUT )
        ) {
            this._increaseBalance( dbxfer, xfer, true );
        }

        dbxfer.execute( as );
    }

    processXfer( as, xfer ) {
        // check data for consistency
        // TODO; disable for production
        if ( !SpecTools.checkType( TypeSpec, 'XferInfo', xfer ) ) {
            as.error( 'XferError', 'Invalid xfer data' );
        }

        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        as.add(
            ( as ) => {
                as.add( ( as ) => this._startXfer( as, dbxfer, xfer ) );
                as.add( ( as ) => this._domainDbStep( as, dbxfer, xfer ) );
            },
            ( as, err ) => {
                const error_info = as.state.error_info;
                this._ccm.iface( EVTGEN_ALIAS ).addEvent(
                    as,
                    'XFER_ERR',
                    {
                        err: err,
                        info: error_info,
                        xfer: xfer,
                    }
                );
                as.add( ( as ) => as.error( err, error_info ) );
            }
        );

        if ( xfer.noop ) {
            as.add( ( as ) => as.success( 'NOOP' ) );
            return;
        }

        as.add( ( as ) => {
            if ( xfer.repeat ) {
                assert( dbxfer._query_list.length === 0 );
            } else {
                dbxfer.executeAssoc( as );
            }
        } );
        as.add( ( as ) => {
            if ( xfer.status === ST_WAIT_EXT_IN ) {
                if ( xfer.extra_fee && ( xfer.extra_fee.status !== ST_DONE ) ) {
                    as.add( ( as ) => this._rawExtIn( as, xfer.extra_fee ) );
                    as.add( ( as ) => this._completeExtIn( as, xfer.extra_fee ) );
                }

                as.add( ( as ) => this._domainExtIn( as, xfer ) );
                as.add( ( as ) => this._completeExtIn( as, xfer ) );
            }

            if ( xfer.status === ST_WAIT_USER ) {
                as.error( ST_WAIT_USER, 'User confirmation is required' );
            }

            as.add( ( as ) => {
                if ( xfer.status === ST_WAIT_EXT_OUT ) {
                    as.add( ( as ) => this._domainExtOut( as, xfer ) );
                    as.add( ( as ) => this._completeExtOut( as, xfer ) );
                }
            } );
        } );
        as.add( ( as ) => {
            as.success( xfer.id );
        } );
    }

    processCancel( as, xfer ) {
        // check data for consistency
        // TODO; disable for production
        if ( !SpecTools.checkType( TypeSpec, 'XferInfo', xfer ) ) {
            as.error( 'XferError', 'Invalid xfer data' );
        }

        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        as.add(
            ( as ) => {
                as.add( ( as ) => this._cancelXfer( as, dbxfer, xfer ) );
                as.add( ( as ) => this._domainDbCancelStep( as, dbxfer, xfer ) );
            },
            ( as, err ) => {
                const error_info = as.state.error_info;
                this._ccm.iface( EVTGEN_ALIAS ).addEvent(
                    as,
                    'XFER_ERR',
                    {
                        err: err,
                        info: error_info,
                        xfer: xfer,
                    }
                );
                as.add( ( as ) => as.error( err, error_info ) );
            }
        );

        if ( xfer.noop ) {
            as.add( ( as ) => as.success( 'NOOP' ) );
            return;
        }

        as.add( ( as ) => {
            if ( xfer.reject_mode && ( xfer.status !== ST_WAIT_USER ) ) {
                as.error( 'AlreadyCompleted' );
            }

            if ( !xfer.repeat || ( dbxfer._query_list.length > 0 ) ) {
                dbxfer.executeAssoc( as );
            }
        } );
        as.add( ( as ) => {
            if ( xfer.out_xfer && ( xfer.out_xfer.status != ST_CANCELED ) ) {
                as.add( ( as ) => this._domainCancelExtOut( as, xfer ) );
                as.add( ( as ) => this._completeCancelExtOut( as, xfer ) );
            } else if ( xfer.status != ST_CANCELED ) {
                as.add( ( as ) => this._completeCancel( as, xfer ) );
            }


            if ( xfer.in_xfer && ( xfer.in_xfer.status != ST_CANCELED ) ) {
                as.add( ( as ) => this._domainCancelExtIn( as, xfer ) );
                as.add( ( as ) => this._completeCancelExtIn( as, xfer ) );
            }

            const extra_fee = xfer.extra_fee;

            if ( extra_fee && extra_fee.id ) {
                if ( extra_fee.status != ST_CANCELED ) {
                    as.add( ( as ) => this._completeCancel( as, extra_fee ) );
                }

                if ( extra_fee.in_xfer && ( extra_fee.in_xfer.status != ST_CANCELED ) ) {
                    as.add( ( as ) => this._rawCancelExtIn( as, extra_fee ) );
                    as.add( ( as ) => this._completeCancelExtIn( as, extra_fee ) );
                }
            }
        } );
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
            orig_ts : xfer.created || moment.utc().format(),
        };
    }

    _rawExtIn( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.src_account );
        as.add( ( as, iface ) => iface.call( as, 'rawXfer', this._peerXferData( xfer, true ) ) );
    }

    _rawCancelExtIn( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.src_account );
        as.add( ( as, iface ) => iface.call( as, 'cancelXfer', this._peerXferData( xfer, true ) ) );
    }

    _rawExtOut( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.dst_account );
        as.add( ( as, iface ) => iface.call( as, 'rawXfer', this._peerXferData( xfer, false ) ) );
    }

    _rawCancelExtOut( as, xfer ) {
        this._ccm.xferIface( as, 'futoin.xfer.peer', xfer.dst_account );
        as.add( ( as, iface ) => iface.call( as, 'cancelXfer', this._peerXferData( xfer, false ) ) );
    }

    _domainDbStep( as, _dbxfer, _xfer ) {
        // noop
        // mind xfer.repeat
    }

    _domainDbCancelStep( as, _dbxfer, _xfer ) {
        // noop
        // mind xfer.repeat
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
                if ( ( v.type === 'External' ) &&
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
                'External',
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

        const dbxfer = this._ccm.db( 'xfer' ).newXfer();
        // 1. peer_account belongs to holder and External
        dbxfer.select( DB_ACCOUNTS_VIEW, { selected: 1 } )
            .where( 'uuidb64', peer_account )
            .where( 'ext_holder_id', holder )
            .where( 'acct_type', 'External' );
        // 2. rel_account is Regular
        dbxfer.select( DB_ACCOUNTS_TABLE, { selected: 1 } )
            .where( 'uuidb64', rel_account )
            .where( 'acct_type', 'Regular' );
        dbxfer.execute( as );
    }
}

module.exports = XferTools;
