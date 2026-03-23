/**
 * Express app factory — exported so tests can import without starting the server.
 *
 * Route auth summary:
 *   /api/billing/*  — billing router handles its own auth (tenantAuth / apiKeyAuth per route)
 *   /api/*          — global apiKeyAuth (admin key required)
 *   /webhooks/*     — no key auth (webhook secret checked per handler)
 */
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { apiKeyAuth } from './middleware/auth';
import { smartAuth } from './middleware/tenantAuth';
import apiRoutes from './routes/index';
import pipelineRoutes from './routes/pipeline';
import webhookRoutes from './routes/webhooks';
import { getCostSummary } from './services/costTracker';
import { loginGet, loginPost, logout, refreshSession, requireDashboardAuth } from './middleware/dashboardAuth';
import { globalErrorHandler } from './middleware/errorHandler';
import docsRouter from './openapi';
import { billingRouter, stripeWebhookRouter } from './routes/billing';

export function createApp(options: { rateLimitMax?: number; rateLimitWindowMs?: number } = {}): express.Application {
    const app = express();

    // Security headers
    app.use(helmet({ contentSecurityPolicy: false }));

    // CORS
    const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
        ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
        : [];

    const corsOptions: cors.CorsOptions = {
        origin: (origin, callback) => {
            if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV !== 'production') {
                return callback(null, true);
            }
            if (!origin) return callback(null, true);
            if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
            callback(new Error(`Origin ${origin} not allowed by CORS`));
        },
        credentials: true,
    };
    app.use(cors(corsOptions));

    // Body parsing
    app.use(express.json());
    app.use(express.urlencoded({ extended: false }));

    // Rate limiting — configurable for tests; applied to all /api routes
    const limiter = rateLimit({
        windowMs: options.rateLimitWindowMs ?? (15 * 60 * 1000),
        max: options.rateLimitMax ?? 100,
        standardHeaders: true,
        legacyHeaders: false,
        message: { error: 'Too many requests, please try again later.' },
    });
    app.use('/api', limiter);

    // Health check — no auth required, safe for monitoring
    app.get('/health', (_req, res) => {
        res.json({ status: 'ok', service: 'NarrativeReactor', timestamp: new Date().toISOString() });
    });

    // Billing API — mounted before global apiKeyAuth so billing routes handle
    // their own auth (tenantAuth for usage, apiKeyAuth for admin endpoints, public for plans)
    app.use('/api/billing', billingRouter);

    // Webhook routes — no API key auth (uses webhook secret)
    app.use('/webhooks', webhookRoutes);
    app.use('/webhooks', stripeWebhookRouter);

    // Global auth middleware for remaining /api/* routes (admin key required)
    app.use('/api', apiKeyAuth);

    // API routes
    app.use('/api', apiRoutes);

    // Content pipeline routes
    app.use('/api/pipeline', smartAuth, pipelineRoutes);

    // Cost tracking
    app.get('/api/costs', apiKeyAuth, (_req, res) => {
        res.json(getCostSummary());
    });

    // API docs
    app.use('/docs', docsRouter);

    // Dashboard auth routes
    app.get('/login', loginGet);
    app.post('/login', loginPost);
    app.get('/logout', logout);
    app.post('/auth/refresh', refreshSession);

    // Session check for React dashboard
    app.get('/auth/me', (req, res) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { verifyJwt } = require('./lib/jwt');
        const cookieHeader = req.headers.cookie || '';
        const match = cookieHeader.match(/nr_session=([^;]+)/);
        const token = match?.[1];
        if (!token) { res.status(401).json({ error: 'Not authenticated' }); return; }
        try {
            const payload = verifyJwt(token);
            res.json({ authenticated: true, user: payload.sub });
        } catch {
            res.status(401).json({ error: 'Session expired' });
        }
    });

    // Dashboard auth guard & static files
    app.use(requireDashboardAuth);
    app.use(express.static(path.join(__dirname, '..', 'public')));

    // Global error handler
    app.use(globalErrorHandler);

    return app;
}
