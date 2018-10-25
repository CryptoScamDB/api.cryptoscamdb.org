import * as request from 'request';
import config from './config';
import * as Debug from 'debug';
import Bottleneck from 'bottleneck';

const debug = Debug('lookup');

/**
 * Basic URLScan API typings.
 */
export interface URLScanResponse {
    results: {
        task: {
            visibility: string;
            method: string;
            time: string;
            source: string;
            url: string;
        };
        stats: {
            uniqIPs: number;
            consoleMsgs: number;
            dataLength: number;
            encodedDataLength: number;
            requests: number;
        };
        page: {
            country: string;
            server: string;
            city: string;
            domain: string;
            ip: string;
            asnname: string;
            asn: string;
            url: string;
            ptr: string;
        };
        uniq_countries: number;
        _id: string;
        result: string;
    }[];
    total: number;
}

/**
 * Basic Google SafeBrowsing API typings.
 */
export interface SafeBrowsingResponse {
    statusCode: number;
    body: {
        matches: {
            threatType: string;
            platformType: string;
            threatEntryType: string;
            threat: {
                url: string;
            };
            threatEntryMetadata: {
                entries: {
                    key: string;
                    value: string;
                }[];
            };
            cacheDuration: string;
        };
    };
    headers: {
        [name: string]: string;
    };
    request: {
        uri: {
            protocol: string;
            slashes: boolean;
            auth: string;
            host: string;
            port: number;
            hostname: string;
            hash: string;
            search: string;
            query: string;
            pathname: string;
            path: string;
            href: string;
        };
        method: string;
        headers: {
            [name: string]: string;
        };
    };
}

/**
 * Basic VirusTotal API typings.
 */
export interface VirusTotalResponse {
    scan_id: string;
    resource: string;
    url: string;
    response_code: number;
    scan_date: string;
    permalink: string;
    verbose_msg: string;
    filescan_id: number | null;
    positives: number;
    total: number;
    scans: {
        [name: string]: {
            detected: boolean;
            result: string;
        };
    };
}

/* Create Bottleneck limiter for HTTP lookups with limits defined in config */
const limiter = new Bottleneck({
    minTime: config.lookups.HTTP.minTime,
    maxConcurrent: config.lookups.HTTP.maxConcurrent
});

/* Do a URL lookup */
export const lookup = limiter.wrap(url => {
    return new Promise<request.Response | undefined>(resolve => {
        debug('Requesting ' + url + '...');
        request(
            {
                url,
                timeout: config.lookups.HTTP.timeoutAfter,
                followAllRedirects: true,
                maxRedirects: 5
            },
            (err, response) => {
                if (err) {
                    resolve(undefined);
                } else {
                    resolve(response);
                }
            }
        );
    });
});

/* Retrieve latest Urlscan report (no API key required) */
export const getURLScan = (url: string): Promise<URLScanResponse> => {
    return new Promise<URLScanResponse>((resolve, reject) => {
        request(
            'https://urlscan.io/api/v1/search/?q=domain%3A' + url,
            { json: true },
            (err, response, body) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(body);
                }
            }
        );
    });
};

/* Retrieve Google SafeBrowsing status for URL */
export const getGoogleSafeBrowsing = (url): Promise<SafeBrowsingResponse | boolean> => {
    return new Promise<SafeBrowsingResponse | boolean>((resolve, reject) => {
        debug('Google SafeBrowsing: %o', url);
        request(
            {
                url:
                    'https://safebrowsing.googleapis.com/v4/threatMatches:find?key=' +
                    encodeURIComponent(config.apiKeys.Google_SafeBrowsing),
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                json: {
                    client: {
                        clientId: 'EtherScamDB',
                        clientVersion: '3.0.0'
                    },
                    threatInfo: {
                        threatTypes: [
                            'THREAT_TYPE_UNSPECIFIED',
                            'MALWARE',
                            'SOCIAL_ENGINEERING',
                            'UNWANTED_SOFTWARE',
                            'POTENTIALLY_HARMFUL_APPLICATION'
                        ],
                        platformTypes: [
                            'PLATFORM_TYPE_UNSPECIFIED',
                            'WINDOWS',
                            'LINUX',
                            'ANDROID',
                            'OSX',
                            'IOS',
                            'ANY_PLATFORM',
                            'ALL_PLATFORMS',
                            'CHROME'
                        ],
                        threatEntryTypes: ['THREAT_ENTRY_TYPE_UNSPECIFIED', 'URL', 'EXECUTABLE'],
                        threatEntries: [
                            {
                                url
                            }
                        ]
                    }
                }
            },
            (err, response, body) => {
                debug('%s returned %s %o', url, response ? response.statusCode : -1, body);
                if (err) {
                    reject(err);
                } else if (response.statusCode !== 200) {
                    reject('Google SafeBrowsing returned an invalid status code');
                } else if (body && body.matches && body.matches[0]) {
                    resolve(body.matches[0]);
                } else {
                    resolve(false);
                }
            }
        );
    });
};

/* Retrieve latest VirusTotal report */
export const getVirusTotal = (url): Promise<VirusTotalResponse> => {
    return new Promise<VirusTotalResponse>((resolve, reject) => {
        request(
            {
                uri:
                    'https://www.virustotal.com/vtapi/v2/url/report?apikey=' +
                    encodeURIComponent(config.apiKeys.VirusTotal) +
                    '&resource=' +
                    url,
                method: 'GET',
                json: true
            },
            (err, response, body) => {
                if (err) {
                    reject(err);
                } else if (response.statusCode !== 200) {
                    reject('VirusTotal returned an invalid status code');
                } else if (body.response_code === 0) {
                    reject('VirusTotal returned an invalid internal status code');
                } else {
                    resolve(body);
                }
            }
        );
    });
};
