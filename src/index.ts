import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { validateEnv, validateBillingEnv } from './lib/env';
import { generateContentFlow } from './flows/content-generation';
import { verifyBrandCompliance } from './flows/compliance';
import { videoGenerationFlow, agenticChatFlow } from './flows/orchestration';
import { getAuthUrlFlow, connectSocialAccountFlow, listIntegrationsFlow, postToSocialFlow, getPerformanceDataFlow, getMentionsFlow } from './flows/integrations';
import { startFlowServer } from '@genkit-ai/express';
import { apiKeyAuth } from './middleware/auth';
import { smartAuth } from './middleware/tenantAuth';
import apiRoutes from './routes/index';
import pipelineRoutes from './routes/pipeline';
import webhookRoutes from './routes/webhooks';
import { getCostSummary } from './services/costTracker';
import { startScheduler } from './services/schedulerWorker';
import { loginGet, loginPost, logout, requireDashboardAuth } from './middleware/dashboardAuth';
import { globalErrorHandler } from './middleware/errorHandler';
import { captureException, isConfigured as sentryConfigured } from './lib/errorReporter';
import docsRouter from './openapi';
import { billingRouter, stripeWebhookRouter } from './routes/billing';
import { linkedInRouter } from './routes/linkedin';

// Validate required env vars at startup — throws in production if missing
validateEnv();
validateBillingEnv();

const app = express();

// Security headers — helmet must be first middleware
app.use(helmet({ contentSecurityPolicy: false }));

// CORS — restrict to allowed origins in production; allow all in development
const ALLOWED_ORIGINS = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : [];

const corsOptions: cors.CorsOptions = {
    origin: (origin, callback) => {
        // In development without CORS_ALLOWED_ORIGINS, allow all
        if (ALLOWED_ORIGINS.length === 0 && process.env.NODE_ENV !== 'production') {
            return callback(null, true);
        }
        // Allow requests with no origin (server-to-server, curl, Postman)
        if (!origin) return callback(null, true);
        // Check against allowlist
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Rate limiting: 100 requests per 15 minutes per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});
app.use('/api', limiter);

// Auth middleware for all /api/* routes
app.use('/api', apiKeyAuth);

// API routes
app.use('/api', apiRoutes);

// Content pipeline & Blotato publishing routes
// Uses smartAuth: tenant API key (with quota enforcement) OR admin key (bypass)
app.use('/api/pipeline', smartAuth, pipelineRoutes);

// Cost tracking endpoint (behind auth)
app.get('/api/costs', apiKeyAuth, (_req, res) => {
    res.json(getCostSummary());
});

// Webhook routes (no API key auth — uses webhook secret)
app.use('/webhooks', webhookRoutes);

// Stripe webhook — raw body required (must be before global json parser scope)
app.use('/webhooks', stripeWebhookRouter);

// Billing API — plan listing is public; checkout/usage require tenant API key
app.use('/api/billing', billingRouter);

// LinkedIn OAuth2 PKCE flow (NR-006)
// /api/linkedin/callback is public (redirect from LinkedIn), others require tenant auth
app.use('/api/linkedin', linkedInRouter);

// Health check — exempt from auth, safe for monitoring
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'NarrativeReactor', timestamp: new Date().toISOString() });
});

// API documentation — Swagger UI at /docs, spec at /docs/openapi.json
app.use('/docs', docsRouter);

// Dashboard auth routes
app.get('/login', loginGet);
app.post('/login', loginPost);
app.get('/logout', logout);

// Session check for React dashboard — returns 200 if valid session, 401 otherwise
app.get('/auth/me', (req, res) => {
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

// Dashboard auth middleware — protects static files (skips /api, /health, /login, /webhooks)
app.use(requireDashboardAuth);

// Static dashboard (now behind auth)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Global error handler (must be after all routes)
app.use(globalErrorHandler);

// Catch unhandled rejections and uncaught exceptions
process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    captureException(err, { type: 'unhandledRejection' });
});
process.on('uncaughtException', (err) => {
    captureException(err, { type: 'uncaughtException' });
    // Give Sentry time to flush before exit
    setTimeout(() => process.exit(1), 2000);
});

// Start Express server
const PORT = parseInt(process.env.NR_PORT || '3401', 10);
app.listen(PORT, () => {
    console.log(`NarrativeReactor API server running on port ${PORT}`);
    if (sentryConfigured()) {
        console.log('[sentry] Error reporting enabled');
    } else {
        console.warn('[sentry] SENTRY_DSN not set — error reporting disabled');
    }
});

// Also start Genkit flow server on a separate port for dev UI
startFlowServer({
    flows: [
        generateContentFlow,
        verifyBrandCompliance,
        videoGenerationFlow,
        agenticChatFlow,
        getAuthUrlFlow,
        connectSocialAccountFlow,
        listIntegrationsFlow,
        postToSocialFlow,
        getPerformanceDataFlow,
        getMentionsFlow
    ],
    port: parseInt(process.env.GENKIT_PORT || '3402', 10),
    cors: corsOptions,
});

// Start the posting scheduler (checks for due posts every 60s)
startScheduler();
