import * as fs from 'fs';
import * as dns from '@cryptoscamdb/graceful-dns';
import * as Debug from 'debug';

const debug = Debug('config');

export interface Config {
    manual: boolean;
    announcement: string;
    port: number;
    interval: {
        cacheExpiration: number;
        cacheRenewCheck: number;
        databasePersist: number;
    };
    apiKeys: {
        Google_SafeBrowsing: string;
        Github_WebHook: string;
        VirusTotal: string;
        Google_Captcha: string;
        Slack_Webhook: string;
    };
    autoPull: {
        enabled: boolean;
        interval?: number;
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
    };
}

let configObject: Config;

if (!fs.existsSync('./config.json')) {
    /* Config wasn't found; return default config and show configuration page */
    configObject = {
        manual: false,
        announcement: null,
        port: 5111,
        interval: {
            cacheExpiration: -1,
            cacheRenewCheck: -1,
            databasePersist: -1
        },
        apiKeys: {
            Google_SafeBrowsing: undefined,
            Github_WebHook: undefined,
            VirusTotal: undefined,
            Google_Captcha: undefined,
            Slack_Webhook: undefined
        },
        autoPull: { enabled: false },
        lookups: {
            DNS: {
                IP: { enabled: false },
                NS: { enabled: false }
            },
            HTTP: { enabled: false }
        }
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
    if (!config.apiKeys.Slack_Webhook) {
        debug('Warning: No Slack Webhook found');
    }
    if (config.lookups.DNS.servers.length > 0) {
        dns.setServers(config.lookups.DNS.servers);
    }
    configObject = config;
}

export default configObject;
