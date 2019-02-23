import * as db from './db';
import * as Debug from 'debug';
import Entry from '../models/entry';
import { STATUS_CODES } from 'http';

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
    const address: any = await db.all('SELECT * FROM addresses WHERE address=?', params);
    if (address.length > 0) {
        const status: any = await db.get('SELECT * FROM entries WHERE id=?', address[0].entry);
        const outputEntries = [];
        await Promise.all(
            await address.map(async entry => {
                const data = await db.get('SELECT * FROM entries WHERE id=?', entry.entry);
                if (data) {
                    outputEntries.push(data);
                }
            })
        );
        if (address && status.type === 'verified') {
            return {
                status: 'whitelisted',
                type: 'address',
                coin,
                entries: outputEntries
            };
        } else if (address && status.type === 'scam') {
            return {
                status: 'blocked',
                type: 'address',
                coin,
                entries: outputEntries
            };
        } else {
            return {
                status: 'neutral',
                type: 'address',
                coin,
                entries: outputEntries
            };
        }
    } else {
        return {
            status: 'neutral',
            type: 'address',
            coin,
            entries: []
        };
    }
};
