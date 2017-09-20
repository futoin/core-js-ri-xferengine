'use strict';

const BaseFace = require( '../BaseFace' );

/**
 * Limits Face
 */
class LimitsFace extends BaseFace
{
    static get IFACE_NAME()
    {
        return 'futoin.xfer.limits';
    }
}

module.exports = LimitsFace;
