import { Request, Response, NextFunction } from 'express';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
    const apiKey = req.headers['x-api-key'] as string;
    const validKey = process.env.API_KEY;

    if (!validKey) {
        if (process.env.NODE_ENV === 'production') {
            // FAIL CLOSED — never allow requests through when API_KEY is missing in production
            res.status(503).json({ error: 'Service not configured — API_KEY required' });
            return;
        }
        // Dev convenience: allow but scream loudly
        console.warn('');
        console.warn('⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️');
        console.warn('WARNING: API_KEY environment variable is NOT SET.');
        console.warn('Auth is DISABLED — ALL REQUESTS ARE ALLOWED.');
        console.warn('This is only acceptable in local development.');
        console.warn('NEVER run without API_KEY in production!');
        console.warn('⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️  ⚠️');
        console.warn('');
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
