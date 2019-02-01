import config from '../src/utils/config';
import * as autoPR from '../src/utils/autoPR';

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
    try {
        await autoPR.autoPR(input, githubKey);
    } catch (e) {
        console.log('Error: ' + e);
    }
};

startTest(input, githubKey);
