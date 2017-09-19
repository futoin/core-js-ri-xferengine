'use strict';

class AmountTools
{
    static trimZeros( amt )
    {
        return amt.replace( /0+$/, '' );
    }
}

module.exports = AmountTools;
