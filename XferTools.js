'use strict';

const AmountTools = require( './AmountTools' );
const moment = require( 'moment' );

const {
    limitStatsTable,
} = require( './main' );

class XferTools {
    constructor( ccm, domain ) {
        this._ccm = ccm;
        this._domain = domain;
    }

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
}

module.exports = XferTools;
