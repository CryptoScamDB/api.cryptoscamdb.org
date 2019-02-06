import 'mocha';
import { expect } from 'chai';
import * as ens from '../src/utils/ensResolve';

describe('ens', () => {
    it('should correctly resolve michaelhahn.eth', async () => {
        const result = await ens.resolve('michaelhahn.eth');
        expect(result).to.equal('0x4d1f9d958afa2e96dab3f3ce7162b87daea39017');
    })
        .slow(2000)
        .timeout(25000);
});
