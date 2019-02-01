import * as github from '../utils/github';
import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => (body += chunk));
    req.on('end', () => github.webhook(req, res, body));
};
