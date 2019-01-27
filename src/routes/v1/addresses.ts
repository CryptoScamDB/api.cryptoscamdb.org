import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const result = {};
    const addresses: any = await db.all(
        'SELECT entries.*, addresses.address FROM addresses LEFT JOIN entries ON entries.id = addresses.entry'
    );
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
