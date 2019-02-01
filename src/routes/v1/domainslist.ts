import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const result = await db.all('SELECT name,type FROM entries');
    res.json({
        success: true,
        result
    });
};
