import { utils } from 'web3';

export const getID = (input): string => {
    const sha: string = utils.sha3(input).substring(2, 8);
    return sha;
};
