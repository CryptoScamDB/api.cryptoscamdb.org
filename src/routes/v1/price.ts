import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    if (req.params.coin) {
        const coin: any = await db.get('SELECT * FROM prices WHERE ticker=?', [
            req.params.coin.toUpperCase()
        ]);
        if (coin) {
            res.json({
                success: true,
                result: coin
            });
        } else {
            res.json({
                success: false,
                message: `Coin ${coin.ticker} is not supported by this app\'s configuration`
            });
        }
    } else {
        res.json({
            success: false,
            message: `You did not input a coin type.`
        });
    }
};
