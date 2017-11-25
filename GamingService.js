'use strict';

const BaseService = require( './BaseService' );
const GamingFace = require( './GamingFace' );
const GamingTools = require( './GamingTools' );

/**
 * Gaming Service
 */
class GamingService extends BaseService {
    static get IFACE_IMPL() {
        return GamingFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new GamingTools( ccm );
    }

    bet( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );

        xt.findAccount( as, p.user, p.currency, false );

        as.add( ( as, account, _bonus_accounts ) => {
            const xfer = {
                type: 'Bet',
                src_limit_domain: 'Gaming',
                src_limit_prefix: 'bet',
                dst_limit_domain: 'Payments',
                dst_limit_prefix: 'inbound',
                src_account: account,
                dst_account: p.rel_account,
                amount: p.amount,
                currency: p.currency,
                ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
                orig_ts: p.orig_ts,
                misc_data: {
                    info: p.ext_info,
                    orig_ts: p.orig_ts,
                    round_id: xt.makeExtId( p.rel_account, p.round_id ),
                },
            };

            xt.processXfer( as, xfer );

            as.add( ( as, xfer_id ) => {
                reqinfo.result( {
                    xfer_id,
                    balance: xfer.game_balance,
                    bonus_part: xfer.bonus_part,
                } );
            } );
        } );
    }

    cancelBet( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );

        xt.findAccount( as, p.user, p.currency, true );

        as.add( ( as, account ) => {
            const xfer = {
                type: 'Bet',
                src_limit_domain: 'Gaming',
                src_limit_prefix: 'bet',
                dst_limit_domain: 'Payments',
                dst_limit_prefix: 'inbound',
                src_account: account,
                dst_account: p.rel_account,
                amount: p.amount,
                currency: p.currency,
                ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
                orig_ts: p.orig_ts,
                misc_data: {
                    info: p.ext_info,
                    orig_ts: p.orig_ts,
                    round_id: xt.makeExtId( p.rel_account, p.round_id ),
                },
            };

            xt.processCancel( as, xfer );

            xt.getGameBalance( as, p.user, p.currency );
            as.add( ( as, balance ) => reqinfo.result( { balance } ) );
        } );
    }

    win( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );

        xt.findAccount( as, p.user, p.currency, true );

        as.add( ( as, account ) => {
            const xfer = {
                type: 'Win',
                src_limit_domain: 'Payments',
                src_limit_prefix: 'outbound',
                dst_limit_domain: 'Gaming',
                dst_limit_prefix: 'win',
                src_account: p.rel_account,
                dst_account: account,
                amount: p.amount,
                currency: p.currency,
                ext_id: xt.makeExtId( p.rel_account, p.ext_id ),
                orig_ts: p.orig_ts,
                misc_data: {
                    info: p.ext_info,
                    orig_ts: p.orig_ts,
                    round_id: xt.makeExtId( p.rel_account, p.round_id ),
                },
            };

            xt.processXfer( as, xfer );

            as.add( ( as, xfer_id ) => {
                reqinfo.result( {
                    xfer_id,
                    balance: xfer.game_balance,
                    bonus_part: xfer.bonus_part,
                } );
            } );
        } );
    }

    gameBalance( as, reqinfo ) {
        const p = reqinfo.params();
        const xt = this._xferTools( reqinfo );
        xt.getGameBalance( as, p.user, p.currency );
        as.add( ( as, balance ) => reqinfo.result( { balance } ) );
    }


    /**
     * Register futoin.xfers.gaming interface with Executor
     * @alias GamingService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {GamingService} instance
     */
}

module.exports = GamingService;
