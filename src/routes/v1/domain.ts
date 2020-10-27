import * as db from '../../utils/db';
import { Request, Response } from 'express';
import generateAbuseReport from '../../utils/abusereport';
import Scam from '../../classes/scam.class';
import { getGoogleSafeBrowsing, getURLScan, getVirusTotal } from '../../utils/lookup';
import config from '../../utils/config';

export default async (req: Request, res: Response) => {
    const entry: any = await db.all(
        'SELECT e.* FROM entries e WHERE lower(name)=?',
        req.params.domain.toLowerCase()
    );
    if (!entry || entry.length === 0) {
        res.json({ success: false, message: "Couldn't find requested domain" });
    } else {
        entry[0].addresses = [];
        // Get the associated addresses
        const addresses: any = await db.all(
            'SELECT a.address, a.coin FROM addresses a WHERE a.entry = ?',
            entry[0].id
        );

        if (!addresses || addresses.length === 0) {
            // No addresses associated with domain :(
        } else {
            const addressesByCoin = {};
            addresses.map(addr => {
                if (addr.coin in addressesByCoin) {
                    addressesByCoin[addr.coin].push(addr.address);
                } else {
                    addressesByCoin[addr.coin] = [addr.address];
                }
            });
            entry[0].addresses = addressesByCoin;
        }

        //const objScam = new Scam(entry[0]);
        //entry[0].abusereport = generateAbuseReport(objScam);

        entry[0].lookups = {};
        if (false && config.apiKeys.Google_SafeBrowsing) {
            entry[0].lookups.Google_SafeBrowsing = await getGoogleSafeBrowsing(entry[0].url);
        } else {
            entry[0].lookups.Google_SafeBrowsing = '';
        }
        if (false && config.apiKeys.VirusTotal) {
            entry[0].lookups.VirusTotal = await getVirusTotal(entry[0].url);
        } else {
            entry[0].lookups.VirusTotal = '';
        }
        entry[0].lookups.URLScan = await getURLScan(entry[0].hostname);

        res.json({ success: true, result: entry });
    }
};
