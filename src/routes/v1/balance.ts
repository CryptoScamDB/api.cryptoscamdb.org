import * as db from '../../utils/db';
import { Request, Response } from 'express';
import { balanceLookup } from '../../utils/balanceLookup';
import coins from '../../utils/endpoints';

export default async (req: Request, res: Response) => {
    const coin = req.params.coin.toUpperCase();
    try {
        const index = coins.findIndex(entry => entry.ticker === coin);
        const returnedBal = await balanceLookup(req.params.address, coin);
        if (returnedBal === -1) {
            res.json({
                success: false,
                inputcoin: coin,
                inputaddress: req.params.address,
                message: 'Failed to lookup balance.'
            });
        } else {
            const decimal = Number(coins[index].decimal);
            const balance = Number(returnedBal.balance);
            const usdPrice: any = await db.get('SELECT * FROM prices WHERE ticker=?', [
                req.params.coin.toUpperCase()
            ]);
            const value = balance * Math.pow(10, Math.round(-1 * decimal));
            const blockexplorer = coins.find(entry => entry.ticker === coin).blockExplorer;
            res.json({
                success: true,
                blockexplorer: blockexplorer + req.params.address,
                balance: value,
                usdvalue: usdPrice.price * value
            });
        }
    } catch (e) {
        res.json({
            success: false,
            message: e.message
        });
    }
};
