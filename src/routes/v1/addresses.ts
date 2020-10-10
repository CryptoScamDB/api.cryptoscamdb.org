import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const query = [
        'SELECT entries.*, addresses.address FROM addresses LEFT JOIN entries ON entries.id = addresses.entry'
    ];
    if (req.query.ticker) {
        const ticker = req.query.ticker;
        // Validate and sanitize input
        if (ticker.match(/^[a-z]{3,5}$/i)) {
            query.push(`WHERE addresses.coin = '${ticker.toUpperCase()}'`);
        }
    }

    const result = {};
    const addresses: any = await db.all(query.join(' '));
    addresses.forEach(entry => {
        if (!(entry.address in result)) {
            result[entry.address] = [];
        }
        result[entry.address].push(entry);
    });
    res.json({
        success: true,
        result
    });
};
