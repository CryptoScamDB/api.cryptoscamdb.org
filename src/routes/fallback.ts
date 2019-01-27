import { Request, Response } from 'express';

export default async (req: Request, res: Response) => {
    res.json({
        success: false,
        message: 'This is an invalid api endpoint.'
    });
};
