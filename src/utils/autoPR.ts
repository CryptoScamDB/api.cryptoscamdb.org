import { safeDump, safeLoad } from 'js-yaml';
import * as gitProcess from './classes/github.class';
import config from './config';

export const autoPR = async (input: any, githubKey: string): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        const process = new gitProcess(githubKey);

        const fork = await process.fork(
            config.autoPR.repository.username + '/' + config.autoPR.repository.repository,
            githubKey
        );

        await fork.createNew(
            'commands/cmd.yaml',
            'Added ' + input.data.name,
            safeDump(input, { lineWidth: 99999999, indent: 4 })
        );

        await process.pr(
            config.autoPR.repository.username + '/' + config.autoPR.repository.repository,
            {
                title: 'Added a new entry',
                body: 'Added a new entry from cryptoscamdb.org/report endpoint ',
                head: fork.getOwner() + ':' + fork.getBranch(),
                base: 'master'
            }
        );

        await fork.delete();

        resolve(1);
    });
};
