import { parse } from 'url';
import * as dns from '@cryptoscamdb/graceful-dns';
import { lookup, getURLScan, URLScanResponse } from '../utils/lookup';
import { Response } from 'request';
import Entry from '../models/entry';

export default class Scam implements Entry {
    url?: string;
    name?: string;
    category?: string;
    subcategory?: string;
    description?: string;
    addresses?: string[];
    reporter?: string;
    coin?: string;
    ip?: string;
    nameservers?: string[];
    statusCode?: number;
    status?: 'Active' | 'Inactive' | 'Offline' | 'Suspended';
    updated?: number;

    /* Create new Scam instance */
    constructor(scamData: Entry = {}) {
        if (scamData.url) {
            this.name = parse(scamData.url).hostname.replace('www.', '');
            this.url = scamData.url;
        }
        this.category = scamData.category;
        this.subcategory = scamData.subcategory;
        this.description = scamData.description;
        this.addresses = scamData.addresses;
        this.reporter = scamData.reporter;
        this.coin = scamData.coin;
    }

    /* Returns either `false` or a request response */
    async lookup(): Promise<Response | undefined> {
        return lookup(this.url);
    }

    /* Returns URL hostname (domain.example) */
    getHostname(): string {
        return parse(this.url).hostname;
    }

    /* Returns IP from URL */
    async getIP(): Promise<string> {
        this.ip = await dns.getIP(this.url);
        return this.ip;
    }

    /* Returns nameservers from URL */
    async getNameservers(): Promise<string[]> {
        this.nameservers = await dns.getNS(this.url);
        return this.nameservers;
    }

    /* Get URL status */
    async getStatus(): Promise<'Active' | 'Inactive' | 'Offline' | 'Suspended'> {
        const result = await this.lookup();

        if (result && result.statusCode) {
            this.statusCode = result.statusCode;
        } else {
            this.statusCode = -1;
        }

        if (!result) {
            this.status = 'Offline'; /* No response; server is offline */
        } else if (
            result &&
            result.request &&
            result.request.uri &&
            result.request.uri.path &&
            result.request.uri.path === '/cgi-sys/suspendedpage.cgi'
        ) {
            this.status =
                'Suspended'; /* URL redirects to /cgi-sys/suspendedpage.cgi; server is likely suspended */
        } else if (
            result &&
            (result.body === '' ||
                (result.request &&
                    result.request.uri &&
                    result.request.uri.path &&
                    result.request.uri.path === '/cgi-sys/defaultwebpage.cgi'))
        ) {
            this.status =
                'Inactive'; /* URL redirects to /cgi-sys/defaultwebpage.cgi; domain is likely parked or not set up yet */
        } else if (result && this.subcategory && this.subcategory === 'MyEtherWallet') {
            const isMEW = await lookup(
                'http://' +
                    parse(this.url).hostname.replace('www.', '') +
                    '/js/etherwallet-static.min.js'
            );
            if (isMEW) {
                this.status =
                    'Active'; /* /js/etherwallet-static.min.js can be reached; server is active */
            } else {
                this.status =
                    'Inactive'; /* /js/etherwallet-static.min.js can't be reached; server is likely inactive */
            }
        } else if (result && this.subcategory && this.subcategory === 'MyCrypto') {
            const isMYC = await lookup(
                'http://' +
                    parse(this.url).hostname.replace('www.', '') +
                    '/js/mycrypto-static.min.js'
            );
            if (isMYC) {
                this.status =
                    'Active'; /* /js/mycrypto-static.min.js can't be reached; server is likely inactive */
            } else {
                this.status =
                    'Inactive'; /* /js/mycrypto-static.min.js can't be reached; server is likely inactive */
            }
        } else {
            this.status = 'Active'; /* URL can be reached; server is possibly active */
        }

        return this.status;
    }

    /* Retrieve URLScan results */
    getURLScan(): Promise<URLScanResponse> {
        return getURLScan(this.getHostname());
    }

    /* Look up how recent domain status was updated */
    howRecent(): number {
        return Date.now() - (this.updated || 0);
    }
}
