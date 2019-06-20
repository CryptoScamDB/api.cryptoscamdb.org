import * as Utils from 'web3-utils';

export const getID = (input): string => {
    const sha: string = Utils.sha3(input).substring(2, 8);
    return sha;
};
