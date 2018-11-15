import { safeDump } from 'js-yaml';
import gitProcess from '../classes/github.class';
import config from './config';

export const autoPR = async (input: any, githubKey: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const process = new gitProcess(githubKey) as any;
        const fork = (await process.fork('CryptoScamDB/blacklist', githubKey)) as any;
        let pr;
        try {
            /* Try to commit */
            await fork.createNew(
                'commands/cmd.yaml',
                'Added a new entry',
                safeDump(input, { lineWidth: 99999999, indent: 4 })
            );
        } catch (e) {
            reject(e);
        }
        try {
            /* Try to pr */
            pr = await process.pr('CryptoScamDB/blacklist', {
                title: 'Added a new entry',
                body: 'Added a new entry from cryptoscamdb.org/report endpoint',
                head: fork.getOwner() + ':' + fork.getBranch(),
                base: 'master'
            });
            await fork.delete();
            if (pr.url) {
                resolve({ success: true, url: pr.url });
            } else {
                resolve({ success: true });
            }
        } catch (e) {
            await fork.delete();
            reject(e);
        }
    });
};
