'use strict';

const BaseService = require( './BaseService' );
const PeerFace = require( './PeerFace' );
const PaymentTools = require( './PaymentTools' );

/**
 * Peer Service
 */
class PeerService extends BaseService {
    static get IFACE_IMPL() {
        return PeerFace;
    }

    _xferTools( reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        return new PaymentTools( ccm );
    }

    _processParams( as, xt, reqinfo ) {
        const p = reqinfo.params();
        const holder = reqinfo.info.USER_INFO.globalID();

        let peer_account;
        let rel_account;

        if ( p.to_external ) {
            peer_account = p.dst_account;
            rel_account = p.src_account;
        } else {
            peer_account = p.src_account;
            rel_account = p.dst_account;
        }

        xt.validatePeerRequest( as, holder, peer_account, rel_account );

        return {
            type: p.xfer_type,
            src_limit_prefix: 'outbound',
            dst_limit_prefix: 'inbound',
            src_account: p.src_account,
            dst_account: p.dst_account,
            amount: p.orig_amount,
            currency: p.orig_currency,
            ext_id: xt.makeExtId( peer_account, p.ext_id ),
            orig_ts: p.orig_ts,
            misc_data: {
                info: p.ext_info,
            },
        };
    }

    pair( as, reqinfo ) {
        const ccm = reqinfo.executor().ccm();
        const xferacct = ccm.iface( 'xfer.accounts' );
        const p = reqinfo.params();
        const holder_global_id = reqinfo.info.USER_INFO.globalID();
        const ext_acct_id = p.ext_id;

        // Auto Create Peer Accunt Holder
        //---
        as.add(
            ( as ) => {
                xferacct.addAccountHolder(
                    as,
                    holder_global_id,
                    'DefaultPeer',
                    true,
                    false,
                    {},
                    {}
                );
            },
            ( as, err ) => {
                if ( err === 'DuplicateExtID' ) {
                    as.success();
                }
            }
        );
        as.add( ( as, account_holder_id ) => {
            if ( account_holder_id ) {
                as.state.account_holder_id = account_holder_id;
            } else {
                xferacct.getAccountHolderExt( as, holder_global_id );
                as.add( ( as, info ) => {
                    as.state.account_holder_id = info.id;
                } );
            }
        } );

        // Auto Create External account
        //---
        as.add(
            ( as ) => {
                xferacct.addAccount(
                    as,
                    as.state.account_holder_id,
                    'External',
                    p.currency,
                    p.alias,
                    true,
                    ext_acct_id
                );
            },
            ( as, err ) => {
                if ( err === 'Duplicate' ) {
                    as.success();
                }
            }
        );
        as.add( ( as, account_id ) => {
            if ( account_id ) {
                as.state.account_id = account_id;
            } else {
                xferacct.getAccountExt( as, as.state.account_holder_id, ext_acct_id );
                as.add( ( as, info ) => {
                    if ( info.currency !== p.currency ) {
                        as.error( 'CurrencyMismatch' );
                    }

                    as.state.account_id = info.id;
                } );
            }
        } );
        as.add( ( as ) => reqinfo.result( as.state.account_id ) );
    }

    rawXfer( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._processParams( as, xt, reqinfo );

        xt.processXfer( as, xfer );

        as.add( ( as ) => reqinfo.result( xfer.id ) );
    }

    cancelXfer( as, reqinfo ) {
        const xt = this._xferTools( reqinfo );
        const xfer = this._processParams( as, xt, reqinfo );

        xt.processCancel( as, xfer );

        as.add( ( as ) => reqinfo.result( true ) );
    }

    /**
     * Register futoin.xfers.peer interface with Executor
     * @alias PeerService.register
     * @param {AsyncSteps} as - steps interface
     * @param {Executor} executor - executor instance
     * @param {object} options - implementation defined options
     * @returns {PeerService} instance
     */
}

module.exports = PeerService;
