'use strict';

const tinyJsonHttp = require( 'tiny-json-http' );

const install_request = ( as, url ) => {
    if ( process.env.INSTALL_FALLBACK == 'Y' ) {
        as.error( 'Fallback' );
    } else {
        as.await( tinyJsonHttp.get( { url } ) );
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
                as.success( { body: require( './fallback_currencies_iso' ) } );
            }
        );
        as.add( ( as, { body } ) => {
            const currmng = ccm.iface( 'currency.manage' );

            as.forEach( body, ( as, code, info ) =>
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
        const src_url = 'https://api.coingecko.com/api/v3/coins/list';
        as.add(
            ( as ) => install_request( as, src_url ),
            ( as, err ) => {
                as.success( { body: require( './fallback_currencies_crypto' ) } );
            }
        );
        as.add( ( as, { body } ) => {
            const currmng = ccm.iface( 'currency.manage' );

            as.forEach( body, ( as, _, info ) =>
                as.add(
                    ( as ) => currmng.setCurrency(
                        as,
                        `C:${info.symbol}`,
                        18, // TODO
                        info.name,
                        `C:${info.symbol}`,
                        true
                    ),
                    ( as, err ) => {
                        if ( err === 'InvokerError' ) {
                            console.log( `Skipping ${info.name}` );
                            as.success();
                        }
                    }
                )
            );
        } );
    }

    KRPS( as, _ccm ) {
    }
};
