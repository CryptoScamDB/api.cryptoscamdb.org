import * as db from '../../utils/db';
import * as url from 'url';
import { Request, Response } from 'express';
import { testCoinType } from '../../utils/testCoinType';
import addressCheck from '../../utils/addressCheck';
import * as Debug from 'debug';
import coins from '../../utils/endpoints';
import * as ensResolve from '../../utils/ensResolve';

const debug = Debug('routes:check');

export default async (req: Request, res: Response) => {
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
                const entry: any = await db.get(
                    'SELECT * FROM entries WHERE hostname=? OR hostname=? OR url=?',
                    [url.parse(req.params.search).hostname, req.params.search, req.params.search]
                );
                if (entry && entry.type === 'verified') {
                    res.json({
                        input: req.params.search,
                        success: true,
                        result: {
                            status: 'verified',
                            type: 'domain',
                            entries: [entry]
                        }
                    });
                } else if (entry && entry.type === 'scam') {
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
    }
};
