const Web3 = require('web3');

Web3.providers.HttpProvider.prototype.sendAsync = Web3.providers.HttpProvider.prototype.send;

export default new Web3('https://api.mycryptoapi.com/eth');
