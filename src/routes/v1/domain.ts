import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const entry: any = await db.all('SELECT * FROM entries WHERE name=?', req.params.domain);
    if (!entry) {
        res.json({ success: false, message: "Couldn't find requested domain" });
    } else {
        res.json({ success: true, result: entry });
    }
};
