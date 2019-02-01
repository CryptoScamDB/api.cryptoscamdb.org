import config from '../../utils/config';
import * as captcha from '../../utils/gcaptcha';
import * as slack from '../../utils/slack';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    if (
        config.apiKeys.Google_Captcha &&
        config.apiKeys.Slack_Webhook &&
        req.body &&
        req.body.args &&
        req.body.args.captcha
    ) {
        const isValidCaptcha = await captcha.verifyResponse(req.body.args.captcha);
        if (isValidCaptcha) {
            slack.sendReport(req.body);
            res.json({
                success: true
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
            success: true
        });
    } else {
        res.json({
            success: false,
            message: 'No captcha response provided'
        });
    }
};
