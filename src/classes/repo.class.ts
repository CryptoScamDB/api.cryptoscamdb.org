export default class Repo {
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
}
