import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { validateEnv } from './lib/env';
import { generateContentFlow } from './flows/content-generation';
import { verifyBrandCompliance } from './flows/compliance';
import { videoGenerationFlow, agenticChatFlow } from './flows/orchestration';
import { getAuthUrlFlow, connectSocialAccountFlow, listIntegrationsFlow, postToSocialFlow, getPerformanceDataFlow, getMentionsFlow } from './flows/integrations';
import { startFlowServer } from '@genkit-ai/express';
import { apiKeyAuth } from './middleware/auth';
import apiRoutes from './routes/index';
import pipelineRoutes from './routes/pipeline';
import webhookRoutes from './routes/webhooks';
import { getCostSummary } from './services/costTracker';
import { startScheduler } from './services/schedulerWorker';
import { loginGet, loginPost, logout, requireDashboardAuth } from './middleware/dashboardAuth';

// Validate required env vars at startup — throws in production if missing
validateEnv();

const app = express();

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
app.use('/api/pipeline', apiKeyAuth, pipelineRoutes);

// Cost tracking endpoint (behind auth)
app.get('/api/costs', apiKeyAuth, (_req, res) => {
    res.json(getCostSummary());
});

// Webhook routes (no API key auth — uses webhook secret)
app.use('/webhooks', webhookRoutes);

// Health check — exempt from auth, safe for monitoring
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'NarrativeReactor', timestamp: new Date().toISOString() });
});

// Dashboard auth routes
app.get('/login', loginGet);
app.post('/login', loginPost);
app.get('/logout', logout);

// Dashboard auth middleware — protects static files (skips /api, /health, /login, /webhooks)
app.use(requireDashboardAuth);

// Static dashboard (now behind auth)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Start Express server
const PORT = parseInt(process.env.NR_PORT || '3401', 10);
app.listen(PORT, () => {
    console.log(`NarrativeReactor API server running on port ${PORT}`);
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
