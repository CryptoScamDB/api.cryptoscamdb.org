import 'mocha';
import { expect } from 'chai';
import * as db from '../src/utils/db';
import * as reg from '../src/utils/testCoinType';

describe('regex', function() {
    this.timeout(60000);
    before(async () => {
        await db.init();
    });

    it('should correctly parse ETH addresses', async () => {
        const result = await reg.testCoinType('0x742d35cc6634c0532925a3b844bc454e4438f44e');
        expect(result.ticker).to.equal('ETH');
    })
        .slow(2000)
        .timeout(25000);

    // it('should correctly parse ETC addresses', async () => {
    //     const result = await reg.testCoinType('0x9f5304DA62A5408416Ea58A17a92611019bD5ce3');
    //     expect(result.ticker).to.equal('ETC');
    // })
    //     .slow(2000)
    //     .timeout(25000);

    it('should correctly parse BTC addresses', async () => {
        const result = await reg.testCoinType('1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD');
        expect(result.ticker).to.equal('BTC');
    })
        .slow(2000)
        .timeout(25000);

    it('should correctly parse LTC addresses', async () => {
        const result = await reg.testCoinType('LNT6qmyVbd7w3VCTXwvLrN6zTz5bmsWnkX');
        expect(result.ticker).to.equal('LTC');
    })
        .slow(2000)
        .timeout(25000);

    it('should correctly parse BCH addresses', async () => {
        const result = await reg.testCoinType('15h6MrWynwLTwhhYWNjw1RqCrhvKv3ZBsi');
        expect(result.ticker).to.equal('BCH');
    })
        .slow(2000)
        .timeout(25000);
});
