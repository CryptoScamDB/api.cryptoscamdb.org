import * as request from 'request';
import config from './config';
import * as Debug from 'debug';

const debug = Debug('slack');

/**
 * Send report through Slack
 */
export const sendReport = (report: any): Promise<any> => {
    return new Promise((resolve, reject) => {
        if (config.apiKeys.Slack_Webhook) {
            let message = '';
            if (report.reportType == 'generalDomainReport') {
                message += '*Domain*: ';
                message += report.args.domain || '(none)';
                message += '\n';
                message += '*Reason*: ';
                message += report.args.reason || '(none)';
            } else if (report.reportType == 'generalAddressReport') {
                message += '*Address*: ';
                if (report.args.address) {
                    message += '<https://etherscan.io/address/' + report.args.address + '|';
                }
                message += report.args.address || '(none)';
                if (report.args.address) {
                    message += '>';
                }
                message += '\n';
                message += '*Reason*: ';
                message += report.args.reason || '(none)';
            } else if (report.reportType == 'uniqueReport') {
                message += '*Report*: ';
                message += report.args.unique || '(none)';
            } else if (report.reportType == 'urgentDomainReport') {
                message += '*Domain*: ';
                message += report.args.domain || '(none)';
                message += '\n';
                message += '*Victim address*: ';
                if (report.args.from) {
                    message += '<https://etherscan.io/address/' + report.args.from + '|';
                }
                message += report.args.from || '(none)';
                if (report.args.from) {
                    message += '>';
                }
                message += '\n';
                message += '*Attacker addresses*: ';
                if (report.args.to) {
                    message += report.args.to
                        .split('\n')
                        .map(
                            address =>
                                '<https://etherscan.io/address/' + address + '|' + address + '>'
                        )
                        .join(', ');
                } else {
                    message += '(none)';
                }
            } else if (report.reportType == 'urgentMessageAddressReport') {
                message += '*Reason*: ';
                message += report.args.message || '(none)';
                message += '\n';
                message += '*Victim address*: ';
                if (report.args.from) {
                    message += '<https://etherscan.io/address/' + report.args.from + '|';
                }
                message += report.args.from || '(none)';
                if (report.args.from) {
                    message += '>';
                }
                message += '\n';
                message += '*Attacker addresses*: ';
                if (report.args.to) {
                    message += report.args.to
                        .split('\n')
                        .map(
                            address =>
                                '<https://etherscan.io/address/' + address + '|' + address + '>'
                        )
                        .join(', ');
                } else {
                    message += '(none)';
                }
            } else if (report.reportType == 'urgentDomainAddressReport') {
                message += '*Reason*: ';
                message += report.args.message || '(none)';
                message += '\n';
                message += '*Victim address*: ';
                if (report.args.from) {
                    message += '<https://etherscan.io/address/' + report.args.from + '|';
                }
                message += report.args.from || '(none)';
                if (report.args.from) {
                    message += '>';
                }
                message += '\n';
                message += '*Attacker addresses*: ';
                if (report.args.to) {
                    message += report.args.to
                        .split('\n')
                        .map(
                            address =>
                                '<https://etherscan.io/address/' + address + '|' + address + '>'
                        )
                        .join(', ');
                } else {
                    message += '(none)';
                }
            } else {
                message += '*Unknown reportType*: `' + report.reportType + '`\n\n';
                report.args.captcha = null;
                message += '```' + JSON.stringify(report.args, null, 4) + '```';
            }
            request.post(
                config.apiKeys.Slack_Webhook,
                {
                    json: true,
                    body: {
                        text: message
                    }
                },
                (err, response, body) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(body);
                    }
                }
            );
        } else {
            reject('No Slack webhook found!');
        }
    });
};
