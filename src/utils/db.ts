import * as fs from 'fs-extra';
import * as yaml from 'js-yaml';
import * as url from 'url';
import * as path from 'path';
import config from './config';
import * as serialijse from 'serialijse';
import createDictionary from '@cryptoscamdb/array-object-dictionary';
import Scam from '../classes/scam.class';
import * as Debug from 'debug';
import Entry from '../models/entry';
import EntryWrapper from '../models/entrywrapper';
import Coins from '../models/coins';
import { priceLookup } from './lookup';
import * as autoPR from './autoPR';

const debug = Debug('db');

/* Declare Scam class for serialijse */
serialijse.declarePersistable(Scam);

interface Database {
    scams: Scam[];
    verified: Entry[];
    index: {
        featured: Entry[];
        blacklist: string[];
        whitelist: string[];
        whitelistAddresses: string[];
        addresses: string[];
        ips: string[];
        inactives: Scam[];
        actives: Scam[];
        reporters: string[];
    };
    prices: {
        cryptos: Coins[];
    };
    reported: EntryWrapper[];
}

/* Define empty database structure */
const db: Database = {
    scams: [],
    verified: [],
    index: {
        featured: [],
        blacklist: [],
        whitelist: [],
        whitelistAddresses: [],
        addresses: [],
        ips: [],
        inactives: [],
        actives: [],
        reporters: []
    },
    prices: {
        cryptos: []
    },
    reported: []
};

/* Read entries from yaml files and load them into DB object */
export const readEntries = async (): Promise<void> => {
    debug('Reading entries...');
    const scamsFile = await fs.readFile(
        path.join(__dirname, '../../data/blacklist_urls.yaml'),
        'utf8'
    );
    const verifiedFile = await fs.readFile(
        path.join(__dirname, '../../data/whitelist_urls.yaml'),
        'utf8'
    );
    const cacheExists = await fs.pathExists('./cache.db');
    if (!cacheExists) {
        yaml.safeLoad(scamsFile)
            .map(entry => new Scam(entry))
            .forEach(entry => db.scams.push(entry));
        yaml.safeLoad(verifiedFile).forEach(entry => db.verified.push(entry));
    } else {
        const cacheFile = await fs.readFile('./cache.db', 'utf8');
        Object.assign(db, serialijse.deserialize(cacheFile));
        yaml.safeLoad(scamsFile)
            .filter(entry => !db.scams.find(scam => scam.url === entry.url))
            .map(entry => new Scam(entry))
            .forEach(entry => db.scams.push(entry));
        yaml.safeLoad(verifiedFile)
            .filter(entry => !db.verified.find(verified => verified.url === entry.url))
            .forEach(entry => db.verified.push(entry));
        yaml.safeLoad(scamsFile).forEach(entry => {
            const index = db.scams.indexOf(db.scams.find(scam => scam.url === entry.url));
            db.scams[index].category = entry.category;
            db.scams[index].subcategory = entry.subcategory;
            db.scams[index].description = entry.description;
            db.scams[index].reporter = entry.reporter;
            db.scams[index].coin = entry.coin;
        });
        yaml.safeLoad(verifiedFile).forEach(entry => {
            const index = db.verified.indexOf(
                db.verified.find(verified => verified.url === entry.url)
            );
            db.verified[index].url = entry.url;
            db.verified[index].description = entry.description;
            if (entry.addresses) {
                db.verified[index].addresses = entry.addresses;
            }
        });
    }
};

/* Create indexes for DB object */
export const updateIndex = async (): Promise<void> => {
    //debug("Updating index...");
    const scamDictionary = createDictionary(db.scams);
    const verifiedDictionary = createDictionary(db.verified);

    db.index.featured = db.verified
        .filter(entry => entry.featured)
        .sort((a, b) => a.name.localeCompare(b.name));
    db.index.blacklist = [
        ...db.scams
            .filter(entry => entry.path == '/*')
            .map(entry => entry.getHostname().replace('www.', '')),
        ...db.scams
            .filter(entry => entry.path == '/*')
            .map(entry => entry.getHostname().replace('www.', '')),
        ...Object.keys(scamDictionary.ip || {}).filter(ip => scamDictionary[ip].path == '/*')
    ];
    db.index.whitelist = [
        ...db.verified.map(entry => url.parse(entry.url).hostname.replace('www.', '')),
        ...db.verified.map(entry => 'www.' + url.parse(entry.url).hostname.replace('www.', ''))
    ];
    db.index.whitelistAddresses = verifiedDictionary.addresses || [];
    db.index.addresses = scamDictionary.addresses || [];
    db.index.ips = scamDictionary.ip || [];
    db.index.inactives = db.scams.filter(scam => scam.status !== 'Active');
    db.index.actives = db.scams.filter(scam => scam.status === 'Active');
    db.index.reporters = scamDictionary.reporter;
};

/* Write DB on exit */
export const exitHandler = (): void => {
    fs.writeFileSync('./cache.db', serialijse.serialize(db));
};

export const init = async (): Promise<void> => {
    await readEntries();
    await module.exports.priceUpdate();
    await updateIndex();
    await module.exports.persist();
    if (config.interval.priceLookup > 0) {
        setInterval(module.exports.priceUpdate, config.interval.priceLookup);
    }
    if (config.interval.databasePersist > 0) {
        setInterval(module.exports.persist, config.interval.databasePersist);
    }
    process.stdin.resume();
    process.once('beforeExit', exitHandler);
    process.once('SIGINT', exitHandler);
    process.once('SIGTERM', exitHandler);
};

export const read = (): Database => db;

export const write = (scamUrl, data): void => {
    const scam = db.scams.find(dbScam => dbScam.url === scamUrl);
    Object.keys(data).forEach(key => (scam[key] = data[key]));
    updateIndex(); // TODO: Handle promise
};

export const persist = async (): Promise<void> => {
    debug('Persisting cache...');
    await fs.writeFile('./cache.db', serialijse.serialize(db));
};

export const priceUpdate = async (): Promise<void> => {
    debug('Updating price...');
    config.coins.forEach(async each => {
        const ret = await priceLookup(each.priceSource, each.priceEndpoint);
        const priceUSD = await JSON.parse(JSON.stringify(ret)).USD;
        debug(each.ticker + ' price in usd: ' + JSON.stringify(priceUSD));
        db.prices.cryptos.push({
            ticker: each.ticker,
            price: priceUSD
        });
    });
};

export const createPR = async (): Promise<void> => {
    if (db.reported.length < 1 || db.reported === undefined) {
        // Do nothing; empty reported cache
    } else {
        debug(db.reported.length + ' entries found in report cache.');
        db.reported.forEach(async entry => {
            try {
                const successStatus = await autoPR.autoPR(entry, config.apiKeys.Github_AccessKey);
                if (successStatus.success) {
                    if (successStatus.url) {
                        // Success
                        debug('Removing entry from report list');
                        db.reported = db.reported.filter(el => {
                            return el !== entry;
                        });
                        exitHandler();
                        debug('Url entry ' + successStatus.url + ' removed from the cache.');
                    } else {
                        // Success
                        debug('Removing entry from report list.');
                        db.reported = db.reported.filter(el => {
                            return el !== entry;
                        });
                        exitHandler();
                        debug('Entry removed from the cache.');
                    }
                } else {
                    // Failure
                    debug('Entry could not be removed from the cache.');
                }
            } catch (e) {
                // Failure
                debug('Github server err in removing entry: ' + e);
            }
        });
    }
};

export const addReport = async (entry: EntryWrapper) => {
    // Adding new entry to the reported section.
    try {
        db.reported.push(entry);
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
    if (db.reported.find(el => el !== entry)) {
        return true;
    } else {
        return false;
    }
};

export const checkDuplicate = async (entry: Entry): Promise<any> => {
    if (entry.addresses) {
        entry.addresses.forEach(address => {
            if (db.index.addresses.find(blacklistedaddr => blacklistedaddr === address)) {
                return { duplicate: true, type: 'Blacklisted address already exists.' };
            }
            if (db.index.whitelistAddresses.find(whitelistAddr => whitelistAddr === address)) {
                return { duplicate: true, type: 'Whitelisted address already exists.' };
            }
        });
    }

    if (entry.url || entry.name) {
        if (entry.url) {
            if (db.scams.find(scam => scam.url === entry.url)) {
                return { duplicate: true, type: 'Blacklisted url already exists.' };
            }
            if (db.verified.find(verified => verified.url === entry.url)) {
                return { duplicate: true, type: 'Whitelisted url already exists.' };
            }
        }

        if (entry.name) {
            if (db.scams.find(scam => scam.name === entry.name)) {
                return { duplicate: true, type: 'Blacklisted name already exists.' };
            }
            if (db.verified.find(verified => verified.name === entry.name)) {
                return { duplicate: true, type: 'Whitelisted name already exists.' };
            }
        }
        return { duplicate: false, type: 'Valid entry.' };
    }
    return { duplicate: false, type: 'Valid entry.' };
};
