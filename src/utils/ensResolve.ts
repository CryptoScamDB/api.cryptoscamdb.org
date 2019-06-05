const ENS = require('ethereum-ens');
import web3 from './web3';

const ens = new ENS(web3);

export const resolve = async (ensname: string): Promise<any> => {
    const addressResolver = ens.resolver(ensname);
    const address = await addressResolver.addr();
    return address;
};
