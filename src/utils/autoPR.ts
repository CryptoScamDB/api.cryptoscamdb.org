import { safeDump } from 'js-yaml';
import * as Debug from 'debug';
import gitProcess from '../classes/github.class';
import config from './config';

const debug = Debug('autoPR');

export const autoPR = async (input: any, githubKey: string): Promise<any> => {
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

        return {
            success: true
        };
    } catch (e) {
        /* If any issues are caught, delete fork */
        await deleteFork(fork);
        debug(e);
        throw e;
    }
};

export const createFork = async (process, githubKey) => {
    try {
        debug('Creating fork.');
        const fork = await process.fork('CryptoScamDB/blacklist', githubKey);
        return fork;
    } catch (err) {
        debug('Err creating fork: ' + err);
        throw err;
    }
};

export const createContents = async (fork, input) => {
    try {
        debug('Adding contents to new fork.');
        await fork.createNew(
            'commands/cmd.yaml',
            'Added a new entry',
            safeDump(input, { lineWidth: 99999999, indent: 4 })
        );
    } catch (err) {
        debug('Err adding contents: ' + err);
        throw err;
    }
};

export const processPR = async (process, fork) => {
    try {
        debug('Creating pr from fork => head.');
        const pr = await process.pr('CryptoScamDB/blacklist', {
            title: 'Added a new entry',
            body: 'Added a new entry from cryptoscamdb.org/report endpoint',
            head: fork.getOwner() + ':' + fork.getBranch(),
            base: 'master'
        });
        return pr;
    } catch (err) {
        debug('Err creating pr: ' + err);
        throw err;
    }
};

export const deleteFork = async fork => {
    try {
        debug('Deleting fork.');
        await fork.delete();
        return true;
    } catch (err) {
        debug('Err deleting fork: ' + err);
        throw err;
    }
};
