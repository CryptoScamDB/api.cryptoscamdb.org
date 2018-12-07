import { name, version } from '../../package.json';
import * as Debug from 'debug';
import * as express from 'express';
import * as db from './db';
import generateAbuseReport from './abusereport';
import * as url from 'url';
import config from './config';
import * as github from './github';
import * as captcha from './gcaptcha';
import * as slack from './slack';
import { getGoogleSafeBrowsing, getURLScan, getVirusTotal, accountLookup } from './lookup';
import addressCheck from './addressCheck';
import { flatten } from 'flat';
import { apiKeyOwner } from './apiKeyTest';
import { categorizeUrl } from './categorize';
import * as ensResolve from './ensResolve';
import { balanceLookup } from './balanceLookup';
import coins from './endpoints';
import { testCoinType } from './testCoinType';

const debug = Debug('router');
const router = express.Router();

/* Send CSDB-Version header */
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('CSDB-Version', version);
    next();
});

router.get('/', (req, res) =>
    res.redirect('https://documenter.getpostman.com/view/4298426/RzZ7nKcM')
);
router.get('/v1/stats', async (req, res) =>
    res.json({
        success: true,
        result: {
            scams: Object.keys(db.read().scams).length,
            verified: Object.keys(db.read().verified).length,
            featured: Object.keys(db.read().index.featured).length,
            addresses: Object.keys(db.read().index.addresses).length,
            ips: Object.keys(db.read().index.ips).length,
            actives: Object.keys(db.read().index.actives).length,
            inactives: Object.keys(db.read().index.inactives).length,
            reporters: Object.keys(db.read().index.reporters).map(reporter => ({
                name: reporter,
                count: db.read().index.reporters[reporter].length
            })),
            categories: await db.getCategoryStats(),
            subcategories: await db.getSubCategoryStats()
        }
    })
);
router.get('/v1/featured', (req, res) =>
    res.json({ success: true, result: db.read().verified.filter(entry => entry.featured) })
);
router.get('/v1/scams', (req, res) => res.json({ success: true, result: db.read().scams }));
router.get('/v1/entry/:id', async (req, res) => {
    const entry = db.read().scams.find(ent => ent.id === req.params.id);
    if (!entry) {
        res.json({ success: false, message: "Couldn't find requested ID" });
    } else {
        entry.lookups = {};
        entry.abusereport = generateAbuseReport(entry);
        if (config.apiKeys.Google_SafeBrowsing) {
            entry.lookups.Google_SafeBrowsing = await getGoogleSafeBrowsing(entry.url);
        } else {
            entry.lookups.Google_SafeBrowsing = null;
        }
        if (config.apiKeys.VirusTotal) {
            entry.lookups.VirusTotal = await getVirusTotal(entry.url);
        } else {
            entry.lookups.VirusTotal = null;
        }
        entry.lookups.URLScan = await getURLScan(entry.hostname);
        res.json({ success: true, result: entry });
    }
});
router.get('/v1/domain/:domain', async (req, res) => {
    const badEntries = db.read().scams.filter(entry => entry.hostname === req.params.domain);
    const goodEntries = db
        .read()
        .verified.filter(entry => url.parse(entry.url).hostname === req.params.domain);
    res.json({
        success: badEntries.length > 0 || goodEntries.length > 0,
        result: [
            ...badEntries.map(entry => {
                entry.type = 'scam';
                return entry;
            }),
            ...goodEntries.map(entry => {
                entry.type = 'verified';
                return entry;
            })
        ]
    });
});
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
router.get('/v1/coininfo/:coin', async (req, res) => {
    res.json({
        success: true,
        result: db.read().coininfo.find(entry => (entry.ticker = req.params.coin))
    });
});
router.get('/v1/blacklist', (req, res) => res.json(db.read().index.blacklist));
router.get('/v1/whitelist', (req, res) => res.json(db.read().index.whitelist));
router.get('/v1/reportedlist', (req, res) => res.json(db.read().reported));
router.get('/v1/abusereport/:domain', (req, res) => {
    const result = db
        .read()
        .scams.find(
            scam =>
                scam.getHostname() === url.parse(req.params.domain).hostname ||
                scam.getHostname() === req.params.domain ||
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
    if (req.query.coin) {
        const coin = req.query.coin.toUpperCase();
        const address = req.params.search;
        if (coins.includes(coin)) {
            const retJson = await addressCheck(address, coin);
            res.json({ success: true, input: address, coin, result: retJson });
        } else {
            res.json({
                success: false,
                input: address,
                message: 'We do not support the queried coin yet.',
                coin
            });
        }
    } else {
        try {
            const blank = await testCoinType(req.params.search);
            debug('blank: ' + JSON.stringify(blank, null, 4));
            const retJson = await addressCheck(req.params.search, blank.ticker);
            res.json({
                success: true,
                input: req.params.search,
                coin: blank.ticker,
                result: retJson
            });
        } catch (e) {
            if (/((?:.eth)|(?:.luxe)|(?:.test))$/.test(req.params.search)) {
                /* Searched for an ENS name */
                if (
                    /(?=([(a-z0-9A-Z)]{7,100})(?=(.eth|.luxe|.test|.xyz)$))/.test(req.params.search)
                ) {
                    try {
                        const address = await ensResolve.resolve(req.params.search);
                        if (address === '0x0000000000000000000000000000000000000000') {
                            // If lookup failed, try again one more time, then return err;
                            const secondaddress = await ensResolve.resolve(req.params.search);
                            if (secondaddress === '0x0000000000000000000000000000000000000000') {
                                debug('Issue resolving ENS name: ' + req.params.search);
                                res.json({
                                    success: false,
                                    input: req.params.search,
                                    message: 'Failed to resolve ENS name due to network errors.'
                                });
                            } else {
                                const retJson = await addressCheck(secondaddress, 'ETH');
                                retJson.address = secondaddress;
                                retJson.address = address;
                                res.json({
                                    success: true,
                                    input: req.params.search,
                                    coin: 'ETH',
                                    type: 'ENS',
                                    validRoot: true,
                                    result: retJson
                                });
                            }
                        } else {
                            const retJson = await addressCheck(address, 'ETH');
                            retJson.address = address;
                            res.json({
                                success: true,
                                input: req.params.search,
                                coin: 'ETH',
                                type: 'ENS',
                                validRoot: true,
                                result: retJson
                            });
                        }
                    } catch (e) {
                        debug('Issue resolving ENS name: ' + req.params.search);
                        res.json({
                            success: false,
                            input: req.params.search,
                            message: 'Issue resolving ENS name.'
                        });
                    }
                } else {
                    res.json({
                        success: false,
                        input: req.params.search,
                        coin: 'ETH',
                        type: 'ENS',
                        validRoot: false,
                        message: 'Invalid ENS name'
                    });
                }
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
                            (url.parse(req.params.search.toLowerCase()).hostname ||
                                req.params.search.toLowerCase()) === url.parse(entry.url).hostname
                    );
                const blacklistURL = db
                    .read()
                    .scams.find(
                        entry =>
                            (url.parse(req.params.search.toLowerCase()).hostname ||
                                req.params.search.toLowerCase()) === entry.getHostname()
                    );
                if (whitelistURL) {
                    res.json({
                        input: req.params.search,
                        success: true,
                        result: {
                            status: 'verified',
                            type: 'domain',
                            entries: [whitelistURL]
                        }
                    });
                } else if (blacklistURL) {
                    res.json({
                        input: req.params.search,
                        success: true,
                        result: {
                            status: 'blocked',
                            type: 'domain',
                            entries: [blacklistURL]
                        }
                    });
                } else {
                    res.json({
                        input: req.params.search,
                        success: true,
                        result: {
                            status: 'neutral',
                            type: 'domain',
                            entries: []
                        }
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
                        input: req.params.search,
                        success: true,
                        result: {
                            status: 'neutral',
                            type: 'ip',
                            entries: blacklistIP
                        }
                    });
                } else {
                    res.json({
                        input: req.params.search,
                        success: true,
                        result: {
                            status: 'neutral',
                            type: 'ip',
                            entries: []
                        }
                    });
                }
            } else {
                res.json({
                    input: req.params.search,
                    success: false,
                    message:
                        'Incorrect search type (must be a BTC/BCH/ETC/ETC/LTC address / ip address / URL)'
                });
            }
        }
    }
});

/* Price endpoints */
router.get('/v1/price/:coin', async (req, res) => {
    if (req.params.coin) {
        const coin = req.params.coin.toUpperCase();
        const cryptos = {};
        db.read().prices.cryptos.forEach(dbcoin => {
            cryptos[dbcoin.ticker] = dbcoin.price;
        });
        if (cryptos && cryptos[coin]) {
            res.json({
                success: true,
                result: cryptos[coin],
                coin
            });
        } else {
            res.json({
                success: false,
                message: `Coin ${coin} is not supported by this app\'s configuration`,
                coin
            });
        }
    } else {
        res.json({
            success: false,
            message: `You did not input a coin type.`
        });
    }
});

router.get('/v1/balance/:coin/:address', async (req, res) => {
    const coin = req.params.coin.toUpperCase();
    try {
        const index = coins.findIndex(entry => entry.ticker === coin);
        const returnedBal = (await balanceLookup(req.params.address, coin)) as any;
        if (returnedBal === -1) {
            res.json({
                success: false,
                inputcoin: coin,
                inputaddress: req.params.address,
                message: 'Failed to lookup balance.'
            });
        } else {
            const decimal = Number(coins[index].decimal);
            const balance = Number(returnedBal.balance);
            const usdIndex = db.read().prices.cryptos.findIndex(entry => entry.ticker === coin);
            const usdPrice = db.read().prices.cryptos[usdIndex];
            const value = balance * Math.pow(10, Math.round(-1 * decimal));
            const blockexplorer = coins.find(entry => entry.ticker === coin).addressLookUp;
            res.json({
                success: true,
                blockexplorer: blockexplorer + req.params.address,
                balance: value,
                usdvalue: usdPrice.price * value
            });
        }
    } catch (e) {
        res.json({
            success: false,
            message: e.message
        });
    }
});

router.get('/*', (req, res) =>
    res.json({
        success: false,
        message: 'This is an invalid api endpoint.'
    })
);

router.put('/v1/report', async (req, res) => {
    /* API-based reporting */
    if (req.headers['x-api-key']) {
        const reportKey: string = req.headers['x-api-key'].toString();
        debug(
            'Incoming report: ' +
                JSON.stringify(req.body, null, 2) +
                ' from apikey ' +
                req.headers['x-api-key']
        );
        if (config.apiKeys.Github_AccessKey && config.autoPR.enabled) {
            if (reportKey) {
                const newEntry = req.body;
                // Delete apiKey and apiKeyID from newEntry.
                if (newEntry.apikey) {
                    delete newEntry.apikey;
                }
                if (newEntry.apiid) {
                    delete newEntry.apiid;
                }

                if (newEntry.addresses || newEntry.name || newEntry.url) {
                    /* Force name/url fields to standard */
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
                        newEntry.url = 'http://' + newEntry.name;
                    }
                    if (!newEntry.name && newEntry.url) {
                        newEntry.url = newEntry.url.replace('www.', '');
                        newEntry.name = newEntry.url.replace('http://', '').replace('https://', '');
                    }

                    /* Cast addresses field as an array */
                    if (typeof newEntry.addresses === 'string') {
                        newEntry.addresses = [newEntry.addresses];
                    }

                    /* Checks to make sure there is no duplicate entry already in the db */
                    const checkAddressesResult = await db.checkDuplicate(newEntry);
                    if (checkAddressesResult.duplicate) {
                        debug(
                            'Duplicate entry: ' +
                                JSON.stringify(newEntry) +
                                ' - ' +
                                checkAddressesResult.type
                        );
                        res.json({
                            success: false,
                            message: checkAddressesResult.type
                        });
                    } else {
                        /* Attempt to categorize if name or url exists, but no cat/subcat */
                        if (
                            (newEntry.name || newEntry.url) &&
                            !newEntry.category &&
                            !newEntry.subcategory
                        ) {
                            const cat = await categorizeUrl(newEntry);
                            if (cat.categorized && cat.category && cat.subcategory) {
                                newEntry.category = cat.category;
                                newEntry.subcategory = cat.subcategory;
                            }
                        }

                        /* Determine coin field based on first address input. Lightweight; defaults to most likely. */
                        if (newEntry.addresses && !newEntry.coin) {
                            if (/^0x?[0-9A-Fa-f]{40,42}$/.test(newEntry.addresses[0])) {
                                newEntry.coin = 'ETH';
                            } else if (
                                /^([13][a-km-zA-HJ-NP-Z1-9]{25,34})/.test(newEntry.addresses[0])
                            ) {
                                newEntry.coin = 'BTC';
                            } else if (
                                /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(newEntry.addresses[0])
                            ) {
                                newEntry.coin = 'LTC';
                            }
                        }

                        /* Determine reporter */
                        let reporterLookup;
                        try {
                            reporterLookup = await apiKeyOwner(reportKey);
                        } catch (e) {
                            res.json({
                                success: false,
                                message: 'Invalid API Key.'
                            });
                            return;
                        }
                        if (reporterLookup) {
                            newEntry.reporter = reporterLookup;
                        } else {
                            newEntry.reporter = 'unknown';
                        }
                        const command = {
                            type: 'ADD',
                            data: newEntry
                        };

                        /* Checks if duplicate exists in reported cache. */
                        if (await db.checkReport(command)) {
                            debug('Duplicate command already found in cache.');
                            res.json({
                                success: false,
                                message: 'Duplicate entry already exists in the report cache.'
                            });
                        } else {
                            debug('New command created: ' + JSON.stringify(command));
                            const result = await db.addReport(command);
                            if (result.success) {
                                if (result.url) {
                                    res.json({
                                        success: true,
                                        url: result.url,
                                        result: newEntry
                                    });
                                } else {
                                    res.json({
                                        success: true,
                                        result: newEntry
                                    });
                                }
                            } else {
                                res.json({
                                    success: false,
                                    message: 'Failed to add report entry to cache.'
                                });
                            }
                        } // End duplicate-in-cache check
                    } // End duplicate-in-db check
                } else {
                    res.json({
                        success: false,
                        message:
                            'This is an invalid entry. New entries must contain either an addresses, name, or url field.'
                    });
                }
            } else {
                res.json({
                    success: false,
                    message: 'This is an invalid API Key.'
                });
            }
        } else {
            res.json({
                success: false,
                message: 'This config does not support Github-based Auto-PRs.'
            });
        }
    } else {
        res.json({
            success: false,
            message:
                'API key required for this method. Please include an x-api-key field in the request header.'
        });
    }
});

/* Incoming user reports */
router.post('/v1/report', async (req, res) => {
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
    } else if (config.apiKeys.Slack_Webhook && req.body && req.body.args && req.body.args.captcha) {
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
});

/* Incoming Github webhook attempt */
router.post('/update/', (req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => (body += chunk));
    req.on('end', () => github.webhook(req, res, body));
});

export default router;
