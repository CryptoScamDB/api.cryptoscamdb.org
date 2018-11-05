import * as db from './db';
import * as Debug from 'debug';
import Entry from '../models/entry';

const debug = Debug('router-utils');

interface JsonRet {
    success: boolean;
    status: string;
    type: string;
    coin: string;
    entries?: Entry[];
    input?: string;
    address?: string;
    validRoot?: boolean;
}

export default (params: string, coin: string): JsonRet => {
    debug('Starting to check DB for address - ' + params + ' - ' + coin);
    const whitelistAddress = Object.keys(db.read().index.whitelistAddresses).find(
        address => params.toLowerCase() === address.toLowerCase()
    );
    const blacklistAddress = Object.keys(db.read().index.addresses).find(
        address => params.toLowerCase() === address.toLowerCase()
    );
    if (whitelistAddress) {
        return {
            success: true,
            status: 'whitelisted',
            type: 'address',
            coin,
            entries: db.read().index.whitelistAddresses[whitelistAddress]
        };
    } else if (blacklistAddress) {
        return {
            success: true,
            status: 'blocked',
            type: 'address',
            coin,
            entries: db.read().index.addresses[blacklistAddress]
        };
    } else {
        return {
            success: true,
            status: 'neutral',
            type: 'address',
            coin,
            entries: []
        };
    }
};
