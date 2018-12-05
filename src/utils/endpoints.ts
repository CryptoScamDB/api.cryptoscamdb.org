interface ConfigCoin {
    ticker: string;
    priceSource: string;
    priceEndpoint: string;
    addressLookUp: string;
    addressEndpoint: string;
    decimal: number;
    regex: string;
}

export default [
    {
        ticker: 'ETH',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp:
            'https://api.etherscan.io/api?module=account&action=balance&tag=latest&address=',
        addressEndpoint: 'result',
        decimal: 18,
        regex: '^0x?[0-9A-Fa-f]{40,42}$'
    },
    {
        ticker: 'ETC',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=ETC&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp:
            'https://blockscout.com/etc/mainnet/api?module=account&action=balance&address=',
        addressEndpoint: 'result',
        decimal: 18,
        regex: '^0x?[0-9A-Fa-f]{40,42}$'
    },
    {
        ticker: 'BTC',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=BTC&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://api.blockcypher.com/v1/btc/main/addrs/',
        addressEndpoint: 'balance',
        decimal: 8,
        regex: '^([13][a-km-zA-HJ-NP-Z1-9]{25,34})'
    },
    {
        ticker: 'BCH',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=BCH&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://bch-chain.api.btc.com/v3/address/',
        addressEndpoint: 'data.balance',
        decimal: 8,
        regex:
            '^([13][a-km-zA-HJ-NP-Z1-9]{25,34})|^((bitcoincash:)?(q|p)[a-z0-9]{41})|^((BITCOINCASH:)?(Q|P)[A-Z0-9]{41})$'
    },
    {
        ticker: 'LTC',
        priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=LTC&tsyms=USD',
        priceEndpoint: 'USD',
        addressLookUp: 'https://api.blockcypher.com/v1/ltc/main/addrs/',
        addressEndpoint: 'balance',
        decimal: 8,
        regex: '^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$'
    }
];
