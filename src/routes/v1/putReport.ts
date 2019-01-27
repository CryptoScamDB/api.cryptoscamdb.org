import config from '../../utils/config';
import { Request, Response } from 'express';
import { apiKeyOwner } from '../../utils/apiKeyTest';
import { categorizeUrl } from '../../utils/categorize';
import * as db from '../../utils/db';
import * as Debug from 'debug';

const debug = Debug('route:report');

export default async (req: Request, res: Response) => {
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
};
