import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const verified = await db.all(
        "SELECT e.id, e.name, e.featured, e.description, a.address, a.coin FROM entries e LEFT JOIN addresses a ON a.entry = e.id WHERE e.type='verified'"
    );

    res.json({
        success: true,
        result: verified
    });
};
