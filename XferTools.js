'use strict';

const moment = require( 'moment' );
const SpecTools = require( 'futoin-invoker/SpecTools' );

const AmountTools = require( './AmountTools' );
const UUIDTool = require( './UUIDTool' );

const {
    DB_ACCOUNTS_TABLE,
    DB_ENABLED_ACCOUNT_VIEW,
    DB_XFERS_TABLE,
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
                misc_data: 'map',
            },
        },
        XferInfo : {
            type: 'map',
            fields: {
                src_account: 'AccountID',
                src_limit_prefix: {
                    type: 'string',
                    optional: true,
                },
                src_limit_extra: {
                    type: 'map',
                    optional: true,
                },

                dst_account: 'AccountID',
                dst_limit_prefix: {
                    type: 'string',
                    optional: true,
                },
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
                type: 'string',

                ext_id : {
                    type: 'string',
                    optional: true,
                },
                misc_data: {
                    type: 'map',
                    optional: true,
                },
                fee: {
                    type: 'Fee',
                    optional: true,
                },
            },
        },
    },
};

const BY_EXT_ID = Symbol( 'by-ext-id' );
const ACC_INFO = Symbol( 'get-account-info' );

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

            for ( let [ k, dv ] of Object.entries( deltas ) ) {
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

            for ( let [ k, dv ] of Object.entries( deltas ) ) {
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

    _checkExistingExtId( as, xfer ) {
        const ext_id = xfer.ext_id;

        //---
        if ( !ext_id.endsWith( xfer.src_account ) &&
            !ext_id.endsWith( xfer.dst_account )
        ) {
            as.error( 'InternalError', 'Invalid external ID format' );
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

        as.add( ( as, rows ) => {
            if ( rows.length ) {
                const r = rows[0];

                if ( ( xfer.src_account !== r.src ) ||
                     ( xfer.src_info.currency_id !== r.src_currency_id ) ||
                     ( xfer.src_amount !== r.src_amount ) ||
                     ( xfer.dst_account !== r.dst ) ||
                     ( xfer.dst_info.currency_id !== r.dst_currency_id ) ||
                     ( xfer.dst_amount !== r.dst_amount ) ||
                     ( xfer.type !== r.xfer_type )
                ) {
                    as.error( "OriginalMismatch" );
                }

                xfer.id = r.uuidb64;
                xfer.status = r.status;
                xfer.misc_data = Object.assign(
                    xfer.misc_data,
                    JSON.parse( r.misc_data )
                );
            }
        } );
    }

    _getAccountsInfo( as, xfer ) {
        this._ccm.db( 'xfer' )
            .getPrepared( ACC_INFO, ( db ) => {
                const q = db.select( DB_ENABLED_ACCOUNT_VIEW );
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
            if ( rows.length !== 2 ) {
                as.error( 'DisabledAccount' );
            }

            for ( let i = 0; i < 2; ++i ) {
                const r = rows[i];
                r.balance = AmountTools.fromStorage( r.balance, r.dec_places );
                r.reserved = AmountTools.fromStorage( r.reserved, r.dec_places );
                r.overdraft = AmountTools.fromStorage( r.overdraft || '0', r.dec_places );
            }

            if ( rows[0].uuidb64 === xfer.src_account ) {
                xfer.src_info = rows[0];
                xfer.dst_info = rows[1];
            } else {
                xfer.src_info = rows[1];
                xfer.dst_info = rows[0];
            }

            if ( xfer.src_info.acct_type === 'Transit' ) {
                xfer.in_xfer = {
                    id: xfer.misc_data.rel_in_id,
                    src: xfer.src_info.rel_uuidb64,
                    dst: xfer.src_account,
                    currency: xfer.src_info.currency,
                    amount: xfer.src_amount,
                    type: xfer.type,
                    misc_data: Object.assign( xfer.misc_data, {
                        xfer_id: xfer.id,
                    } ),
                };
            }

            if ( xfer.dst_info.acct_type === 'Transit' ) {
                xfer.out_xfer = {
                    id: xfer.misc_data.rel_out_id,
                    src: xfer.dst_account,
                    dst: xfer.dst_info.rel_uuidb64,
                    currency: xfer.dst_info.currency,
                    amount: xfer.dst_amount,
                    type: xfer.type,
                    misc_data: Object.assign( xfer.misc_data, {
                        xfer_id: xfer.id,
                    } ),
                };
            }
        } );
    }

    _convXferAmounts( as, xfer ) {
        as.add( ( as ) => {
            // common
            if ( ( xfer.src_info.currency !== xfer.currency ) &&
                 ( xfer.dst_info.currency !== xfer.currency )
            ) {
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

    _checkXferLimits( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            // Check if enough balance, if not Transit account
            if ( xfer.src_info.acct_type !== 'Transit' &&
                 xfer.src_info.acct_type !== 'System' &&
                 !AmountTools.checkXferAmount( xfer.src_amount, xfer.src_info )
            ) {
                as.error( 'NotEnoughFunds' );
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
                }
            }

            if ( xfer.out_xfer ) {
                if ( !xfer.out_xfer.id ) {
                    // new case
                    const rel_out_id = UUIDTool.genXfer( dbxfer );
                    xfer.misc_data.rel_out_id = rel_out_id;
                    xfer.out_xfer.id = rel_out_id;
                }
            }
        } );
    }

    _createTransitInbound( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            if ( !xfer.in_xfer ) {
                return;
            }

            xfer.status = 'WaitExtIn';

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
            this._startXfer( as, dbxfer, out_xfer );
        } );
    }

    _createFee( as, dbxfer, xfer ) {
        const fee_xfer = Object.assign( {}, xfer.fee );
        fee_xfer.status = xfer.status;
        fee_xfer.src_account = xfer.src_account;
        this.startXfer( as, dbxfer, fee_xfer );
    }

    _decreaseBalance( dbxfer, xfer ) {
        const q_zero = dbxfer.escape( '0' );
        const q_src_amt = dbxfer.escape(
            AmountTools.toStorage( xfer.src_amount, xfer.src_info.dec_places )
        );

        // Source Account
        const src_q = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );

        src_q.set( 'updated', dbxfer.helpers().now() );

        if ( xfer.preauth ) {
            src_q.set( 'reserved', dbxfer.expr( `reserved + ${q_src_amt}` ) );
        } else {
            src_q.set( 'balance', dbxfer.expr( `balance - ${q_src_amt}` ) );
        }

        src_q.where( 'uuidb64', xfer.src_account );

        if ( !xfer.force &&
             ( xfer.src_info.acct_type !== 'System' )
        ) {
            src_q.where( `(balance + COALESCE(overdraft, ${q_zero}) - reserved - ${q_src_amt}) >= 0` );
        }
    }

    _increaseBalance( dbxfer, xfer_id ) {
        const sq = dbxfer.select( DB_XFERS_TABLE, { selected: 1 } )
            .where( 'uuidb64', xfer_id )
            .where( 'xfer_status', 'Done' );

        const uq = dbxfer.update( DB_ACCOUNTS_TABLE, { affected: 1 } );
        uq.set( 'balance', uq.expr( `balance + ${uq.backref( sq, 'dst_amount' )}` ) );
        uq.set( 'updated', dbxfer.helpers().now() );
        uq.where( 'uuidb64', uq.backref( sq, 'dst' ) );
        uq.where( 'currency_id', uq.backref( sq, 'dst_currency_id' ) );
    }

    _createXfer( as, dbxfer, xfer ) {
        as.add( ( as ) => {
            if ( xfer.do_check && !xfer.user_confirm ) {
                xfer.status = 'WaitUser';
            }

            if ( xfer.fee ) {
                xfer.fee.id = UUIDTool.genXfer( dbxfer );
                this._createFee( as, dbxfer, xfer );
            }

            if ( xfer.status !== 'WaitExtIn' ) {
                this._decreaseBalance( dbxfer, xfer );
            }

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

            if ( xfer.ext_id ) {
                xfer_q.set( 'ext_id', xfer.ext_id );
            }

            if ( xfer.misc_data ) {
                xfer_q.set( 'misc_data', JSON.stringify( xfer.misc_data ) );
            }

            if ( xfer.fee ) {
                xfer_q.set( 'fee_id', xfer.fee.id );
            }

            if ( xfer.status === 'Done' ) {
                this._increaseBalance( dbxfer, xfer.id );
            }
        } );
    }

    _startXfer( as, dbxfer, xfer ) {
        xfer.misc_data = xfer.misc_data || {};

        this._getAccountsInfo( as, xfer );
        this._convXferAmounts( as, xfer );

        // Check for previous attempts, if related external ID
        if ( xfer.ext_id ) {
            this._checkExistingExtId( as, xfer );
        }

        as.add( ( as ) => {
            // Insert new xfer
            if ( !xfer.id ) {
                xfer.id = xfer.id || UUIDTool.genXfer( dbxfer );
                xfer.status = xfer.status || 'Done';

                this._checkXferLimits( as, dbxfer, xfer );
                this._analyzeXferRisk( as, xfer );

                this._genRelIDs( as, dbxfer, xfer );
                this._createTransitInbound( as, dbxfer, xfer );
                this._createXfer( as, dbxfer, xfer );
                this._createTransitOutbound( as, dbxfer, xfer );
            } else if ( xfer.user_confirm ) {
                this._completeXfer( dbxfer, xfer.id, 'WaitUser', 'Done' );
            }
        } );
    }

    _completeXfer( dbxfer, xfer_id, prev_state, next_state='Done' ) {
        dbxfer.update( DB_XFERS_TABLE, { affected: 1 } )
            .set( 'xfer_status', next_state )
            .set( 'updated', dbxfer.helpers().now() )
            .where( 'uuidb64', xfer_id )
            .where( 'xfer_status', prev_state );

        this._increaseBalance( dbxfer, xfer_id );
    }

    _completeExtIn( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();
        this._decreaseBalance( dbxfer, xfer.in_xfer );
        this._completeXfer( dbxfer, xfer.misc_data.rel_in_id, 'WaitExtIn' );
        this._decreaseBalance( dbxfer, xfer );
        this._completeXfer( dbxfer, xfer.id, 'WaitExtIn' );

        if ( xfer.out_xfer ) {
            this._decreaseBalance( dbxfer, xfer.out_xfer );
            this._completeXfer( dbxfer, xfer.misc_data.rel_out_id,
                'WaitExtIn', 'WaitExtOut' );
        }

        dbxfer.execute( as );
    }

    _completeExtOut( as, xfer ) {
        const dbxfer = this._ccm.db( 'xfer' ).newXfer();
        this._completeXfer( dbxfer, xfer.misc_data.rel_out_id,
            'WaitExtOut', 'Done' );
        dbxfer.execute( as );
    }

    processXfer( as, xfer ) {
        // check data for consistency
        // TODO; disable for production
        if ( !SpecTools.checkType( TypeSpec, 'XferInfo', xfer ) ) {
            as.error( 'InternalError', 'Invalid type info' );
        }

        const dbxfer = this._ccm.db( 'xfer' ).newXfer();

        this._startXfer( as, dbxfer, xfer );
        as.add( ( as ) => this._domainDbStep( as, dbxfer, xfer ) );
        as.add( ( as ) => dbxfer.executeAssoc( as ) );
        as.add( ( as ) => {
            if ( xfer.status === 'WaitExtIn' ) {
                this._domainExtIn( as, xfer.in_xfer );
                as.add( ( as ) => this._completeExtIn( as, xfer ) );
            }

            if ( xfer.status === 'WaitUser' ) {
                return;
            }

            if ( xfer.misc_data.rel_out_id ) {
                as.add( ( as ) => this._domainExtOut( as, xfer.out_xfer ) );
                as.add( ( as ) => this._completeExtOut( as, xfer ) );
            }
        } );
    }

    _domainDbStep( as, _dbxfer, _xfer ) {
        // noop
    }

    _domainExtIn( as, _in_xfer ) {
        as.error( 'NotImplemented' );
    }

    _domainExtOut( as, _out_xfer ) {
        as.error( 'NotImplemented' );
    }
}

module.exports = XferTools;
