import * as sqlite3 from 'sqlite3';
import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as url from 'url';
import * as path from 'path';
import config from './config';
import Scam from '../classes/scam.class';
import * as Debug from 'debug';
import Entry from '../models/entry';
import EntryWrapper from '../models/entrywrapper';
import Coins from '../models/coins';
import { priceLookup } from './lookup';
import * as autoPR from './autoPR';
import { utils } from 'web3';

const debug = Debug('db');
const db = new sqlite3.Database('./data/cache.db');

export const init = async (): Promise<void> => {
    await this.run(
        'CREATE TABLE IF NOT EXISTS entries (id TEXT, name TEXT, type TEXT, url TEXT, hostname TEXT, featured INTEGER, path TEXT, category TEXT, subcategory TEXT, description TEXT, reporter TEXT, coin TEXT, ip TEXT, severity INTEGER, statusCode INTEGER, status TEXT, updated INTEGER, PRIMARY KEY(id))'
    );
    await this.run(
        'CREATE TABLE IF NOT EXISTS addresses (address TEXT, entry INTEGER, PRIMARY KEY(address,entry))'
    );
    await this.run(
        'CREATE TABLE IF NOT EXISTS prices (ticker TEXT, price INTEGER, PRIMARY KEY(ticker))'
    );
    await this.run('CREATE TABLE IF NOT EXISTS reported (url TEXT, PRIMARY KEY(url))');
    await readEntries();
    await priceUpdate();
    if (config.interval.priceLookup > 0) {
        setInterval(priceUpdate, config.interval.priceLookup);
    }
};

export const get = (query, data = []) => {
    return new Promise((resolve, reject) => {
        debug('GET %s %o', query, data);
        db.get(query, data, function(error, row) {
            if (error) {
                debug('ERROR %s %o', query, data);
                reject(error);
            } else {
                resolve(row);
            }
        });
    });
};

export const all = (query, data = []) => {
    return new Promise((resolve, reject) => {
        debug('ALL %s %o', query, data);
        db.all(query, data, function(error, rows) {
            if (error) {
                debug('ERROR %s %o', query, data);
                reject(error);
            } else {
                resolve(rows);
            }
        });
    });
};

export const run = (query, data = []) => {
    return new Promise((resolve, reject) => {
        debug('RUN %s %o', query, data);
        db.run(query, data, function(error) {
            if (error) {
                debug('ERROR %s %o', query, data);
                reject(error);
            } else {
                resolve(this.changes);
            }
        });
    });
};

/* Read entries from yaml files and load them into DB object */
export const readEntries = async (): Promise<void> => {
    debug('Reading entries...');
    const scamsFile = await fs.readFile('./data/blacklist_urls.yaml', 'utf8');
    const verifiedFile = await fs.readFile('./data/whitelist_urls.yaml', 'utf8');
    const scams = yaml.safeLoad(scamsFile).map(entry => new Scam(entry));
    const verified = yaml.safeLoad(verifiedFile);
    await Promise.all(
        scams.map(async entry => {
            const entryExists = await get('SELECT * FROM entries WHERE id=?', [entry.getID()]);
            if (!entryExists) {
                await run(
                    "INSERT OR IGNORE INTO entries VALUES (?,?,'scam',?,?,0,?,?,?,?,?,?,null,?,null,null,0)",
                    [
                        entry.getID(),
                        entry.getHostname(),
                        entry.url,
                        entry.getHostname(),
                        entry.path,
                        entry.category,
                        entry.subcategory,
                        entry.description,
                        entry.reporter,
                        entry.coin,
                        entry.severity
                    ]
                );
                await Promise.all(
                    (entry.addresses || []).map(address =>
                        run('INSERT OR IGNORE INTO addresses VALUES (?,?)', [
                            address,
                            entry.getID()
                        ])
                    )
                );
            } else {
                await run(
                    'UPDATE entries SET path=?,category=?,subcategory=?,description=?,reporter=?,coin=?,severity=? WHERE id=?',
                    [
                        entry.path,
                        entry.category,
                        entry.subcategory,
                        entry.description,
                        entry.reporter,
                        entry.coin,
                        entry.severity,
                        entry.getID()
                    ]
                );
            }
        })
    );
    await Promise.all(
        verified.map(async entry => {
            const id = utils.sha3(entry.url).substring(2, 8);
            const entryExists = await get('SELECT * FROM entries WHERE id=?', [id]);
            if (!entryExists) {
                await run(
                    "INSERT OR IGNORE INTO entries VALUES (?,?,'verified',?,?,?,null,null,null,?,null,null,null,null,null,null,null)",
                    [
                        id,
                        entry.name,
                        entry.url,
                        url.parse(entry.url).hostname,
                        entry.featured,
                        entry.description
                    ]
                );
                await Promise.all(
                    (entry.addresses || []).map(address =>
                        run('INSERT OR IGNORE INTO addresses VALUES (?,?)', [address, id])
                    )
                );
            } else {
                await run('UPDATE entries SET name=?,description=? WHERE id=?', [
                    entry.name,
                    entry.description,
                    id
                ]);
            }
        })
    );
};

export const priceUpdate = async (): Promise<void> => {
    debug('Updating price...');
    config.coins.forEach(async each => {
        const ret = await priceLookup(each.priceSource, each.priceEndpoint);
        const priceUSD = await JSON.parse(JSON.stringify(ret)).USD;
        debug(each.ticker + ' price in usd: ' + JSON.stringify(priceUSD));
        await run('INSERT OR REPLACE INTO prices VALUES (?,?)', [each.ticker, priceUSD]);
    });
};

export const createPR = async (): Promise<void> => {
    const reported: any = await all('SELECT * FROM reported');
    if (reported.length > 0) {
        debug(reported.length + ' entries found in report cache.');
        reported.forEach(async entry => {
            try {
                debug('Trying to remove entry from report cache');
                const successStatus = await autoPR.autoPR(entry, config.apiKeys.Github_AccessKey);
                if (successStatus.success) {
                    if (successStatus.url) {
                        // Success
                        run('DELETE from reported WHERE url=?', [entry.url]);
                        debug('Url entry removed from report cache.');
                    } else {
                        // Success
                        run('DELETE from reported WHERE url=?', [entry.url]);
                        debug('Entry removed from report cache.');
                    }
                } else {
                    // Failure
                    debug('Entry could not be removed from report cache.');
                }
            } catch (e) {
                // Failure
                debug('Github server err in removing entry from report cache: ' + e);
            }
        });
    }
};

export const addReport = async (entry: EntryWrapper) => {
    // Adding new entry to the reported section.
    try {
        await run('INSERT OR IGNORE INTO reported VALUES (?)', [entry]);
    } catch (e) {
        return { success: false, error: e };
    }

    if (entry.data.url) {
        return { success: true, url: entry.data.url, newEntry: entry };
    } else {
        return { success: true, newEntry: entry };
    }
};

export const checkReport = async (entry: EntryWrapper): Promise<boolean> => {
    const reported = await get('SELECT * FROM reported WHERE url=?', [entry]);
    if (reported) {
        debug('Input entry ' + JSON.stringify(entry, null, 2) + ' matches ');
        return true;
    } else {
        debug('Input entry not found in reported');
        return false;
    }
};

export const checkDuplicate = async (entry: Entry): Promise<any> => {
    if (entry.addresses) {
        entry.addresses.forEach(async address => {
            const dbEntry: any = await get('SELECT * FROM addresses WHERE address=?', [address]);
            if (dbEntry && dbEntry.type == 'scam') {
                return { duplicate: true, type: 'Blacklisted address already exists.' };
            }
            if (dbEntry && dbEntry.type == 'verified') {
                return { duplicate: true, type: 'Whitelisted address already exists.' };
            }
        });
    }

    if (entry.url || entry.name) {
        if (entry.url) {
            const dbEntry: any = await get('SELECT * FROM entries WHERE url=?', [entry.url]);
            if (dbEntry && dbEntry.type == 'scam') {
                return { duplicate: true, type: 'Blacklisted url already exists.' };
            }
            if (dbEntry && dbEntry.type == 'verified') {
                return { duplicate: true, type: 'Whitelisted url already exists.' };
            }
        }

        if (entry.name) {
            const dbEntry: any = await get('SELECT * FROM entries WHERE name=?', [entry.name]);
            if (dbEntry && dbEntry.type == 'scam') {
                return { duplicate: true, type: 'Blacklisted name already exists.' };
            }
            if (dbEntry && dbEntry.type == 'verified') {
                return { duplicate: true, type: 'Whitelisted name already exists.' };
            }
        }
        return { duplicate: false, type: 'Valid entry.' };
    }
    return { duplicate: false, type: 'Valid entry.' };
};
