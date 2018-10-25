import * as request from 'request';
import config from './config';
import * as Debug from 'debug';

const debug = Debug('gcaptcha');

/**
 * Verify a Google Captcha response
 */
export const verifyResponse = (response: string): Promise<any> => {
    return new Promise((resolve, reject) => {
        if (config.apiKeys.Google_Captcha) {
            request.post(
                'https://www.google.com/recaptcha/api/siteverify?secret=' +
                    encodeURIComponent(config.apiKeys.Google_Captcha) +
                    '&response=' +
                    encodeURIComponent(response),
                { json: true },
                (err, response, body) => {
                    if (err) {
                        reject(err);
                    } else {
                        debug(body);
                        resolve(body.success);
                    }
                }
            );
        } else {
            reject('No Google Captcha secret found!');
        }
    });
};
