import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const result = {};
    const scams: any = await db.all('SELECT * FROM entries WHERE ip NOT NULL');
    scams.forEach(entry => {
        if (!(entry.ip in result)) {
            result[entry.ip] = [];
        }
        result[entry.ip].push(entry);
    });
    res.json({
        success: true,
        result
    });
};
