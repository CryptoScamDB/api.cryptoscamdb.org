import coins from './endpoints';
import * as db from './db';
import { balanceLookup } from './balanceLookup';
import * as Debug from 'debug';
const debug = Debug('cointest');

export const testCoinType = async (address: string): Promise<any> => {
    const cryptos = {};
    const prices: any = await db.all('SELECT * FROM prices');
    (prices || []).forEach(coin => {
        cryptos[coin.ticker] = coin.price;
    });
    const out = [];
    coins.forEach(entry => {
        const regex = new RegExp(entry.regex, 'g');
        if (regex.test(address)) {
            out.push(entry);
        }
    });
    if (out.length > 1) {
        // There are 2+ entries that matched regex - ETH/ETC or BTC/BCH
        await Promise.all(
            out.map(async entry => {
                const balance = await balanceLookup(address, entry.ticker);
                if (balance.balance === -1 || balance.balance === null) {
                    balance.balance = 0;
                }
                entry.balance = balance.balance * Math.pow(10, Math.round(-1 * entry.decimal));
                entry.price = cryptos[entry.ticker];
                entry.value = entry.price * entry.balance;
            })
        );
        const maxValue = Math.max(...out.map(entry => entry.value)); // Finds the max value
        if (maxValue === 0) {
            // Resolves with the coin object with the max value if there is a max. If they're the same and 0 value each, resolve with first in list.
            return out[0];
        } else {
            return out.find(item => item.value === maxValue);
        }
    } else if (out.length === 1) {
        return out[0];
    } else {
        throw new Error('Too many values?');
    }
};
