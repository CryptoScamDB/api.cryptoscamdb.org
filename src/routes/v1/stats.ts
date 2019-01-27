import * as db from '../../utils/db';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    const addresses: any = await db.get(
        'SELECT count(DISTINCT address) as count FROM addresses WHERE address IS NOT NULL'
    );
    const ips: any = await db.all(
        'SELECT count(DISTINCT ip) as count FROM entries WHERE ip IS NOT NULL'
    );
    res.json({
        success: true,
        result: {
            scams: (await db.get("SELECT COUNT(*) as count FROM entries WHERE type='scam'"))[
                'COUNT(*)'
            ],
            verified: (await db.get("SELECT COUNT(*) as count FROM entries WHERE type='verified'"))[
                'COUNT(*)'
            ],
            featured: (await db.get('SELECT COUNT(*) as count FROM entries WHERE featured=1'))[
                'COUNT(*)'
            ],
            addresses: addresses.count,
            ips: ips.count,
            actives: (await db.get("SELECT COUNT(*) as count FROM entries WHERE status='Active'"))[
                'COUNT(*)'
            ],
            inactives: (await db.get(
                "SELECT COUNT(*) as count FROM entries WHERE type='Inactive'"
            ))['COUNT(*)'],
            reporters: await db.all(
                'SELECT reporter,count(reporter) as count FROM entries WHERE reporter IS NOT NULL GROUP BY reporter'
            ),
            categories: await db.all(
                'SELECT category,count(category) as count FROM entries WHERE category IS NOT NULL GROUP BY category'
            ),
            subcategories: await db.all(
                'SELECT subcategory,count(subcategory) as count FROM entries WHERE subcategory IS NOT NULL GROUP BY subcategory'
            ),
            statuses: await db.all(
                'SELECT status,count(status) as count FROM entries WHERE status IS NOT NULL GROUP BY status'
            )
        }
    });
};
