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
import Scam from '../classes/scam.class';
import addressCheck from './addressCheck';
import { flatten } from 'flat';
import { apiKeyOwner } from './apiKeyTest';
import { categorizeUrl } from './categorize';
import * as ensResolve from './ensResolve';
import { balanceLookup } from './balanceLookup';
import coins from './endpoints';

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
            scams: (await db.get("SELECT COUNT(*) as count FROM entries WHERE type='scam'"))[
                'COUNT(*)'
            ],
            verified: (await db.get("SELECT COUNT(*) as count FROM entries WHERE type='verified'"))[
                'COUNT(*)'
            ],
            featured: (await db.get('SELECT COUNT(*) as count FROM entries WHERE featured=1'))[
                'COUNT(*)'
            ],
            addresses: (await db.get(
                'SELECT count(DISTINCT address) as count FROM addresses WHERE address IS NOT NULL'
            ))['count'],
            ips: (await db.all(
                'SELECT count(DISTINCT ip) as count FROM entries WHERE ip IS NOT NULL'
            ))['count'],
            actives: (await db.get("SELECT COUNT(*) as count FROM entries WHERE status='Active'"))[
                'COUNT(*)'
            ],
            inactives: (await db.get(
                "SELECT COUNT(*) as count FROM entries WHERE type='Inactive'"
            ))['COUNT(*)'],
            reporters: await db.all(
                'SELECT reporter,count(reporter) as count FROM entries WHERE reporter IS NOT NULL GROUP BY reporter'
            ),
            categories: await db.all(
                'SELECT category,count(category) as count FROM entries WHERE category IS NOT NULL GROUP BY category'
            ),
            subcategories: await db.all(
                'SELECT subcategory,count(subcategory) as count FROM entries WHERE subcategory IS NOT NULL GROUP BY subcategory'
            )
        }
    })
);
router.get('/v1/featured', async (req, res) =>
    res.json({
        success: true,
        result: await db.all(
            "SELECT id,name,description FROM entries WHERE type='verified' AND featured=1"
        )
    })
);
router.get('/v1/scams', async (req, res) =>
    res.json({
        success: true,
        result: await db.all(
            "SELECT id,url,path,category,subcategory,description,reporter,coin,ip,severity,statusCode,status,updated FROM entries WHERE type='scam'"
        )
    })
);
router.get('/v1/entry/:id', async (req, res) => {
    const entry: any = await db.get('SELECT * FROM entries WHERE id=?', req.params.id);
    if (!entry) {
        res.json({ success: false, message: "Couldn't find requested ID" });
    } else {
        entry.lookups = {};
        entry.abusereport = generateAbuseReport(new Scam(entry));
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
    const entries: any = await db.all('SELECT * FROM entries WHERE hostname=?', [
        req.params.domain
    ]);
    res.json({
        success: entries.length > 0,
        result: entries
    });
});
router.get('/v1/addresses', async (req, res) => {
    const result = {};
    const addresses: any = await db.all(
        'SELECT entries.*, addresses.address FROM addresses LEFT JOIN entries ON entries.id = addresses.entry'
    );
    addresses.forEach(entry => {
        if (!(entry.address in result)) result[entry.address] = [];
        result[entry.address].push(entry);
    });
    res.json({
        success: true,
        result: result
    });
});
router.get('/v1/ips', async (req, res) => {
    const result = {};
    const scams: any = await db.all('SELECT * FROM entries WHERE ip NOT NULL');
    scams.forEach(entry => {
        if (!(entry.ip in result)) result[entry.ip] = [];
        result[entry.ip].push(entry);
    });
    res.json({
        success: true,
        result: result
    });
});
router.get('/v1/verified', async (req, res) =>
    res.json({
        success: true,
        result: await db.all(
            "SELECT id,name,featured,description FROM entries WHERE type='verified'"
        )
    })
);
router.get('/v1/inactives', async (req, res) =>
    res.json({
        success: true,
        result: await db.all("SELECT * FROM entries WHERE status='Inactive'")
    })
);
router.get('/v1/actives', async (req, res) =>
    res.json({ success: true, result: await db.all("SELECT * FROM entries WHERE status='Active'") })
);
router.get('/v1/blacklist', async (req, res) =>
    res.json(
        ((await db.all("SELECT hostname FROM entries WHERE type='scam'")) as any).map(
            entry => entry.hostname
        )
    )
);
router.get('/v1/whitelist', async (req, res) =>
    res.json(
        ((await db.all("SELECT hostname FROM entries WHERE type='verified'")) as any).map(
            entry => entry.hostname
        )
    )
);
router.get('/v1/reportedlist', async (req, res) =>
    res.json(await db.all('SELECT * FROM reported'))
);
router.get('/v1/abusereport/:domain', (req, res) => {
    const result: any = db.get(
        "SELECT * FROM entries WHERE type='scam' AND (hostname=? OR hostname=? OR url=?)",
        [url.parse(req.params.domain).hostname, req.params.domain, req.params.domain]
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
            res.json({ success: true, input: address, coin: coin, result: retJson });
        } else {
            res.json({
                success: false,
                input: address,
                message: 'We do not support the queried coin yet.',
                coin: coin
            });
        }
    } else {
        /* Query was not specified */
        if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.search)) {
            /* Searched for an ETH/ETC address */
            const ethAccountBalance = await (() => {
                return new Promise(async (resolve, reject) => {
                    coins.forEach(async each => {
                        if (each.ticker === 'ETH') {
                            const returned = flatten(
                                await accountLookup(
                                    req.params.search,
                                    each.addressLookUp,
                                    each.addressEndpoint
                                )
                            );
                            if (returned.success === false) {
                                reject(0);
                            } else {
                                const end = 'body.' + each.addressEndpoint;
                                const ethBalance = returned[end];
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

            const etcAccountBalance = await (() => {
                return new Promise(async (resolve, reject) => {
                    coins.forEach(async each => {
                        if (each.ticker === 'ETC') {
                            const returned = flatten(
                                await accountLookup(
                                    req.params.search,
                                    each.addressLookUp,
                                    each.addressEndpoint
                                )
                            );
                            if (returned.success === false) {
                                reject(0);
                            } else {
                                const end = 'body.' + each.addressEndpoint;
                                const etcBalance = returned[end];
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
            debug(ethAccountBalance + ' - ' + etcAccountBalance);
            if (ethAccountBalance === -1 || etcAccountBalance === -1) {
                if (ethAccountBalance === -1) {
                    const retJson = await addressCheck(req.params.search, 'ETC');
                    res.json({
                        success: true,
                        input: req.params.search,
                        coin: 'ETC',
                        message: 'Unable to find account balance for ETH. Using ETC instead.',
                        result: retJson
                    });
                } else if (etcAccountBalance === -1) {
                    const retJson = await addressCheck(req.params.search, 'ETH');
                    res.json({
                        success: true,
                        input: req.params.search,
                        coin: 'ETH',
                        message: 'Unable to find account balance for ETC. Using ETH instead.',
                        result: retJson
                    });
                }
            } else {
                if (ethAccountBalance > etcAccountBalance) {
                    /* Searched for a ETH address */
                    const retJson = await addressCheck(req.params.search, 'ETH');
                    res.json({
                        success: true,
                        input: req.params.search,
                        coin: 'ETH',
                        result: retJson
                    });
                } else if (etcAccountBalance > ethAccountBalance) {
                    /* Searched for a ETC address */
                    const retJson = await addressCheck(req.params.search, 'ETC');
                    res.json({
                        success: true,
                        input: req.params.search,
                        coin: 'ETC',
                        result: retJson
                    });
                } else if (etcAccountBalance === 0 && ethAccountBalance === 0) {
                    /* No balance in ETH/ETC, defaulting to ETH */
                    const retJson = await addressCheck(req.params.search, 'ETH');
                    res.json({
                        success: true,
                        input: req.params.search,
                        coin: 'ETH',
                        result: retJson
                    });
                }
            }
        } else if (/((?:.eth)|(?:.luxe)|(?:.test))$/.test(req.params.search)) {
            /* Searched for an ENS name */
            if (/(?=([(a-z0-9A-Z)]{7,100})(?=(.eth|.luxe|.test|.xyz)$))/.test(req.params.search)) {
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
                        message: e.message
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
        } else if (/^([13][a-km-zA-HJ-NP-Z1-9]{25,34})/.test(req.params.search)) {
            /* Searched for an BTC/BCH address */
            if (
                /^((bitcoincash:)?(q|p)[a-z0-9]{41})|^((BITCOINCASH:)?(Q|P)[A-Z0-9]{41})$/.test(
                    req.params.search
                )
            ) {
                /* Searched for a BCH address */
                const retJson = await addressCheck(req.params.search, 'BCH');
                retJson.input = req.params.search;
                res.json(retJson);
            } else {
                const btcAccountBalance = await (() => {
                    return new Promise(async (resolve, reject) => {
                        coins.forEach(async each => {
                            if (each.ticker === 'BTC') {
                                const returned = flatten(
                                    await accountLookup(
                                        req.params.search,
                                        each.addressLookUp,
                                        each.addressEndpoint
                                    )
                                );
                                if (returned.success === false) {
                                    reject(0);
                                } else {
                                    const end = 'body.' + each.addressEndpoint;
                                    const btcBalance = returned[end];
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

                const bchAccountBalance = await (() => {
                    return new Promise(async (resolve, reject) => {
                        coins.forEach(async each => {
                            if (each.ticker === 'BCH') {
                                const returned = flatten(
                                    await accountLookup(
                                        req.params.search,
                                        each.addressLookUp,
                                        each.addressEndpoint
                                    )
                                );
                                if (returned.success === false) {
                                    reject(0);
                                } else {
                                    const end = 'body.' + each.addressEndpoint;
                                    const bchBalance = returned[end];
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
                if (btcAccountBalance === -1 || bchAccountBalance === -1) {
                    if (btcAccountBalance === -1) {
                        const retJson = await addressCheck(req.params.search, 'BCH');
                        res.json({
                            input: req.params.search,
                            success: true,
                            coin: 'BCH',
                            message:
                                'Unable to find account balance for Bitcoin. Using Bitcoin Cash instead.',
                            result: retJson
                        });
                    } else if (bchAccountBalance === -1) {
                        const retJson = await addressCheck(req.params.search, 'BTC');
                        res.json({
                            input: req.params.search,
                            success: true,
                            coin: 'BTC',
                            message:
                                'Unable to find account balance for Bitcoin Cash. Using Bitcoin instead.',
                            result: retJson
                        });
                    }
                } else {
                    if (btcAccountBalance > bchAccountBalance) {
                        /* Searched for a BTC address */
                        const retJson = await addressCheck(req.params.search, 'BTC');
                        res.json({
                            success: true,
                            input: req.params.search,
                            coin: 'BTC',
                            result: retJson
                        });
                    } else if (bchAccountBalance > btcAccountBalance) {
                        /* Searched for a BCH address */
                        const retJson = await addressCheck(req.params.search, 'BCH');
                        res.json({
                            success: true,
                            input: req.params.search,
                            coin: 'BCH',
                            result: retJson
                        });
                    } else if (
                        (bchAccountBalance === 0 && btcAccountBalance === 0) ||
                        btcAccountBalance === bchAccountBalance
                    ) {
                        /* No balance in BTC/BCH, defaulting to BTC */
                        const retJson = await addressCheck(req.params.search, 'BTC');
                        res.json({
                            success: true,
                            input: req.params.search,
                            coin: 'BTC',
                            result: retJson
                        });
                    }
                }
            }
        } else if (/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(req.params.search)) {
            /* Searched for a LTC address */
            const retJson = await addressCheck(req.params.search, 'LTC');
            res.json({
                success: true,
                input: req.params.search,
                coin: 'LTC',
                result: retJson
            });
        } else if (
            /[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/.test(
                req.params.search
            )
        ) {
            /* Searched for a domain */
            const entry: any = db.get('SELECT * FROM entries WHERE hostname=? OR url=?', [
                url.parse(req.params.search).hostname,
                req.params.search
            ]);
            if (entry && entry.type == 'verified') {
                res.json({
                    input: req.params.search,
                    success: true,
                    result: {
                        status: 'verified',
                        type: 'domain',
                        entries: [entry]
                    }
                });
            } else if (entry && entry.type == 'scam') {
                res.json({
                    input: req.params.search,
                    success: true,
                    result: {
                        status: 'blocked',
                        type: 'domain',
                        entries: [entry]
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
            const blacklistIP: any = await db.all(
                "SELECT * FROM entries WHERE ip=? AND type='scam'",
                [req.params.search]
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
});

/* Price endpoints */
router.get('/v1/price/:coin', async (req, res) => {
    if (req.params.coin) {
        const coin: any = await db.get('SELECT * FROM prices WHERE ticker=?', [
            req.params.coin.toLowerCase()
        ]);
        if (coin) {
            res.json({
                success: true,
                result: coin
            });
        } else {
            res.json({
                success: false,
                message: `Coin ${coin.ticker} is not supported by this app\'s configuration`
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
            const usdPrice: any = await db.get('SELECT * FROM prices WHERE ticker=?', [
                req.params.coin
            ]);
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
