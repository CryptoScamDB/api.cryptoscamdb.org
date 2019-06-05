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
import { getID } from './getID';
import { pullRaw } from './github';
import * as crypto from 'crypto';
import coins, { ConfigCoin } from './endpoints';

const debug = Debug('db');
const db = new sqlite3.Database('cache.db');

export const init = async (): Promise<void> => {
    await this.run(
        'CREATE TABLE IF NOT EXISTS entries (id TEXT, name TEXT, type TEXT, url TEXT, hostname TEXT, featured INTEGER, path TEXT, category TEXT, subcategory TEXT, description TEXT, reporter TEXT, ip TEXT, severity INTEGER, statusCode INTEGER, status TEXT, updated INTEGER, PRIMARY KEY(id))'
    );
    await this.run(
        'CREATE TABLE IF NOT EXISTS addresses (address TEXT, entry TEXT, coin TEXT, PRIMARY KEY(address,entry))'
    );
    await this.run(
        'CREATE TABLE IF NOT EXISTS nameservers (nameserver TEXT, entry TEXT, PRIMARY KEY(nameserver,entry))'
    );
    await this.run(
        'CREATE TABLE IF NOT EXISTS prices (ticker TEXT, price INTEGER, PRIMARY KEY(ticker))'
    );
    await this.run('CREATE TABLE IF NOT EXISTS reported (data TEXT, PRIMARY KEY (data))');
    await this.run(
        'CREATE TABLE IF NOT EXISTS checksums (filename TEXT, hash TEXT, PRIMARY KEY(filename))'
    );
    await pullRaw();
    await readEntries();
    await priceUpdate();
};

export const get = (query, data?) => {
    return new Promise((resolve, reject) => {
        debug('GET %s %o', query, data);
        db.get(query, data, (error, row) => {
            if (error) {
                debug('ERROR %s %o', query, data);
                reject(error);
            } else {
                resolve(row);
            }
        });
    });
};

export const all = (query, data?) => {
    return new Promise((resolve, reject) => {
        debug('ALL %s %o', query, data);
        db.all(query, data, (error, rows) => {
            if (error) {
                debug('ERROR %s %o', query, data);
                reject(error);
            } else {
                resolve(rows);
            }
        });
    });
};

export const run = (query, data?) => {
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
    /* Add blacklist_urls to cache.cb */
    const scamsFile = await fs.readFile('./data/blacklist_urls.yaml', 'utf8');
    const scamsChecksum = crypto
        .createHash('sha256')
        .update(scamsFile)
        .digest('hex');
    const oldScamsChecksum: any = await get(
        "SELECT hash from checksums WHERE filename='blacklist_urls.yaml'"
    );
    if (
        !oldScamsChecksum ||
        !('hash' in oldScamsChecksum) ||
        oldScamsChecksum.hash !== scamsChecksum
    ) {
        const scams = yaml.safeLoad(scamsFile).map(entry => new Scam(entry));
        await run('BEGIN TRANSACTION');
        await Promise.all(
            scams.map(async entry => {
                await run(
                    "INSERT INTO entries(id,name,type,url,hostname,featured,path,category,subcategory,description,reporter,severity,updated) VALUES ($id,$name,'scam',$url,$hostname,0,$path,$category,$subcategory,$description,$reporter,$severity,0) ON CONFLICT(id) DO UPDATE SET path=$path,category=$category,subcategory=$subcategory,description=$description,reporter=$reporter,severity=$severity WHERE id=$id",
                    {
                        $id: entry.getID(),
                        $name: entry.getHostname(),
                        $url: entry.url,
                        $hostname: entry.getHostname(),
                        $path: entry.path,
                        $category: entry.category,
                        $subcategory: entry.subcategory,
                        $description: entry.description,
                        $reporter: entry.reporter,
                        $severity: entry.severity
                    }
                );
                const addresses: any = await all('SELECT * FROM addresses WHERE entry=?', [
                    entry.getID()
                ]);
                await Promise.all(
                    addresses.map(async address => {
                        if (!(address.address in (entry.addresses || []))) {
                            await run('DELETE FROM addresses WHERE address=? AND entry=?', [
                                address.address,
                                entry.getID()
                            ]);
                        }
                    })
                );
                if (typeof entry.addresses !== 'undefined' && entry.addresses.length) {
                    await Promise.all(
                        (entry.addresses || []).map(async address => {
                            await run(
                                'INSERT OR IGNORE INTO addresses(address, coin, entry) VALUES (?,?,?)',
                                [address, entry.coin, entry.getID()]
                            );
                        })
                    );
                }
            })
        );
        await run(
            'INSERT INTO checksums(filename,hash) VALUES ($filename,$hash) ON CONFLICT(filename) DO UPDATE SET hash=$hash WHERE filename=$filename',
            {
                $filename: 'blacklist_urls.yaml',
                $hash: scamsChecksum
            }
        );
        await run('COMMIT');
    }
    /* Add whitelist_urls to cache.cb */
    const verifiedFile = await fs.readFile('./data/whitelist_urls.yaml', 'utf8');
    const verifiedChecksum = crypto
        .createHash('sha256')
        .update(verifiedFile)
        .digest('hex');
    const oldVerifiedChecksum: any = await get(
        "SELECT hash from checksums WHERE filename='whitelist_urls.yaml'"
    );
    if (
        !oldVerifiedChecksum ||
        !('hash' in oldVerifiedChecksum) ||
        oldVerifiedChecksum.hash !== verifiedChecksum
    ) {
        const verified = yaml.safeLoad(verifiedFile);
        await run('BEGIN TRANSACTION');
        await Promise.all(
            verified.map(async entry => {
                await run(
                    "INSERT INTO entries(id,name,type,url,hostname,featured,description) VALUES ($id,$name,'verified',$url,$hostname,$featured,$description) ON CONFLICT(id) DO UPDATE SET name=$name,description=$description,featured=$featured WHERE id=$id",
                    {
                        $id: getID(entry.name),
                        $name: entry.name,
                        $url: entry.url,
                        $hostname: url.parse(entry.url).hostname,
                        $featured: entry.featured,
                        $description: entry.description
                    }
                );
                const addresses: any = await all('SELECT * FROM addresses WHERE entry=?', [
                    getID(entry.name)
                ]);
                await Promise.all(
                    addresses.map(async address => {
                        if (!(address.address in (entry.addresses || []))) {
                            await run('DELETE FROM addresses WHERE address=? AND entry=?', [
                                address.address,
                                getID(entry.name)
                            ]);
                        }
                    })
                );
                await Promise.all(
                    (entry.addresses || []).map(async address => {
                        await run(
                            'INSERT OR IGNORE INTO addresses(address, coin, entry) VALUES (?,?,?)',
                            [address, entry.coin, getID(entry.name)]
                        );
                    })
                );
            })
        );
        await run(
            'INSERT INTO checksums(filename,hash) VALUES ($filename,$hash) ON CONFLICT(filename) DO UPDATE SET hash=$hash WHERE filename=$filename',
            {
                $filename: 'whitelist_urls.yaml',
                $hash: verifiedChecksum
            }
        );
        await run('COMMIT');
    }

    /* Add etherscamdb_blacklist to cache.db */
    const etherscamdbFile = await fs.readFile('./data/etherscamdb_blacklist.yaml', 'utf8');
    const etherscamdbChecksum = crypto
        .createHash('sha256')
        .update(etherscamdbFile)
        .digest('hex');
    const oldESDBScamsChecksum: any = await get(
        "SELECT hash from checksums WHERE filename='etherscamdb_blacklist.yaml'"
    );
    if (
        !oldESDBScamsChecksum ||
        !('hash' in oldESDBScamsChecksum) ||
        oldESDBScamsChecksum.hash !== etherscamdbChecksum
    ) {
        debug('Adding ESDB scams now...');
        const etherscamdbscams = yaml.safeLoad(etherscamdbFile).map(entry => new Scam(entry));
        await run('BEGIN TRANSACTION');
        await Promise.all(
            etherscamdbscams.map(async entry => {
                await run(
                    "INSERT INTO entries(id,name,type,url,hostname,featured,path,category,subcategory,description,reporter,severity,updated) VALUES ($id,$name,'scam',$url,$hostname,0,$path,$category,$subcategory,$description,$reporter,$severity,0) ON CONFLICT(id) DO UPDATE SET path=$path,category=$category,subcategory=$subcategory,description=$description,reporter=$reporter,severity=$severity WHERE id=$id",
                    {
                        $id: entry.getID(),
                        $name: entry.getHostname(),
                        $url: entry.url,
                        $hostname: entry.getHostname(),
                        $path: entry.path,
                        $category: entry.category,
                        $subcategory: entry.subcategory,
                        $description: entry.description,
                        $reporter: entry.reporter,
                        $severity: entry.severity
                    }
                );
                const addresses: any = await all('SELECT * FROM addresses WHERE entry=?', [
                    entry.getID()
                ]);
                await Promise.all(
                    addresses.map(async address => {
                        if (!(address.address in (entry.addresses || []))) {
                            await run('DELETE FROM addresses WHERE address=? AND entry=?', [
                                address.address,
                                entry.getID()
                            ]);
                        }
                    })
                );
                await Promise.all(
                    (entry.addresses || []).map(async address => {
                        await run(
                            'INSERT OR IGNORE INTO addresses(address, coin, entry) VALUES (?,?,?)',
                            [address, entry.coin, entry.getID()]
                        );
                    })
                );
            })
        );
        await run(
            'INSERT INTO checksums(filename,hash) VALUES ($filename,$hash) ON CONFLICT(filename) DO UPDATE SET hash=$hash WHERE filename=$filename',
            {
                $filename: 'etherscamdb_blacklist.yaml',
                $hash: etherscamdbChecksum
            }
        );
        await run('COMMIT');
    }
};

export const priceUpdate = async (): Promise<void> => {
    debug('Updating price...');
    await Promise.all(
        coins.map(async each => {
            const ret = await priceLookup(each.priceSource, each.priceEndpoint);
            const priceUSD = await JSON.parse(JSON.stringify(ret)).USD;
            debug(each.ticker + ' price in usd: ' + JSON.stringify(priceUSD));
            await run('INSERT OR REPLACE INTO prices VALUES (?,?)', [each.ticker, priceUSD]);
        })
    );
};

export const createPR = async (): Promise<void> => {
    const reported: any = await all('SELECT * FROM reported');
    if (reported.length > 0) {
        debug(reported.length + ' entries found in report cache.');
        const reports = [];
        reported.map(en => {
            reports.push(en);
        });
        reports.forEach(async entry => {
            try {
                debug('Trying to remove entry from report cache');
                const successStatus = await autoPR.autoPR(
                    JSON.parse(entry.data),
                    config.apiKeys.Github_AccessKey
                ); //{"success":true};
                if (successStatus.success) {
                    // Success
                    run('DELETE FROM reported WHERE data=?', [entry.data]);
                    debug('Url entry removed from report cache.');
                    debug(
                        'Report Cache: ' + JSON.stringify(reports, null, 4) + ' - ' + reports.length
                    );
                } else {
                    // Failure
                    debug('Entry could not be removed from report cache.');
                }
            } catch (e) {
                // Failure
                debug('error: ' + e);
                debug('Github server err in removing entry from report cache: ' + e);
            }
        });
    }
};

export const addReport = async (entry: EntryWrapper) => {
    // Adding new entry to the reported section.
    debug('started adding report?');
    try {
        await run('INSERT OR IGNORE INTO reported VALUES (?)', [JSON.stringify(entry)]);
    } catch (e) {
        return { success: false, error: e };
    }

    if (entry.data.url) {
        return { success: true, url: entry.data.url, newEntry: entry };
    } else {
        return { success: true, newEntry: entry };
    }
};

export const checkReport = (entry: EntryWrapper): Promise<boolean> => {
    return new Promise(async (resolve, reject) => {
        const reported: any = await all('SELECT * FROM reported');
        debug('Reported list: ' + JSON.stringify(reported, null, 4));
        reported.map(en => {
            if (JSON.parse(en.data).data.url.toLowerCase() === entry.data.url.toLowerCase()) {
                resolve(true);
            } else {
                debug('Input entry not found in reported');
                resolve(false);
            }
        });
        resolve(false);
    });
};

export const checkDuplicate = async (entry: Entry): Promise<any> => {
    if (entry.addresses) {
        entry.addresses.forEach(async address => {
            const dbEntry: any = await get('SELECT * FROM addresses WHERE address=?', [address]);
            if (dbEntry && dbEntry.type === 'scam') {
                return { duplicate: true, type: 'Blacklisted address already exists.' };
            }
            if (dbEntry && dbEntry.type === 'verified') {
                return { duplicate: true, type: 'Whitelisted address already exists.' };
            }
        });
    }

    if (entry.url || entry.name) {
        if (entry.url) {
            const dbEntry: any = await get('SELECT * FROM entries WHERE url=?', [entry.url]);
            if (dbEntry && dbEntry.type === 'scam') {
                return { duplicate: true, type: 'Blacklisted url already exists.' };
            }
            if (dbEntry && dbEntry.type === 'verified') {
                return { duplicate: true, type: 'Whitelisted url already exists.' };
            }
        }

        if (entry.name) {
            const dbEntry: any = await get('SELECT * FROM entries WHERE name=?', [entry.name]);
            if (dbEntry && dbEntry.type === 'scam') {
                return { duplicate: true, type: 'Blacklisted name already exists.' };
            }
            if (dbEntry && dbEntry.type === 'verified') {
                return { duplicate: true, type: 'Whitelisted name already exists.' };
            }
        }
        return { duplicate: false, type: 'Valid entry.' };
    }
    return { duplicate: false, type: 'Valid entry.' };
};
