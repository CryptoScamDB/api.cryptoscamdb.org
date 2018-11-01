import config from '../src/utils/config';
import * as ensResolve from '../src/utils/ensResolve';

const provider = config.lookups.ENS.provider;
const input = 'michaelhahn.eth';

const startTest = async (input, provider) => {
    try {
        let addr = await ensResolve(input, provider);
        console.log('Address: ' + addr);
    } catch (e) {
        console.log(e);
    }
};

startTest(input, provider);
