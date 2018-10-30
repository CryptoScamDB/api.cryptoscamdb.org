import { name, version } from '../../package.json';
import * as Debug from 'debug';
import * as express from 'express';
import * as db from './db';
import generateAbuseReport from './abusereport';
import * as checkForPhishing from 'eth-phishing-detect';
import * as dateFormat from 'dateformat';
import * as url from 'url';
import config from './config';
import * as github from './github';
import * as isIpPrivate from 'private-ip';
import * as captcha from './gcaptcha';
import * as slack from './slack';
import { getGoogleSafeBrowsing, getURLScan, getVirusTotal, accountLookup } from './lookup';
import addressCheck from './addressCheck';
import { flatten } from 'flat';
import { isValidApiKey, apiKeyOwner } from './apiKeyTest';
import { categorizeUrl } from './categorize';

const debug = Debug('router');
const router = express.Router();

/* Send CSDB-Version header */
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('CSDB-Version', version);
    next();
});

router.get('/', (req, res) => res.send(name + ' ' + version));

router.get('/v1/scams', (req, res) => res.json({ success: true, result: db.read().scams }));
router.get('/v1/addresses', (req, res) =>
    res.json({ success: true, result: db.read().index.addresses })
);
router.get('/v1/ips', (req, res) => res.json({ success: true, result: db.read().index.ips }));
router.get('/v1/verified', (req, res) => res.json({ success: true, result: db.read().verified }));
router.get('/v1/inactives', (req, res) =>
    res.json({ success: true, result: db.read().index.inactives })
);
router.get('/v1/actives', (req, res) =>
    res.json({ success: true, result: db.read().index.actives })
);
router.get('/v1/blacklist', (req, res) => res.json(db.read().index.blacklist));
router.get('/v1/whitelist', (req, res) => res.json(db.read().index.whitelist));
router.get('/v1/abusereport/:domain', (req, res) => {
    const result = db
        .read()
        .scams.find(
            scam =>
                scam.getHostname() === url.parse(req.params.domain).hostname ||
                scam.url.replace(/(^\w+:|^)\/\//, '') === req.params.domain
        );
    if (result) {
        res.json({ success: true, result: generateAbuseReport(result) });
    } else {
        res.json({ success: false, message: "URL wasn't found" });
    }
});

/* Check address/domain/ip endpoints */
router.get('/v1/check/:search', async (req, res) => {
    if (req.query) {
        if (req.query.coin) {
            if (req.query.coin.toLowerCase() === 'eth') {
                /* Searched for a eth address */
                res.json(await addressCheck(req.params.search, 'eth'));
            } else if (req.query.coin.toLowerCase() === 'etc') {
                /* Searched for a etc address */
                res.json(await addressCheck(req.params.search, 'etc'));
            } else if (req.query.coin.toLowerCase() === 'btc') {
                /* Searched for a btc address */
                res.json(await addressCheck(req.params.search, 'btc'));
            } else if (req.query.coin.toLowerCase() === 'bch') {
                /* Searched for a bch address */
                res.json(await addressCheck(req.params.search, 'bch'));
            } else if (req.query.coin.toLowerCase() === 'ltc') {
                /* Searched for a ltc address */
                res.json(await addressCheck(req.params.search, 'ltc'));
            } else {
                res.json({
                    success: false,
                    result: 'We do not support the queried coin yet.',
                    coin: req.query.chain
                });
            }
        }
    }
    if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.search)) {
        /* Searched for an eth/etc address */

        let ethAccountBalance = await (function() {
            return new Promise(async (resolve, reject) => {
                config.coins.forEach(async each => {
                    if (each.ticker === 'eth') {
                        let returned = flatten(
                            await accountLookup(
                                req.params.search,
                                each.addressLookUp,
                                each.addressEndpoint
                            )
                        );
                        if (returned.success === false) {
                            reject(0);
                        } else {
                            let ethBalance = returned['body.' + each.addressEndpoint];
                            debug('eth balance ret: ' + JSON.stringify(ethBalance));
                            if (ethBalance === undefined) {
                                resolve(-1);
                            } else {
                                resolve(ethBalance);
                            }
                        }
                    }
                });
            });
        })();

        let etcAccountBalance = await (function() {
            return new Promise(async (resolve, reject) => {
                config.coins.forEach(async each => {
                    debug('each: ' + each);
                    if (each.ticker === 'etc') {
                        let returned = flatten(
                            await accountLookup(
                                req.params.search,
                                each.addressLookUp,
                                each.addressEndpoint
                            )
                        );
                        debug(JSON.stringify(returned));
                        if (returned.success === false) {
                            reject(0);
                        } else {
                            let etcBalance = returned['body.' + each.addressEndpoint];
                            debug('etc balance ret: ' + JSON.stringify(etcBalance));
                            if (etcBalance === undefined) {
                                resolve(-1);
                            } else {
                                resolve(etcBalance);
                            }
                        }
                    }
                });
            });
        })();
        if (ethAccountBalance === -1) {
            res.json({
                success: false,
                message: 'Unable to find account balance for Bitcoin. Using Bitcoin Cash instead.',
                result: await addressCheck(req.params.search, 'etc')
            });
        } else if (etcAccountBalance === -1) {
            res.json({
                success: false,
                message: 'Unable to find account balance for Bitcoin Cash. Using Bitcoin instead.',
                result: await addressCheck(req.params.search, 'eth')
            });
        } else if (ethAccountBalance > etcAccountBalance) {
            /* Searched for a eth address */
            res.json(await addressCheck(req.params.search, 'eth'));
        } else if (etcAccountBalance > ethAccountBalance) {
            /* Searched for a etc address */
            res.json(await addressCheck(req.params.search, 'etc'));
        } else if (etcAccountBalance === 0 && ethAccountBalance === 0) {
            /* No balance in eth/etc, defaulting to eth */
            res.json(await addressCheck(req.params.search, 'eth'));
        }
    } else if (/^([13][a-km-zA-HJ-NP-Z1-9]{25,34})/.test(req.params.search)) {
        /* Searched for an btc/bch address */
        if (
            /^((bitcoincash:)?(q|p)[a-z0-9]{41})|^((BITCOINCASH:)?(Q|P)[A-Z0-9]{41})$/.test(
                req.params.search
            )
        ) {
            /* Searched for a bch address */
            res.json(await addressCheck(req.params.search, 'bch'));
        } else {
            let btcAccountBalance = await (function() {
                return new Promise(async (resolve, reject) => {
                    config.coins.forEach(async each => {
                        if (each.ticker === 'btc') {
                            let returned = flatten(
                                await accountLookup(
                                    req.params.search,
                                    each.addressLookUp,
                                    each.addressEndpoint
                                )
                            );
                            if (returned.success === false) {
                                reject(0);
                            } else {
                                let btcBalance = returned['body.' + each.addressEndpoint];
                                debug('btc balance ret: ' + JSON.stringify(btcBalance));
                                if (btcBalance === undefined) {
                                    resolve(-1);
                                } else {
                                    resolve(btcBalance);
                                }
                            }
                        }
                    });
                });
            })();

            let bchAccountBalance = await (function() {
                return new Promise(async (resolve, reject) => {
                    config.coins.forEach(async each => {
                        debug('each: ' + each);
                        if (each.ticker === 'bch') {
                            let returned = flatten(
                                await accountLookup(
                                    req.params.search,
                                    each.addressLookUp,
                                    each.addressEndpoint
                                )
                            );
                            debug(JSON.stringify(returned));
                            if (returned.success === false) {
                                reject(0);
                            } else {
                                let bchBalance = returned['body.' + each.addressEndpoint];
                                debug('bch balance ret: ' + JSON.stringify(bchBalance));
                                if (bchBalance === undefined) {
                                    resolve(-1);
                                } else {
                                    resolve(bchBalance);
                                }
                            }
                        }
                    });
                });
            })();
            if (btcAccountBalance === -1) {
                res.json({
                    success: false,
                    message:
                        'Unable to find account balance for Bitcoin. Using Bitcoin Cash instead.',
                    result: await addressCheck(req.params.search, 'bch')
                });
            } else if (bchAccountBalance === -1) {
                res.json({
                    success: false,
                    message:
                        'Unable to find account balance for Bitcoin Cash. Using Bitcoin instead.',
                    result: await addressCheck(req.params.search, 'btc')
                });
            } else if (btcAccountBalance > bchAccountBalance) {
                /* Searched for a btc address */
                res.json(await addressCheck(req.params.search, 'btc'));
            } else if (bchAccountBalance > btcAccountBalance) {
                /* Searched for a bch address */
                res.json(await addressCheck(req.params.search, 'bch'));
            } else if (bchAccountBalance === 0 && btcAccountBalance === 0) {
                /* No balance in btc/bch, defaulting to btc */
                res.json(await addressCheck(req.params.search, 'btc'));
            }
        }
    } else if (/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(req.params.search)) {
        /* Searched for a ltc address */
        res.json(await addressCheck(req.params.search, 'ltc'));
    } else if (
        /[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/.test(
            req.params.search
        )
    ) {
        /* Searched for a domain */
        const whitelistURL = db
            .read()
            .verified.find(
                entry =>
                    (url.parse(req.params.search).hostname || req.params.search) ===
                    url.parse(entry.url).hostname
            );
        const blacklistURL = db
            .read()
            .scams.find(
                entry =>
                    (url.parse(req.params.search).hostname || req.params.search) ===
                    entry.getHostname()
            );
        if (whitelistURL) {
            res.json({
                success: true,
                result: 'verified',
                type: 'domain',
                entries: [whitelistURL]
            });
        } else if (blacklistURL) {
            res.json({
                success: true,
                result: 'blocked',
                type: 'domain',
                entries: [blacklistURL]
            });
        } else {
            res.json({
                success: true,
                result: 'neutral',
                type: 'domain',
                entries: []
            });
        }
    } else if (
        /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(
            req.params.search
        )
    ) {
        /* Searched for an ip address */
        const blacklistIP = Object.keys(db.read().index.ips).filter(
            ip => req.params.search.toLowerCase() === ip.toLowerCase()
        );
        if (blacklistIP.length > 0) {
            res.json({
                success: true,
                result: 'blocked',
                type: 'ip',
                entries: blacklistIP
            });
        } else {
            res.json({
                success: true,
                result: 'neutral',
                type: 'ip',
                entries: []
            });
        }
    } else {
        res.json({
            success: false,
            message:
                'Incorrect search type (must be a btc/bch/eth/etc/ltc address / ip address / URL)'
        });
    }
});

/* Price endpoints */
router.get('/v1/price/:coin', async (req, res) => {
    if (req.params.coin) {
        const coin = req.params.coin.toLowerCase();
        let cryptos = {};
        db.read().prices.cryptos.forEach(dbcoin => {
            cryptos[dbcoin.ticker] = dbcoin.price;
        });
        if (config.coins) {
            if (cryptos && cryptos[coin]) {
                res.json({ success: true, result: cryptos[coin], coin: coin });
            } else {
                res.json({
                    success: false,
                    result: `Coin ${coin} is not supported by this app\'s configuration`,
                    coin: coin
                });
            }
        } else {
            res.json({
                success: false,
                result: `There are no coins supported in this app\'s configuration`,
                coin: coin
            });
        }
    } else {
        res.json({ success: false, result: `You did not input a coin type.` });
    }
});

/* Incoming user reports */
router.post('/v1/report', async (req, res) => {
    /* API-based reporting */
    if (req.query && req.body) {
        if (config.apiKeys.Github_AccessKey) {
            if (isValidApiKey(req.query.apikey)) {
                let newEntry = req.body;
                debug('Old entry: ' + JSON.stringify(newEntry, null, 4));

                /* Force name to standard */
                if (newEntry.name && newEntry.url) {
                    newEntry.name = newEntry.name
                        .replace('https://', '')
                        .replace('http://', '')
                        .replace('www.', '');
                    newEntry.url =
                        'http://' +
                        newEntry.url
                            .replace('https://', '')
                            .replace('http://', '')
                            .replace('www.', '');
                }

                /* Fill in url/name fields based on the other */
                if (newEntry.name && !newEntry.url) {
                    newEntry.name = newEntry.name
                        .replace('https://', '')
                        .replace('http://', '')
                        .replace('www.', '');
                    newEntry['url'] = 'http://' + newEntry.name;
                }
                if (!newEntry.name && newEntry.url) {
                    newEntry.url =
                        'http://' +
                        newEntry.url
                            .replace('https://', '')
                            .replace('http://', '')
                            .replace('www.', '');
                    newEntry.name = newEntry.url.replace('http://', '');
                }

                /* Attempt to categorize if name or url exists, but no cat/subcat */
                if (
                    (newEntry.name || newEntry.url) &&
                    !newEntry.category &&
                    !newEntry.subcategory
                ) {
                    const cat = await categorizeUrl(newEntry);
                    if (cat.categorized && cat.category && cat.subcategory) {
                        newEntry['category'] = cat.category;
                        newEntry['subcategory'] = cat.subcategory;
                    }
                }

                /* Cast addresses field as an array */
                if (typeof newEntry.addresses === 'string') {
                    newEntry.addresses = [newEntry.addresses];
                }

                /* Determine coin field based on first address input. Lightweight; defaults to most likely. */
                if (newEntry.addresses && !newEntry.coin) {
                    if (/^0x?[0-9A-Fa-f]{40,42}$/.test(newEntry.addresses[0])) {
                        newEntry['coin'] = 'eth';
                    } else if (/^([13][a-km-zA-HJ-NP-Z1-9]{25,34})/.test(newEntry.addresses[0])) {
                        newEntry['coin'] = 'btc';
                    } else if (/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(newEntry.addresses[0])) {
                        newEntry['coin'] = 'ltc';
                    }
                }

                /* Determine reporter */
                let reporter = apiKeyOwner(req.query.apikey);
                newEntry['reporter'] = reporter;
                let command = {
                    type: 'ADD',
                    data: newEntry
                };
                debug('New command created: ' + JSON.stringify(command, null, 4));

                // TODO: ADD new command to github.com/cryptoscamdb/blacklist/commands/blank.yaml

                res.json({ success: true, newEntry: newEntry });
            } else {
                res.json({ success: false, message: 'This is an invalid API Key.' });
            }
        } else {
            res.json({
                success: false,
                message: 'This config does not support Github-based Auto-PRs'
            });
        }
    } else {

    /* Webapp/App-based Reporting */
        if (
            config.apiKeys.Google_Captcha &&
            config.apiKeys.Slack_Webhook &&
            req.body &&
            req.body.args &&
            req.body.args.captcha
        ) {
            const isValidCaptcha = await captcha.verifyResponse(req.body.args.captcha);
            if (isValidCaptcha) {
                slack.sendReport(req.body);
                res.json({
                    success: true
                });
            } else {
                res.json({
                    success: false,
                    message: 'Invalid captcha response provided'
                });
            }
        } else if (
            config.apiKeys.Slack_Webhook &&
            req.body &&
            req.body.args &&
            req.body.args.captcha
        ) {
            slack.sendReport(req.body);
            res.json({
                success: true
            });
        } else {
            res.json({
                success: false,
                message: 'No captcha response provided'
            });
        }
    }
});

/* Redirect old API requests */
router.get('/:all*?', (req, res) => res.redirect('/v1/' + req.params.all));

/* Incoming Github webhook attempt */
router.post('/update/', (req, res) => {
    let body = '';

    req.setEncoding('utf8');
    req.on('data', chunk => (body += chunk));
    req.on('end', () => github.webhook(req, res, body));
});

export default router;
