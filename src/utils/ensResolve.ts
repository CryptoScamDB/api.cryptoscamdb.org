const ENS = require('ethereum-ens');
const Web3 = require('web3');

export const resolve = async (ensname, web3provider): Promise<any> => {
    return new Promise(async (resolve, reject) => {
        Web3.providers.HttpProvider.prototype.sendAsync =
            Web3.providers.HttpProvider.prototype.send;
        try {
            const provider = await new Web3(web3provider);
            let ens = await new ENS(provider);
            const addressResolver = ens.resolver(ensname);
            let address = await addressResolver.addr();
            resolve(address);
        } catch (e) {
            reject('Failed to resolve ENS name.');
        }
    });
};
