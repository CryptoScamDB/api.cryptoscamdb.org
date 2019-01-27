import * as db from './db';
import * as Debug from 'debug';
import Entry from '../models/entry';

const debug = Debug('router-utils');

interface JsonRet {
    success?: boolean;
    status: string;
    type: string;
    coin: string;
    entries?: Entry[];
    input?: string;
    address?: string;
    validRoot?: boolean;
}

export default async (params: string, coin: string): Promise<JsonRet> => {
    debug('Starting to check DB for address - ' + params + ' - ' + coin);
    const address: any = await db.get('SELECT * FROM addresses WHERE address=?', [params]);
    if (address && address.type === 'verified') {
        return {
            status: 'whitelisted',
            type: 'address',
            coin,
            entries: address
        };
    } else if (address && address.type === 'scam') {
        return {
            status: 'blocked',
            type: 'address',
            coin,
            entries: address
        };
    } else {
        return {
            status: 'neutral',
            type: 'address',
            coin,
            entries: []
        };
    }
};
