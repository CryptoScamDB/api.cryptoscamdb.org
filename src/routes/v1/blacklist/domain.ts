import * as db from '../../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const entry: any = await db.all("SELECT hostname FROM entries WHERE type='scam'");

    const domains: string[] = [];

    entry.map(e => {
        domains.push(e.hostname);
    });

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Dispositon', 'inline');
    res.send(domains.join('\r\n'));
};
