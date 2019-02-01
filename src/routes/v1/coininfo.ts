import { Request, Response } from 'express';
import coins from '../../utils/endpoints';

export default async (req: Request, res: Response) => {
    res.json({
        success: true,
        result: coins.find(entry => entry.ticker === req.params.coin.toUpperCase())
    });
};
