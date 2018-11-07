const github = require('octonode');

const Repo = class Repo {
    client?: any;
    parent?: any;
    accessToken?: any;
    repo?: any;

    constructor(client, repo, accessToken) {
        this.client = client;
        this.parent = repo;
        this.accessToken = accessToken;
        this.repo = client.repo(repo.full_name);
    }

    getOwner() {
        return this.parent.owner.login;
    }

    getBranch() {
        return this.parent.default_branch;
    }

    createNew(path, message, content) {
        return new Promise((resolve, reject) => {
            this.repo.createContents(path, message, content, (err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }

    delete() {
        return new Promise(async (resolve, reject) => {
            await this.repo.destroy((err, result) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(result);
                }
            });
        });
    }
};

const Github = class Github {
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
};

export default Github;
