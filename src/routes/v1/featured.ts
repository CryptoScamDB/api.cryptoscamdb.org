import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    res.json({
        success: true,
        result: await db.all(
            "SELECT id,name,description,url FROM entries WHERE type='verified' AND featured=1"
        )
    });
};
