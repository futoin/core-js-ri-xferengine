'use strict';

require( './prepare' );

const expect = require( 'chai' ).expect;

describe( 'AmountTools', function() {
    const AmountTools = require( '../AmountTools' );

    it( 'should trim zeros', function() {
        expect( AmountTools.trimZeros( '123' ) ).to.equal( '123' );
        expect( AmountTools.trimZeros( '100' ) ).to.equal( '100' );
        expect( AmountTools.trimZeros( '100.' ) ).to.equal( '100' );
        expect( AmountTools.trimZeros( '100.00' ) ).to.equal( '100' );
        expect( AmountTools.trimZeros( '100.01232000' ) ).to.equal( '100.01232' );
    } );

    it( 'should unpack from storage', function() {
        expect( AmountTools.fromStorage( '12345678', 0 ) ).to.equal( '12345678' );
        expect( AmountTools.fromStorage( '12345678', 1 ) ).to.equal( '1234567.8' );
        expect( AmountTools.fromStorage( '12345678', 2 ) ).to.equal( '123456.78' );
        expect( AmountTools.fromStorage( '12345678', 5 ) ).to.equal( '123.45678' );
        expect( AmountTools.fromStorage( '12345678', 8 ) ).to.equal( '0.12345678' );
    } );

    it( 'should pack to storage', function() {
        expect( AmountTools.toStorage( '12345678', 0 ) ).to.equal( '12345678' );
        expect( AmountTools.toStorage( '1234567.8', 1 ) ).to.equal( '12345678' );
        expect( AmountTools.toStorage( '123456.78', 2 ) ).to.equal( '12345678' );
        expect( AmountTools.toStorage( '123.45678', 5 ) ).to.equal( '12345678' );
        expect( AmountTools.toStorage( '0.12345678', 8 ) ).to.equal( '12345678' );
        expect( AmountTools.toStorage( '12345678', 8 ) ).to.equal( '1234567800000000' );

        // TODO: revise
        expect( AmountTools.toStorage( '123456.75', 1 ) ).to.equal( '1234567' );
        expect( AmountTools.toStorage( '123456.74', 1 ) ).to.equal( '1234567' );
    } );

    it( 'should set buy/sell rates', function() {
        expect( AmountTools.sellRate( '123456.75', '0.11' ) ).to.equal( '123456.64' );
        expect( AmountTools.sellRate( '123456.75', '0.1123' ) ).to.equal( '123456.6377' );
        expect( AmountTools.buyRate( '123456.75', '0.11' ) ).to.equal( '123456.86' );
        expect( AmountTools.buyRate( '123456.75', '0.1123' ) ).to.equal( '123456.8623' );
    } );

    it( 'should convert amounts', function() {
        expect( AmountTools.convAmount( '1.00', '1.00', 1 ) ).to.equal( '1.0' );
        expect( AmountTools.convAmount( '1.00', '1.00', 2 ) ).to.equal( '1.00' );
        expect( AmountTools.convAmount( '1.50', '1.50', 2 ) ).to.equal( '2.25' );
        expect( AmountTools.convAmount( '12345.67', '12.3456789', 2, true ) ).to.equal( '152415.68' );
        expect( AmountTools.convAmount( '12345.67', '12.3456789', 2, false ) ).to.equal( '152415.67' );

        expect( AmountTools.convAmount( '1.50', '1.50', 1, true ) ).to.equal( '2.3' );
        expect( AmountTools.convAmount( '1.50', '1.50', 1, false ) ).to.equal( '2.2' );
        expect( AmountTools.convAmount( '1.50', '0.15', 2, true ) ).to.equal( '0.23' );
        expect( AmountTools.convAmount( '1.50', '0.15', 2, false ) ).to.equal( '0.22' );
    } );

    it( 'should set add/subtract amounts', function() {
        expect( AmountTools.subtract( '123456.75', '0.11', 2 ) ).to.equal( '123456.64' );
        expect( AmountTools.subtract( '123456.75', '0.1123', 4 ) ).to.equal( '123456.6377' );
        expect( AmountTools.add( '123456.75', '0.11', 2 ) ).to.equal( '123456.86' );
        expect( AmountTools.add( '123456.75', '0.1123', 4 ) ).to.equal( '123456.8623' );
    } );

    it( 'should find & convert amount fields', function() {
        expect( AmountTools.convAllAmounts( {
            some_value : '123',
            sdadsds_cnd : 234,
            sdsdsds_amt : '1.3',
            sdsdsdsa_amt : '1.32',
        }, '1.23', 3, true ) ).to.eql( {
            some_value : '123',
            sdadsds_cnd : 234,
            sdsdsds_amt : '1.599',
            sdsdsdsa_amt : '1.624',
        } );

        expect( AmountTools.convAllAmounts( {
            some_value : '123',
            sdadsds_cnd : 234,
            sdsdsds_amt : '1.3',
            sdsdsdsa_amt : '1.32',
        }, '1.23', 3, false ) ).to.eql( {
            some_value : '123',
            sdadsds_cnd : 234,
            sdsdsds_amt : '1.599',
            sdsdsdsa_amt : '1.623',
        } );
    } );

    it( 'should convert backrates', function() {
        expect( AmountTools.backRate( '1.00' ) ).to.equal( '1' );
        expect( AmountTools.backRate( '1.23' ) ).to.equal( '0.813008130081' );
        expect( AmountTools.backRate( '0.777' ) ).to.equal( '1.287001287001' );

        expect( AmountTools.backMargin( '2', '40' ) ).to.equal( '0.00125' );
    } );

    it( 'should prepare stats', function() {
        expect( AmountTools.prepNewStats( {
            only_in_stats1_amt : '12.34',
            only_in_stats2_amt : '23.45',
            both1_amt : '2.34',
            both2_amt : '3.45',
            only_in_stats1_cnt : 1,
            only_in_stats2_cnt : 2,
            both1_cnt : 3,
            both2_cnt : 4,
        }, {
            both1_amt : '1.01',
            both2_amt : '2.02',
            only_in_delta1_amt : '12.34',
            only_in_delta2_amt : '23.45',
            both1_cnt : 10,
            both2_cnt : 20,
            only_in_delta1_cnt : 30,
            only_in_delta2_cnt : 40,
        } ) ).to.eql( {
            both1_amt : '3.35',
            both2_amt : '5.47',
            only_in_delta1_amt : '12.34',
            only_in_delta2_amt : '23.45',
            both1_cnt : 13,
            both2_cnt : 24,
            only_in_delta1_cnt : 30,
            only_in_delta2_cnt : 40,
        } );
    } );

    it( 'should checks stats against limits', function() {
        expect( AmountTools.checkStatsLimit( {
            only_in_stats1_amt : '12.34',
            only_in_stats2_amt : '23.45',
            both1_amt : '0.99',
            both2_amt : '3.45',
            only_in_stats1_cnt : 1,
            only_in_stats2_cnt : 2,
            both1_cnt : 1,
            both2_cnt : 4,
        }, {
            both1_amt : '1.01',
            both2_amt : '3.45',
            only_in_limits1_amt : '12.34',
            only_in_limits2_amt : '23.45',
            both1_cnt : 3,
            both2_cnt : 4,
            only_in_limits1_cnt : 30,
            only_in_limits2_cnt : 40,
        } ) ).to.equal( true );

        expect( AmountTools.checkStatsLimit( {
            only_in_stats1_amt : '12.34',
            only_in_stats2_amt : '23.45',
            both1_amt : '0.99',
            both2_amt : '3.45',
            only_in_stats1_cnt : 1,
            only_in_stats2_cnt : 2,
            both1_cnt : 4,
            both2_cnt : 4,
        }, {
            both1_amt : '1.01',
            both2_amt : '3.45',
            only_in_limits1_amt : '12.34',
            only_in_limits2_amt : '23.45',
            both1_cnt : 3,
            both2_cnt : 4,
            only_in_limits1_cnt : 30,
            only_in_limits2_cnt : 40,
        } ) ).to.equal( false );

        expect( AmountTools.checkStatsLimit( {
            only_in_stats1_amt : '12.34',
            only_in_stats2_amt : '23.45',
            both1_amt : '1.02',
            both2_amt : '3.45',
            only_in_stats1_cnt : 1,
            only_in_stats2_cnt : 2,
            both1_cnt : 1,
            both2_cnt : 4,
        }, {
            both1_amt : '1.01',
            both2_amt : '3.45',
            only_in_limits1_amt : '12.34',
            only_in_limits2_amt : '23.45',
            both1_cnt : 3,
            both2_cnt : 4,
            only_in_limits1_cnt : 30,
            only_in_limits2_cnt : 40,
        } ) ).to.equal( false );
    } );

    it( 'should check min limit', function() {
        expect( AmountTools.checkStatsLimit( {
            check_min_amt : '12.34',
        }, {
            check_min_amt : '1.01',
        } ) ).to.equal( true );

        expect( AmountTools.checkStatsLimit( {
            check_min_amt : '1.01',
        }, {
            check_min_amt : '1.01',
        } ) ).to.equal( true );

        expect( AmountTools.checkStatsLimit( {
            check_min_amt : '1.00',
        }, {
            check_min_amt : '1.01',
        } ) ).to.equal( false );

        expect( AmountTools.checkStatsLimit( {
            check_min_amt : '0.99',
        }, {
            check_min_amt : '1.01',
        } ) ).to.equal( false );
    } );

    it( 'should check xfer amount', function() {
        expect( AmountTools.checkXferAmount(
            '0', { balance: '10', reserved: '5', overdraft: '20' } )
        ).to.equal( false );
        expect( AmountTools.checkXferAmount(
            '1', { balance: '10', reserved: '5', overdraft: '20' } )
        ).to.equal( true );
        expect( AmountTools.checkXferAmount(
            '25', { balance: '10', reserved: '5', overdraft: '20' } )
        ).to.equal( true );
        expect( AmountTools.checkXferAmount(
            '25.10', { balance: '10', reserved: '5', overdraft: '20.10' } )
        ).to.equal( true );

        expect( AmountTools.checkXferAmount(
            '26', { balance: '10', reserved: '5', overdraft: '20' } )
        ).to.equal( false );

        expect( AmountTools.checkXferAmount(
            '26.10', { balance: '10.10', reserved: '5', overdraft: '20' } )
        ).to.equal( false );

        expect( AmountTools.checkXferAmount(
            '5', { balance: '-10', reserved: '5', overdraft: '20' } )
        ).to.equal( true );
        expect( AmountTools.checkXferAmount(
            '5.01', { balance: '-10', reserved: '5', overdraft: '20' } )
        ).to.equal( false );
    } );

    it( 'should compare amount', function() {
        expect( AmountTools.isEqual( '1.00', '1.00' ) ).to.be.true;
        expect( AmountTools.isEqual( '1.00', '1' ) ).to.be.true;
        expect( AmountTools.isEqual( '21.10', '21.100' ) ).to.be.true;
        expect( AmountTools.isEqual( '21.10', '21.101' ) ).to.be.false;
        expect( AmountTools.compare( '21.10', '21.101' ) ).to.be.below( 0 );
        expect( AmountTools.compare( '21.101', '21.10' ) ).to.be.above( 0 );
        expect( AmountTools.compare( '3.101', '21.10' ) ).to.be.below( 0 );
        expect( AmountTools.isZero( '0' ) ).to.be.true;
        expect( AmountTools.isZero( '0.00' ) ).to.be.true;
        expect( AmountTools.isZero( '0.01' ) ).to.be.false;
        expect( AmountTools.isZero( '30.00' ) ).to.be.false;

        expect( AmountTools.isLess( '10', '10' ) ).to.be.false;
        expect( AmountTools.isLess( '2', '10' ) ).to.be.true;
        expect( AmountTools.isLess( '100', '10' ) ).to.be.false;

        expect( AmountTools.isLessOrEqual( '10', '10' ) ).to.be.true;
        expect( AmountTools.isLessOrEqual( '2', '10' ) ).to.be.true;
        expect( AmountTools.isLessOrEqual( '100', '10' ) ).to.be.false;

        expect( AmountTools.isGreater( '10', '10' ) ).to.be.false;
        expect( AmountTools.isGreater( '2', '10' ) ).to.be.false;
        expect( AmountTools.isGreater( '100', '10' ) ).to.be.true;

        expect( AmountTools.isGreaterOrEqual( '10', '10' ) ).to.be.true;
        expect( AmountTools.isGreaterOrEqual( '2', '10' ) ).to.be.false;
        expect( AmountTools.isGreaterOrEqual( '100', '10' ) ).to.be.true;
    } );

    it( 'should process misc', function() {
        expect( AmountTools.MAX_DIGITS ).to.equal( 22 );
        expect( AmountTools.RATE_PRECISSION ).to.equal( 12 );
    } );

    it( 'should distribute win', function() {
        expect( AmountTools.distributeWin( { a: '1' }, '3.33', 2 ) ).to.eql( { a: '3.33' } );
        expect( AmountTools.distributeWin( { a: '1', b: '1', c: '1' }, '3.33', 2 ) )
            .to.eql( { a: '1.11', b: '1.11', c: '1.11' } );
        expect( AmountTools.distributeWin( { a: '11', b: '22' }, '3.33', 2 ) )
            .to.eql( { a: '1.11', b: '2.22' } );
    } );
} );
