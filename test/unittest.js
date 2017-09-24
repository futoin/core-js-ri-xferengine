
const expect = require('chai').expect;

describe('AmountTools', function() {
    const AmountTools = require('../AmountTools');
    
    it('should trim zeros', function() {
        expect(AmountTools.trimZeros('123')).to.equal('123');
        expect(AmountTools.trimZeros('100')).to.equal('100');
        expect(AmountTools.trimZeros('100.')).to.equal('100.');
        expect(AmountTools.trimZeros('100.00')).to.equal('100.');
        expect(AmountTools.trimZeros('100.01232000')).to.equal('100.01232');
    });
    
    it('should unpack from storage', function() {
        expect(AmountTools.fromStorage('12345678', 0)).to.equal('12345678');
        expect(AmountTools.fromStorage('12345678', 1)).to.equal('1234567.8');
        expect(AmountTools.fromStorage('12345678', 2)).to.equal('123456.78');
        expect(AmountTools.fromStorage('12345678', 5)).to.equal('123.45678');
        expect(AmountTools.fromStorage('12345678', 8)).to.equal('0.12345678');
    });
    
    it('should pack to storage', function() {
        expect(AmountTools.toStorage('12345678', 0)).to.equal('12345678');
        expect(AmountTools.toStorage('1234567.8', 1)).to.equal('12345678');
        expect(AmountTools.toStorage('123456.78', 2)).to.equal('12345678');
        expect(AmountTools.toStorage('123.45678', 5)).to.equal('12345678');
        expect(AmountTools.toStorage('0.12345678', 8)).to.equal('12345678');
        expect(AmountTools.toStorage('12345678', 8)).to.equal('1234567800000000');
        
        // TODO: revise
        expect(AmountTools.toStorage('123456.75', 1)).to.equal('1234568');
        expect(AmountTools.toStorage('123456.74', 1)).to.equal('1234567');
    });
    
    it('should set buy/sell rates', function() {
        expect(AmountTools.sellRate('123456.75', '0.11')).to.equal('123456.64');
        expect(AmountTools.sellRate('123456.75', '0.1123')).to.equal('123456.6377');
        expect(AmountTools.buyRate('123456.75', '0.11')).to.equal('123456.86');
        expect(AmountTools.buyRate('123456.75', '0.1123')).to.equal('123456.8623');
    });
    
    it('should convert amounts', function() {
        expect(AmountTools.convAmount('1.00', '1.00', 1)).to.equal('1.0');
        expect(AmountTools.convAmount('1.00', '1.00', 2)).to.equal('1.00');
        expect(AmountTools.convAmount('1.50', '1.50', 2)).to.equal('2.25');
        expect(AmountTools.convAmount('12345.67', '12.3456789', 2)).to.equal('152415.68');
        
        // TODO: revise
        expect(AmountTools.convAmount('1.50', '1.50', 1)).to.equal('2.3');
        expect(AmountTools.convAmount('1.50', '0.15', 2)).to.equal('0.23');
        
    });
    
    it('should convert limits', function() {
        expect(AmountTools.convLimits({
            'some_value' : '123',
            'sdadsds_cnd' : 234,
            'sdsdsds_amt' : '1.3',
            'sdsdsdsa_amt' : '1.32',
        }, '1.23', 3)).to.eql({
            'some_value' : '123',
            'sdadsds_cnd' : 234,
            'sdsdsds_amt' : '1.599',
            'sdsdsdsa_amt' : '1.624',            
        });
    });
    
    it('should convert backrates', function() {
        expect(AmountTools.backRate('1.00')).to.equal('1');
        expect(AmountTools.backRate('1.23')).to.equal('0.813008130081');
        expect(AmountTools.backRate('0.777')).to.equal('1.287001287001');
    });
    
    it('should process misc', function() {
        expect(AmountTools.MAX_DIGITS).to.equal(22);
        expect(AmountTools.RATE_PRECISSION).to.equal(12);
    });
});
