import * as fs from 'fs';
import * as dns from '@cryptoscamdb/graceful-dns';
import * as Debug from 'debug';
import configCoin from '../models/configcoin';

const debug = Debug('config');

export interface Config {
    manual: boolean;
    port: number;
    interval: {
        cacheExpiration: number;
        cacheRenewCheck: number;
        databasePersist: number;
        priceLookup: number;
    };
    apiKeys: {
        Google_SafeBrowsing: string;
        Github_WebHook: string;
        Github_AccessKey: string;
        VirusTotal: string;
        Google_Captcha: string;
        Slack_Webhook: string;
    };
    autoPull: {
        enabled: boolean;
        interval?: number;
    };
    autoPR: {
        enabled: boolean;
        interval?: number;
        repository?: {
            username?: string;
            repository?: string;
        };
    };
    lookups: {
        DNS: {
            IP: {
                enabled: boolean;
            };
            NS: {
                enabled: boolean;
            };
        };
        HTTP: {
            enabled: boolean;
            minTime?: number;
            maxConcurrent?: number;
            timeoutAfter?: number;
        };
        ENS: {
            enabled: boolean;
            provider?: string;
        };
    };
    coins: configCoin[];
}

let configObject: Config;

if (!fs.existsSync('./config.json')) {
    /* Config wasn't found; return default config and show configuration page */
    configObject = {
        manual: false,
        port: 5111,
        interval: {
            cacheExpiration: -1,
            cacheRenewCheck: -1,
            databasePersist: -1,
            priceLookup: 300000
        },
        apiKeys: {
            Google_SafeBrowsing: undefined,
            Github_WebHook: undefined,
            Github_AccessKey: undefined,
            VirusTotal: undefined,
            Google_Captcha: undefined,
            Slack_Webhook: undefined
        },
        autoPull: { enabled: false },
        autoPR: {
            enabled: true,
            interval: 60000,
            repository: {
                username: 'CryptoScamDB',
                repository: 'blacklist'
            }
        },
        lookups: {
            DNS: {
                IP: { enabled: false },
                NS: { enabled: false }
            },
            HTTP: { enabled: false },
            ENS: { enabled: false }
        },
        coins: [
            {
                ticker: 'eth',
                priceSource: 'https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=USD',
                priceEndpoint: 'USD',
                addressLookUp:
                    'https://api.etherscan.io/api?module=account&action=balance&tag=latest&address=',
                addressEndpoint: 'result',
                decimal: 0
            }
        ]
    };
} else {
    /* Config was found */
    const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
    config.manual = true;
    if (!config.apiKeys.Google_SafeBrowsing) {
        debug('Warning: No Google SafeBrowsing API key found');
    }
    if (!config.apiKeys.VirusTotal) {
        debug('Warning: No VirusTotal API key found');
    }
    if (!config.apiKeys.Google_Captcha) {
        debug('Warning: No Google Captcha secret found');
    }
    if (!config.apiKeys.Github_AccessKey) {
        debug('Warning: No Github access key found');
    }
    if (!config.apiKeys.Slack_Webhook) {
        debug('Warning: No Slack Webhook found');
    }
    if (config.lookups.DNS.servers.length > 0) {
        dns.setServers(config.lookups.DNS.servers);
    }
    configObject = config;
}

export default configObject;
