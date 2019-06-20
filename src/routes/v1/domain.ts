import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const entry: any = await db.all(
        'SELECT e.* FROM entries e WHERE lower(name)=?',
        req.params.domain.toLowerCase()
    );
    if (!entry || entry.length === 0) {
        res.json({ success: false, message: "Couldn't find requested domain" });
    } else {
        entry[0].addresses = [];
        // Get the associated addresses
        const addresses: any = await db.all(
            'SELECT a.address, a.coin FROM addresses a WHERE a.entry = ?',
            entry[0].id
        );

        if (!addresses || addresses.length === 0) {
            // No addresses associated with domain :(
        } else {
            const addressesByCoin = {};
            addresses.map(addr => {
                if (addr.coin in addressesByCoin) {
                    addressesByCoin[addr.coin].push(addr.address);
                } else {
                    addressesByCoin[addr.coin] = [addr.address];
                }
            });
            entry[0].addresses = addressesByCoin;
        }

        res.json({ success: true, result: entry });
    }
};
