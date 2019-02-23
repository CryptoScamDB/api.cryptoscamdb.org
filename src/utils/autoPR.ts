import { safeDump } from 'js-yaml';
import * as Debug from 'debug';
import gitProcess from '../classes/github.class';
import config from './config';

const debug = Debug('autoPR');

export const autoPR = async (input: any, githubKey: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        let pr;
        let fork;
        try {
            /* Create fork */
            const process = new gitProcess(githubKey) as any;
            fork = await createFork(process, githubKey);

            /* Try to commit */
            setTimeout(async () => {
                await createContents(fork, input);
            }, 1000);
            setTimeout(async () => {
                /* Try to pr */
                await processPR(process, fork);
            }, 2000);

            setTimeout(async () => {
                /* Delete fork */
                pr = await deleteFork(fork);
            }, 3000);

            resolve({ success: true });
        } catch (e) {
            /* If any issues are caught, delete fork */
            await deleteFork(fork);
            debug(e);
            reject(e);
        }
    });
};

export const createFork = (process, githubKey) => {
    return new Promise(async (resolve, reject) => {
        try {
            debug('Creating fork.');
            const fork = await process.fork('CryptoScamDB/blacklist', githubKey);
            resolve(fork);
        } catch (err) {
            debug('Err creating fork: ' + err);
            reject(err);
        }
    });
};

export const createContents = (fork, input) => {
    return new Promise(async (resolve, reject) => {
        try {
            debug('Adding contents to new fork.');
            await fork.createNew(
                'commands/cmd.yaml',
                'Added a new entry',
                safeDump(input, { lineWidth: 99999999, indent: 4 })
            );
            resolve();
        } catch (err) {
            debug('Err adding contents: ' + err);
            reject(err);
        }
    });
};

export const processPR = (process, fork) => {
    return new Promise(async (resolve, reject) => {
        try {
            debug('Creating pr from fork => head.');
            const pr = await process.pr('CryptoScamDB/blacklist', {
                title: 'Added a new entry',
                body: 'Added a new entry from cryptoscamdb.org/report endpoint',
                head: fork.getOwner() + ':' + fork.getBranch(),
                base: 'master'
            });
            resolve(pr);
        } catch (err) {
            debug('Err creating pr: ' + err);
            reject(err);
        }
    });
};

export const deleteFork = fork => {
    return new Promise(async (resolve, reject) => {
        try {
            debug('Deleting fork.');
            await fork.delete();
            resolve(true);
        } catch (err) {
            debug('Err deleting fork: ' + err);
            reject(err);
        }
    });
};
