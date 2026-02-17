import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { generateContentFlow } from './flows/content-generation';
import { verifyBrandCompliance } from './flows/compliance';
import { videoGenerationFlow, agenticChatFlow } from './flows/orchestration';
import { getAuthUrlFlow, connectSocialAccountFlow, listIntegrationsFlow, postToSocialFlow, getPerformanceDataFlow, getMentionsFlow } from './flows/integrations';
import { startFlowServer } from '@genkit-ai/express';
import { apiKeyAuth } from './middleware/auth';
import apiRoutes from './routes/index';
import webhookRoutes from './routes/webhooks';
import { getCostSummary } from './services/costTracker';

const app = express();

// CORS
app.use(cors({ origin: '*' }));

// Body parsing
app.use(express.json());

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

// Cost tracking endpoint (behind auth)
app.get('/api/costs', apiKeyAuth, (_req, res) => {
    res.json(getCostSummary());
});

// Webhook routes (no API key auth — uses webhook secret)
app.use('/webhooks', webhookRoutes);

// Static dashboard
app.use(express.static(path.join(__dirname, '..', 'public')));

// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

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
    cors: {
        origin: '*',
    }
});
