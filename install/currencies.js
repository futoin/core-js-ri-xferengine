'use strict';

const $as_request = require( 'futoin-request' );

const install_request = ( as, url ) => {
    if ( process.env.INSTALL_FALLBACK == 'Y' ) {
        as.error( 'Fallback' );
    } else {
        $as_request( as, url );
    }
};

module.exports = new class {
    /**
     * Fetch actual list of ISO currencies and update the system.
     *
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {XferCCM} ccm - CCM
     *
     * @alias install.ISO
     */
    ISO( as, ccm ) {
        const src_url = 'http://www.localeplanet.com/api/auto/currencymap.json?name=Y';
        as.add(
            ( as ) => install_request( as, src_url ),
            ( as, err ) => {
                as.success( null, require( './fallback_currencies_iso' ) );
            }
        );
        as.add( ( as, _, data ) => {
            if ( typeof data === 'string' ) {
                data = JSON.parse( data );
            }

            const currmng = ccm.iface( 'currency.manage' );

            as.forEach( data, ( as, code, info ) =>
                currmng.setCurrency(
                    as,
                    `I:${code}`,
                    info.decimal_digits,
                    info.name,
                    info.symbol,
                    true
                )
            );
        } );
    }

    /**
     * Fetch actual list of cryptocurrencies and update the system
     *
     * @param {AsyncSteps} as - AsyncSteps interface
     * @param {XferCCM} ccm - CCM
     *
     * @alias install.Crypto
     */
    Crypto( as, ccm ) {
        const src_url = 'https://min-api.cryptocompare.com/data/all/coinlist';
        as.add(
            ( as ) => install_request( as, src_url ),
            ( as, err ) => {
                as.success( null, require( './fallback_currencies_crypto' ) );
            }
        );
        as.add( ( as, _, data ) => {
            if ( typeof data === 'string' ) {
                data = JSON.parse( data );
            }

            data = data.Data;

            const currmng = ccm.iface( 'currency.manage' );

            as.forEach( data, ( as, code, info ) =>
                currmng.setCurrency(
                    as,
                    `C:${code}`,
                    8, // TODO
                    info.FullName,
                    `C:${info.Symbol}`,
                    true
                )
            );
        } );
    }

    KRPS( as, _ccm ) {
    }
};
