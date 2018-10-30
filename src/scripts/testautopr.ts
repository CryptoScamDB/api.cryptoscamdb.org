import config from '../utils/config';
import * as autoPR from '../utils/autoPR';

const githubKey = config.apiKeys.Github_AccessKey;
const input = {
    type: 'ADD',
    data: {
        url: 'http://promocrypt.com/',
        name: 'promocrypt.com',
        category: 'Scamming',
        subcategory: 'Trust-trading',
        description: 'Trust-trading scam site.',
        addresses: ['0xAc73CE5F0756C908dAFfEA721B65D887C1814E21'],
        coin: 'eth',
        reporter: 'MyCrypto'
    }
};

const startTest = async (input, githubKey) => {
    const pr = autoPR.autoPR(input, githubKey);
};

startTest(input, githubKey);
