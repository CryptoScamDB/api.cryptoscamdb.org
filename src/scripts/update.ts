process.env.UV_THREADPOOL_SIZE = '128';

import * as sqlite3 from 'sqlite3';
import * as Debug from 'debug';
import Scam from '../classes/scam.class';
import config from '../utils/config';

const debug = Debug('update');
const db = new sqlite3.Database('./cache.db');

let updated = [];

const all = (query, data = []) => {
    return new Promise((resolve, reject) => {
        db.all(query, data, (error, rows) => {
            if (error) {
                reject(error);
            } else {
                debug('ROWS.length: ' + rows.length);
                resolve(rows);
            }
        });
    });
};

/* Push all queue items to parent process */
setInterval(() => {
    if (updated.length > 0) {
        process.send(updated);
        updated = [];
    }
}, 500);

if (!process.send) {
    throw new Error('This script can only run as a child process');
} /* Script must be called from another process */

(async () => {
    debug('Updating scams...');

    const scams: any = await all(
        "SELECT * FROM entries WHERE type='scam' AND updated < ? ORDER BY updated ASC",
        [Date.now() - config.interval.cacheExpiration]
    );
    debug('Length of scams to update: ' + scams.length);
    debug('Time to execute: ' + (Date.now() - config.interval.cacheExpiration));
    /* Update all scams which weren't updated recently */
    await Promise.all(
        scams
            .map(scam => new Scam(scam))
            .map(async scam => {
                if (config.lookups.HTTP.enabled) {
                    await scam.getStatus();
                } /* Update status */
                if (config.lookups.DNS.IP.enabled) {
                    await scam.getIP();
                } /* Update IP */
                if (config.lookups.DNS.NS.enabled) {
                    await scam.getNameservers();
                } /* Update nameservers */

                if (scam.ip || scam.nameservers.length > 0 || scam.status || scam.statusCode) {
                    /* Push updated data to queue */
                    updated.push({
                        id: scam.id,
                        ip: scam.ip,
                        nameservers: scam.nameservers,
                        status: scam.status,
                        statusCode: scam.statusCode,
                        updated: Date.now()
                    });
                }
            })
    );

    debug('Updating scams completed!');
    setTimeout(() => {
        process.exit();
    }, 500);
})();
