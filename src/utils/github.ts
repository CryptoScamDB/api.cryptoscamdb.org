import * as download from 'download';
import * as crypto from 'crypto';
import config from './config';
import * as db from './db';
import * as Debug from 'debug';
import { Request, Response } from 'express';

const debug = Debug('github');

/* Pull yaml files from Github repos to data/whitelist_urls.yaml and data/blacklist_urls.yaml */
const pullDataFiles = async (): Promise<void> => {
    debug('Pulling data files...');
    await download(
        'https://raw.githubusercontent.com/CryptoScamDB/whitelist/master/data/urls.yaml',
        'data',
        { filename: 'whitelist_urls.yaml' }
    );
    await download(
        'https://raw.githubusercontent.com/CryptoScamDB/blacklist/master/data/urls.yaml',
        'data',
        { filename: 'blacklist_urls.yaml' }
    );
    debug('Done');
};

/* What to do on incoming Github webhook (new commit pushed) */
export const webhook = async (req: Request, res: Response, body: string): Promise<void> => {
    if (!config.apiKeys.Github_WebHook) {
        debug('Warning: Incoming Github Webhook attempt - but no secret was found in config');
        res.status(403).end();
    } else if (!('x-hub-signature' in req.headers)) {
        debug('Warning: Incoming Github Webhook attempt without x-hub-signature header');
        res.status(403).end();
    } else {
        const githubSig = Buffer.from(req.headers['x-hub-signature'] as string);
        const localSig = Buffer.from(
            'sha1=' +
                crypto
                    .createHmac('sha1', config.apiKeys.Github_WebHook)
                    .update(body)
                    .digest('hex')
        );
        if (crypto.timingSafeEqual(githubSig, localSig)) {
            debug('Valid incoming Github webhook!');
            await pullDataFiles();
            await db.readEntries();
            await db.updateIndex();
            await db.persist();
            res.status(200).end();
        } else {
            debug('Warning: Invalid Github webhook attempt');
            res.status(403).end();
        }
    }
};

export const pullRaw = pullDataFiles;

export const pullData = async (): Promise<void> => {
    await pullDataFiles();
    await db.readEntries();
    await db.updateIndex();
    await db.persist();
};
