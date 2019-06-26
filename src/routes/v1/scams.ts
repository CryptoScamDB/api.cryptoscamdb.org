import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    // Add a limit and skip (optional)
    let limit = 0;
    let skip = 0;
    if (req.query.limit && req.query.limit > 0) {
        limit = parseInt(req.query.limit);
    }

    if (req.query.skip && req.query.skip > 0) {
        skip = parseInt(req.query.skip);
    }

    const query =
        'SELECT e.id,e.name,e.url,e.path,e.category,e.subcategory,e.description,e.reporter' +
        ' FROM entries e' +
        " WHERE e.type='scam'" +
        (limit > 0 ? ' LIMIT ' + [skip, limit].join(',') : '');

    const result = await db.all(query);
    res.json({
        success: true,
        result
    });
};
