import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] as string;
    const validKey = process.env.API_KEY;

    if (!validKey) {
        console.warn('API_KEY environment variable not set — auth disabled');
        next();
        return;
    }

    if (!apiKey) {
        res.status(401).json({ error: 'Missing X-API-Key header' });
        return;
    }

    if (apiKey !== validKey) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
    }

    next();
}
