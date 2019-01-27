import * as db from '../../utils/db';
import * as url from 'url';
import { Request, Response } from 'express';
import generateAbuseReport from '../../utils/abusereport';

export default async (req: Request, res: Response) => {
    const result: any = db.get(
        "SELECT * FROM entries WHERE type='scam' AND (hostname=? OR hostname=? OR url=?)",
        [url.parse(req.params.domain).hostname, req.params.domain, req.params.domain]
    );
    if (result) {
        res.json({ success: true, result: generateAbuseReport(result) });
    } else {
        res.json({ success: false, message: "URL wasn't found" });
    }
};
