import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    res.json(await db.all('SELECT * FROM reported'));
};
