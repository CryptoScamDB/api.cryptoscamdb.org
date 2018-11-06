import config from './config';
import { flatten } from 'flat';
import { accountLookup } from './lookup';

export const balanceLookup = async (address: string, ticker: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const entryIndex = config.coins.findIndex(entry => entry.ticker === ticker.toLowerCase());
        const returned = flatten(
            await accountLookup(
                address,
                config.coins[entryIndex].addressLookUp,
                config.coins[entryIndex].addressEndpoint
            )
        );
        if (returned.success === false) {
            reject(0);
        } else {
            const end = 'body.' + config.coins[entryIndex].addressEndpoint;
            const ethBalance = returned[end];
            if (ethBalance === undefined) {
                resolve({ balance: -1 });
            } else {
                resolve({ balance: ethBalance });
            }
        }
    });
};
