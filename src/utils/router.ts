import { name, version } from '../../package.json';
import * as express from 'express';
import * as db from './db';
import generateAbuseReport from './abusereport';
import * as checkForPhishing from 'eth-phishing-detect';
import * as dateFormat from 'dateformat';
import * as url from 'url';
import config from './config';
import * as github from './github';
import * as isIpPrivate from 'private-ip';
import * as captcha from './gcaptcha';
import * as slack from './slack';
import { getGoogleSafeBrowsing, getURLScan, getVirusTotal } from './lookup';

const router = express.Router();

/* Send CSDB-Version header */
router.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('CSDB-Version', version);
    next();
});

router.get('/', (req, res) => res.send(name + ' ' + version));

router.get('/v1/scams', (req, res) => res.json({ success: true, result: db.read().scams }));
router.get('/v1/addresses', (req, res) =>
    res.json({ success: true, result: db.read().index.addresses })
);
router.get('/v1/ips', (req, res) => res.json({ success: true, result: db.read().index.ips }));
router.get('/v1/verified', (req, res) => res.json({ success: true, result: db.read().verified }));
router.get('/v1/inactives', (req, res) =>
    res.json({ success: true, result: db.read().index.inactives })
);
router.get('/v1/actives', (req, res) =>
    res.json({ success: true, result: db.read().index.actives })
);
router.get('/v1/blacklist', (req, res) => res.json(db.read().index.blacklist));
router.get('/v1/whitelist', (req, res) => res.json(db.read().index.whitelist));
router.get('/v1/abusereport/:domain', (req, res) => {
    const result = db
        .read()
        .scams.find(
            scam =>
                scam.getHostname() === url.parse(req.params.domain).hostname ||
                scam.url.replace(/(^\w+:|^)\/\//, '') === req.params.domain
        );
    if (result) {
        res.json({ success: true, result: generateAbuseReport(result) });
    } else {
        res.json({ success: false, message: "URL wasn't found" });
    }
});
router.get('/v1/check/:search', (req, res) => {
    if (/^0x?[0-9A-Fa-f]{40,42}$/.test(req.params.search)) {
        /* Searched for an ethereum address */
        const whitelistAddress = Object.keys(db.read().index.whitelistAddresses).find(
            address => req.params.search.toLowerCase() === address.toLowerCase()
        );
        const blacklistAddress = Object.keys(db.read().index.addresses).find(
            address => req.params.search.toLowerCase() === address.toLowerCase()
        );
        if (whitelistAddress) {
            res.json({
                success: true,
                result: 'whitelisted',
                type: 'address',
                entries: db.read().index.whitelistAddresses[whitelistAddress]
            });
        } else if (blacklistAddress) {
            res.json({
                success: true,
                result: 'blocked',
                type: 'address',
                entries: db.read().index.addresses[blacklistAddress]
            });
        } else {
            res.json({
                success: true,
                result: 'neutral',
                type: 'address',
                entries: []
            });
        }
    } else if (
        /[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/.test(
            req.params.search
        )
    ) {
        /* Searched for a domain */
        const whitelistURL = db
            .read()
            .verified.find(
                entry =>
                    (url.parse(req.params.search).hostname || req.params.search) ===
                    url.parse(entry.url).hostname
            );
        const blacklistURL = db
            .read()
            .scams.find(
                entry =>
                    (url.parse(req.params.search).hostname || req.params.search) ===
                    entry.getHostname()
            );
        if (whitelistURL) {
            res.json({
                success: true,
                result: 'verified',
                type: 'domain',
                entries: [whitelistURL]
            });
        } else if (blacklistURL) {
            res.json({
                success: true,
                result: 'blocked',
                type: 'domain',
                entries: [blacklistURL]
            });
        } else {
            res.json({
                success: true,
                result: 'neutral',
                type: 'domain',
                entries: []
            });
        }
    } else if (
        /^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$|^(([a-zA-Z]|[a-zA-Z][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z]|[A-Za-z][A-Za-z0-9\-]*[A-Za-z0-9])$|^\s*((([0-9A-Fa-f]{1,4}:){7}([0-9A-Fa-f]{1,4}|:))|(([0-9A-Fa-f]{1,4}:){6}(:[0-9A-Fa-f]{1,4}|((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){5}(((:[0-9A-Fa-f]{1,4}){1,2})|:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})|:))|(([0-9A-Fa-f]{1,4}:){4}(((:[0-9A-Fa-f]{1,4}){1,3})|((:[0-9A-Fa-f]{1,4})?:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){3}(((:[0-9A-Fa-f]{1,4}){1,4})|((:[0-9A-Fa-f]{1,4}){0,2}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){2}(((:[0-9A-Fa-f]{1,4}){1,5})|((:[0-9A-Fa-f]{1,4}){0,3}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(([0-9A-Fa-f]{1,4}:){1}(((:[0-9A-Fa-f]{1,4}){1,6})|((:[0-9A-Fa-f]{1,4}){0,4}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:))|(:(((:[0-9A-Fa-f]{1,4}){1,7})|((:[0-9A-Fa-f]{1,4}){0,5}:((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}))|:)))(%.+)?\s*$/.test(
            req.params.search
        )
    ) {
        /* Searched for an ip address */
        const blacklistIP = Object.keys(db.read().index.ips).filter(
            ip => req.params.search.toLowerCase() === ip.toLowerCase()
        );
        if (blacklistIP.length > 0) {
            res.json({
                success: true,
                result: 'blocked',
                type: 'ip',
                entries: blacklistIP
            });
        } else {
            res.json({
                success: true,
                result: 'neutral',
                type: 'ip',
                entries: []
            });
        }
    } else {
        res.json({
            success: false,
            message: 'Incorrect search type (must be ethereum address / ip address / URL)'
        });
    }
});

/* Incoming user reports */
router.post('/v1/report/', async (req, res) => {
    if (
        config.apiKeys.Google_Captcha &&
        config.apiKeys.Slack_Webhook &&
        req.body &&
        req.body.args &&
        req.body.args.captcha
    ) {
        const isValidCaptcha = await captcha.verifyResponse(req.body.args.captcha);
        if (isValidCaptcha) {
            slack.sendReport(req.body);
            res.json({
                success: true
            });
        } else {
            res.json({
                success: false,
                message: 'Invalid captcha response provided'
            });
        }
    } else if (config.apiKeys.Slack_Webhook && req.body && req.body.args && req.body.args.captcha) {
        slack.sendReport(req.body);
        res.json({
            success: true
        });
    } else {
        res.json({
            success: false,
            message: 'No captcha response provided'
        });
    }
});

/* Redirect old API requests */
router.get('/:all*?', (req, res) => res.redirect('/v1/' + req.params.all));

/* Incoming Github webhook attempt */
router.post('/update/', (req, res) => {
    let body = '';

    req.setEncoding('utf8');
    req.on('data', chunk => (body += chunk));
    req.on('end', () => github.webhook(req, res, body));
});

export default router;
