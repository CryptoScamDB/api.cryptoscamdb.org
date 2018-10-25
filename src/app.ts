'use strict';

import * as Debug from 'debug';
import { fork } from 'child_process';
import * as express from 'express';
import * as path from 'path';
import * as fs from 'fs';
import * as helmet from 'helmet';
import * as db from './utils/db';
import * as github from './utils/github';
import config from './utils/config';
import writeConfig from './utils/writeConfig';
import router from './utils/router';

const debug = Debug('app');
const app = express();

export const update = async (): Promise<void> => {
    /* Create and write to cache.db */
    debug('Spawning update process...');
    const updateProcess = fork(path.join(__dirname, 'scripts/update.ts'));
    debug('Writing to cache.db');
    updateProcess.on('message', data => db.write(data.url, data));

    /* After db is initially written, write the cache.db every cacheRenewCheck-defined period */
    updateProcess.on('exit', () => {
        debug(
            'UpdateProcess completed - Next run is in ' +
                config.interval.cacheRenewCheck / 1000 +
                ' seconds.'
        );
        setTimeout(() => {
            this.update();
        }, config.interval.cacheRenewCheck);
    });
};

export const serve = async (electronApp?: any): Promise<void> => {
    /* Download datafiles if they aren't found yet */
    if (!fs.existsSync('data')) {
        await github.pullRaw();
    }

    /* Initiate database */
    await db.init();

    /* Allow both JSON and URL encoded bodies */
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    /* Set security headers */
    app.use(helmet());
    app.use(helmet.referrerPolicy());

    /* Set EJS config */
    app.set('view engine', 'ejs');
    app.set('views', path.join(__dirname, 'views/pages'));
    app.locals.environment = process.env.NODE_ENV;
    app.locals.announcement = config.announcement;
    app.locals.hasSlackWebhook = typeof config.apiKeys.Slack_Webhook === 'string';

    /* Compress pages */
    app.use(require('compression')());

    /* Serve static content*/
    app.use(express.static(path.join(__dirname, 'views/static')));

    /* Seperately re-serve various other brand logos to flatten nested paths */
    app.use('/assets', express.static(path.join(__dirname, 'views/static/assets/coins')));
    app.use('/assets', express.static(path.join(__dirname, 'views/static/assets/exchanges')));
    app.use('/assets', express.static(path.join(__dirname, 'views/static/assets/explorers')));
    app.use('/assets', express.static(path.join(__dirname, 'views/static/assets/wallets')));
    app.use('/assets', express.static(path.join(__dirname, 'views/static/assets/favicon')));
    app.use('/assets', express.static(path.join(__dirname, 'views/static/assets/branding')));

    /* Configuration middleware */
    app.use(async (req, res, next) => {
        const { NODE_ENV } = process.env;
        if (!config.manual && req.path !== '/config/' && NODE_ENV === 'development') {
            res.render('config', { production: false, done: false });
        } else if (!config.manual && req.path !== '/config/' && NODE_ENV === 'production') {
            res.render('config', { production: true, done: false });
        } else if (
            req.path === '/config' &&
            (req.method !== 'POST' || !req.body || config.manual)
        ) {
            res.status(403).end();
        } else if (req.path === '/config/' && req.method === 'POST' && !config.manual) {
            await writeConfig(req.body);
            if (electronApp) {
                electronApp.relaunch();
                electronApp.exit();
            } else {
                res.render('config', { production: false, done: true });
            }
        } else {
            next();
        }
    });

    /* Serve all other routes (see src/utils/router.js) */
    app.use(router);

    /* Serve all other pages as 404 */
    app.get('*', (req, res) => res.status(404).render('404'));

    /* Listen to port (defined in config */
    app.listen(config.port, () => debug('Content served on http://localhost:%s', config.port));

    /* Update scams after 100ms timeout (to process async) */
    setTimeout(() => this.update(), 100);

    /* If auto pulling from Github is enabled; schedule timer */
    if (config.autoPull.enabled) {
        setInterval(github.pullData, config.autoPull.interval);
    }
};

if (!module.parent) {
    this.serve().catch(console.error);
}
