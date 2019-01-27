import * as db from '../../utils/db';
import { Request, Response } from 'express';
import { getGoogleSafeBrowsing, getURLScan, getVirusTotal } from '../../utils/lookup';
import generateAbuseReport from '../../utils/abusereport';
import Scam from '../../classes/scam.class';
import config from '../../utils/config';

export default async (req: Request, res: Response) => {
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
};
