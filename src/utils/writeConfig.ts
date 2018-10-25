import * as fs from 'fs-extra';

export interface ConfigOptions {
    'http-bottleneck': 'fast' | 'regular' | 'slow';
    'dns-servers': 'cloudflare' | 'google' | 'opendns';
    'http-timeout': 'highly-accurate' | 'accurate' | 'less-accurate';
    port: string;
    'cache-expiration': string;
    'cache-renewal': string;
    'database-persist': string;
    'google-safebrowsing': string;
    virustotal: string;
    pull: string;
    mode: 'safe' | 'full';
}

export default async (options: ConfigOptions): Promise<void> => {
    let httpMinTime: number | null = null;
    let httpMaxConcurrent: number | null = null;
    let httpTimeoutAfter: number | null = null;
    let dnsServers: string[] = [];

    if (options['http-bottleneck'] === 'fast') {
        httpMinTime = 0;
        httpMaxConcurrent = 200;
    } else if (options['http-bottleneck'] === 'regular') {
        httpMinTime = 100;
        httpMaxConcurrent = 20;
    } else if (options['http-bottleneck'] === 'slow') {
        httpMinTime = 500;
        httpMaxConcurrent = 5;
    }

    if (options['dns-servers'] === 'cloudflare') {
        dnsServers = ['1.1.1.1', '1.0.0.1'];
    } else if (options['dns-servers'] === 'google') {
        dnsServers = ['8.8.8.8', '8.8.4.4'];
    } else if (options['dns-servers'] === 'opendns') {
        dnsServers = ['208.67.222.222', '208.67.220.220'];
    }

    if (options['http-timeout'] === 'highly-accurate') {
        httpTimeoutAfter = null;
    } else if (options['http-timeout'] === 'accurate') {
        httpTimeoutAfter = 15 * 1000;
    } else if (options['http-timeout'] === 'less-accurate') {
        httpTimeoutAfter = 5 * 1000;
    }

    /* Define config */
    const config = {
        port: parseInt(options.port, 10),
        announcement: null,
        interval: {
            cacheExpiration: 1000 * 60 * parseInt(options['cache-expiration'], 10),
            cacheRenewCheck: 1000 * 60 * parseInt(options['cache-renewal'], 10),
            databasePersist: 1000 * parseInt(options['database-persist'], 10)
        },
        apiKeys: {
            Google_SafeBrowsing: options['google-safebrowsing'] || null,
            Github_WebHook: null,
            VirusTotal: options.virustotal || null
        },
        autoPull: {
            enabled: options.pull === 'on',
            interval: 1000 * 60 * 2,
            repository: {
                author: 'MrLuit',
                name: 'EtherScamDB',
                branch: 'master'
            }
        },
        lookups: {
            DNS: {
                servers: dnsServers,
                IP: {
                    enabled: options.mode === 'safe' || options.mode === 'full'
                },
                NS: {
                    enabled: options.mode === 'safe' || options.mode === 'full'
                }
            },
            HTTP: {
                enabled: options.mode === 'full',
                minTime: httpMinTime,
                maxConcurrent: httpMaxConcurrent,
                timeoutAfter: httpTimeoutAfter
            }
        }
    };

    /* Write config to file */
    await fs.writeJson('./config.json', config, { spaces: 4 });
};
