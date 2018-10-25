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
    };
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
        actives: []
    }
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
        ...db.scams.map(entry => entry.getHostname().replace('www.', '')),
        ...db.scams.map(entry => entry.getHostname().replace('www.', '')),
        ...Object.keys(scamDictionary.ip || {})
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
};

/* Write DB on exit */
export const exitHandler = (): void => {
    console.log('Cleaning up...');
    fs.writeFileSync('./cache.db', serialijse.serialize(db));
    console.log('Exited.');
};

export const init = async (): Promise<void> => {
    await readEntries();
    await updateIndex();
    await module.exports.persist();
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
