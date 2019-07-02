import config from '../../utils/config';
import * as captcha from '../../utils/gcaptcha';
import * as slack from '../../utils/slack';
import { Request, Response } from 'express';
const uuidv1 = require('uuid/v1');

export default async (req: Request, res: Response) => {
    const strReportId = uuidv1();
    if (
        config.apiKeys.Google_Captcha &&
        config.apiKeys.Slack_Webhook &&
        req.body &&
        req.body.args &&
        req.body.args.captcha
    ) {
        req.body.args.report_id = strReportId;
        const isValidCaptcha = await captcha.verifyResponse(req.body.args.captcha);
        if (isValidCaptcha) {
            slack.sendReport(req.body);
            res.json({
                success: true,
                report_id: strReportId
            });
        } else {
            res.json({
                success: false,
                message: 'Invalid captcha response provided'
            });
        }
    } else if (config.apiKeys.Slack_Webhook && req.body && req.body.args && req.body.args.captcha) {
        slack.sendReport(req.body);
        res.json({
            success: true,
            report_id: strReportId
        });
    } else {
        res.json({
            success: false,
            message: 'No captcha response provided'
        });
    }
};
