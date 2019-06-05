import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    res.json({
        success: true,
        result: (await db.all("SELECT hostname FROM entries WHERE type='scam'")).map(
            entry => entry.hostname
        )
    });
};
