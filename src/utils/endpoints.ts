interface ConfigCoin {
    ticker: string;
    priceSource: string;
    priceEndpoint: string;
    addressLookUp: string;
    addressEndpoint: string;
    decimal: number;
}

export default [
    {
        ticker: 'ETH',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp:
            'https://api.etherscan.io/api?module=account&action=balance&tag=latest&address=',
        addressEndpoint: 'result',
        decimal: 18
    },
    {
        ticker: 'ETC',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=ETC&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://api.nanopool.org/v1/etc/balance/',
        addressEndpoint: 'data',
        decimal: 18
    },
    {
        ticker: 'BTC',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://api.blockcypher.com/v1/btc/main/addrs/',
        addressEndpoint: 'balance',
        decimal: 8
    },
    {
        ticker: 'BCH',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=BCH&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://bch-chain.api.btc.com/v3/address/',
        addressEndpoint: 'data.balance',
        decimal: 8
    },
    {
        ticker: 'LTC',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=LTC&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://api.blockcypher.com/v1/ltc/main/addrs/',
        addressEndpoint: 'balance',
        decimal: 8
    }
];
