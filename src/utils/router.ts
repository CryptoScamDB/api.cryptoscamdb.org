import { version } from '../../package.json';
import { Router, Request, Response } from 'express';

import index from '../routes/index';
import stats from '../routes/v1/stats';
import featured from '../routes/v1/featured';
import scams from '../routes/v1/scams';
import entry from '../routes/v1/entry';
import domain from '../routes/v1/domain';
import addresses from '../routes/v1/addresses';
import ips from '../routes/v1/ips';
import verified from '../routes/v1/verified';
import inactives from '../routes/v1/inactives';
import actives from '../routes/v1/actives';
import blacklist from '../routes/v1/blacklist';
import whitelist from '../routes/v1/whitelist';
import reportedlist from '../routes/v1/reportedlist';
import abusereport from '../routes/v1/abusereport';
import price from '../routes/v1/price';
import check from '../routes/v1/check';
import balance from '../routes/v1/balance';
import coininfo from '../routes/v1/coininfo';
import postReport from '../routes/v1/postReport';
import putReport from '../routes/v1/putReport';
import update from '../routes/update';
import fallback from '../routes/fallback';

const router = Router();

/* Send CSDB-Version header */
router.use((req: Request, res: Response, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('CSDB-Version', version);
    next();
});

router.get('/', index);
router.get('/v1/stats', stats);
router.get('/v1/featured', featured);
router.get('/v1/scams', scams);
router.get('/v1/entry/:id', entry);
router.get('/v1/domain/:domain', domain);
router.get('/v1/addresses', addresses);
router.get('/v1/ips', ips);
router.get('/v1/verified', verified);
router.get('/v1/inactives', inactives);
router.get('/v1/actives', actives);
router.get('/v1/blacklist', blacklist);
router.get('/v1/whitelist', whitelist);
router.get('/v1/reportedlist', reportedlist);
router.get('/v1/abusereport/:domain', abusereport);
router.get('/v1/price/:coin', price);
router.get('/v1/check/:search', check);
router.get('/v1/balance/:coin/:address', balance);
router.get('/v1/coininfo/:coin', coininfo);
router.post('/v1/report', postReport);
router.put('/v1/report', putReport);
router.post('/update/', update);
router.get('/*', fallback);

export default router;
