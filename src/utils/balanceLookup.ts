import config from './config';
import { flatten } from 'flat';
import { accountLookup } from './lookup';
import coins from './endpoints';

export const balanceLookup = async (address: string, ticker: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const coin = coins.find(entry => entry.ticker === ticker.toUpperCase());
        const returned = flatten(
            await accountLookup(address, coin.addressLookUp, coin.addressEndpoint)
        );
        if (returned.success === false || returned.status === false) {
            resolve({ balance: -1 });
        } else {
            const end = 'body.' + coin.addressEndpoint;
            const ethBalance = returned[end];
            if (ethBalance === undefined) {
                resolve({ balance: -1 });
            } else {
                resolve({ balance: ethBalance });
            }
        }
    });
};
