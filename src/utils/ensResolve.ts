const ENS = require('ethereum-ens');
const Web3 = require('web3');

export const resolve = async (ensname: string): Promise<any> => {
    // tslint:disable-next-line:no-shadowed-variable
    return new Promise(async (resolve, reject) => {
        Web3.providers.HttpProvider.prototype.sendAsync =
            Web3.providers.HttpProvider.prototype.send;
        try {
            const provider = await new Web3('https://api.dev.blockscale.net/dev/parity');
            const ens = await new ENS(provider);
            const addressResolver = ens.resolver(ensname);
            const address = await addressResolver.addr();
            resolve(address);
        } catch (e) {
            reject('Failed to resolve ENS name.');
        }
    });
};
