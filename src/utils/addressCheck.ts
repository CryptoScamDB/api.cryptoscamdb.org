import * as db from './db';
import * as Debug from 'debug';
import Entry from '../models/entry';

const debug = Debug('router-utils');

interface JsonRet {
    success: boolean;
    result: string;
    type: string;
    chain: string;
    entries?: Entry;
    input?: string;
    address?: string;
    validRoot?: boolean;
}

export default (params: string, chain: string): JsonRet => {
    debug('Starting addressCheck - ' + params + ' - ' + chain);
    const whitelistAddress = Object.keys(db.read().index.whitelistAddresses).find(
        address => params.toLowerCase() === address.toLowerCase()
    );
    const blacklistAddress = Object.keys(db.read().index.addresses).find(
        address => params.toLowerCase() === address.toLowerCase()
    );
    if (whitelistAddress) {
        return {
            success: true,
            result: 'whitelisted',
            type: 'address',
            chain,
            entries: db.read().index.whitelistAddresses[whitelistAddress]
        };
    } else if (blacklistAddress) {
        return {
            success: true,
            result: 'blocked',
            type: 'address',
            chain,
            entries: db.read().index.addresses[blacklistAddress]
        };
    } else {
        return {
            success: true,
            result: 'neutral',
            type: 'address',
            chain
        };
    }
};
