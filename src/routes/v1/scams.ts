import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const result = await db.all(
        "SELECT e.id,e.name,e.url,e.path,e.category,e.subcategory,e.description,e.reporter,a.address,a.coin FROM entries e WHERE e.type='scam'"
    );
    res.json({
        success: true,
        result
    });
};
