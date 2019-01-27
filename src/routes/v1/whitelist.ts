import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    res.json(
        ((await db.all("SELECT hostname FROM entries WHERE type='verified'")) as any).map(
            entry => entry.hostname
        )
    );
};
