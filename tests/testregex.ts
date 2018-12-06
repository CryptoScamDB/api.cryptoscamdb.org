import * as reg from '../src/utils/testCoinType';

const addresses = [
    '0x742d35cc6634c0532925a3b844bc454e4438f44e',
    '0x9f5304DA62A5408416Ea58A17a92611019bD5ce3',
    '1DEP8i3QJCsomS4BSMY2RpU1upv62aGvhD',
    'LNT6qmyVbd7w3VCTXwvLrN6zTz5bmsWnkX',
    '15h6MrWynwLTwhhYWNjw1RqCrhvKv3ZBsi'
];
const test = () => {
    addresses.forEach(async address => {
        //console.log(address);
        try {
            const data = await reg.testCoinType(address);
            console.log(data);
        } catch (e) {
            console.log(e);
        }
    });
};
test();
