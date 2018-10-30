const github = require('octonode');

const Content = class Content {
	constructor(repo, sha, accessToken) {
		this.repo = repo;
		this.sha = sha;
		this.accessToken = accessToken
	}

	update(path,message,content) {
		return new Promise((resolve,reject) => {
			this.repo.updateContents(path,message,content,this.sha,(err,result) => {
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
  }
  
}

const Repo = class Repo {
	constructor(client,repo, accessToken) {
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

	contents(path, accessToken) {
		return new Promise((resolve,reject) => {
			this.repo.contents(path, async (err,result) => {
				if(err) {
					var sha = await getSha(accessToken).then(function(output) {
						return(output);
					})
					resolve(new Content(this.repo,sha, accessToken));
				} else {
					resolve(new Content(this.repo,result.sha, accessToken));
				}
			});
		});
  }
  
  createNew(path, message, content) {
    return new Promise((resolve,reject) => {
			this.repo.createContents(path, message, content, (err,result) => {
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
  }

  delete() {
    return new Promise(async (resolve, reject) => {
      await this.repo.destroy((err,result) => {
				if(err) {
					reject(err);
				} else {
					resolve(result);
        }
      });
    });
  }
}

const Github = class Github {
	constructor(access_token) {
		this.client = github.client(access_token);
	}

	fork(repo, accessToken) {
		return new Promise((resolve,reject) => {
			this.client.me().fork(repo, (err,result) => {
				if(err) {
					reject(err);
				} else {
					resolve(new Repo(this.client, result, accessToken));
				}
			});
		});
	}

	pr(repo,options) {
		return new Promise((resolve,reject) => {
			this.client.repo(repo).pr(options,(err,result) => {
				if(err) {
					reject(err);
				} else {
					resolve(result);
				}
			});
		});
	}
}

module.exports = Github;