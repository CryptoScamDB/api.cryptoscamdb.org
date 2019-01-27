import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const result = await db.all(
        "SELECT id,url,path,category,subcategory,description,reporter,coin,ip,severity,statusCode,status,updated FROM entries WHERE type='scam'"
    );
    res.json({
        success: true,
        result
    });
};
