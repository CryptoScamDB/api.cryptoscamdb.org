const github = require('octonode');
const Repo = require('./repo.class');

export default class Github {
    client?: any;

    constructor(accessToken) {
        this.client = github.client(accessToken);
    }

    fork(repo, accessToken) {
        return new Promise((resolve, reject) => {
            this.client.me().fork(repo, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(new Repo(this.client, result, accessToken));
                }
            });
        });
    }

    pr(repo, options) {
        return new Promise((resolve, reject) => {
            this.client.repo(repo).pr(options, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
}
