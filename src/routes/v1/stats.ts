import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const addresses: any = await db.get(
        'SELECT count(DISTINCT address) as count FROM addresses WHERE address IS NOT NULL'
    );
    const ips: any = await db.all(
        'SELECT count(DISTINCT ip) as count FROM entries WHERE ip IS NOT NULL'
    );
    const statuses: any = await db.all(
        'SELECT status,count(status) as count FROM entries WHERE status IS NOT NULL GROUP BY status'
    );
    const scamTypes: any = await db.all(
        'SELECT type,count(type) as count FROM entries WHERE type IS NOT NULL GROUP BY type'
    );
    const featured: any = await db.get('SELECT COUNT(*) as count FROM entries WHERE featured=1');
    res.json({
        success: true,
        result: {
            scams: scamTypes.find(en => en.type === 'scam').count,
            verified: scamTypes.find(en => en.type === 'verified').count,
            featured: featured.count,
            addresses: addresses.count,
            ips: ips.count,
            actives: statuses.length > 0 ? statuses.find(en => en.status === 'Active').count : -1,
            inactives:
                statuses.length > 0
                    ? statuses.find(en => en.status === 'Inactive').count +
                      statuses.find(en => en.status === 'Offline').count
                    : 0,
            offline: statuses.length > 0 ? statuses.find(en => en.status === 'Offline').count : -1,
            suspended:
                statuses.length > 0 ? statuses.find(en => en.status === 'Suspended').count : -1,
            reporters: await db.all(
                'SELECT reporter,count(reporter) as count FROM entries WHERE reporter IS NOT NULL GROUP BY reporter'
            ),
            categories: await db.all(
                'SELECT category,count(category) as count FROM entries WHERE category IS NOT NULL GROUP BY category'
            ),
            subcategories: await db.all(
                'SELECT subcategory,count(subcategory) as count FROM entries WHERE subcategory IS NOT NULL GROUP BY subcategory'
            )
        }
    });
};
