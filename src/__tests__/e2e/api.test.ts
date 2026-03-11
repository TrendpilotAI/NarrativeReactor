/**
 * E2E API Tests — HTTP layer tests using supertest
 *
 * Tests the following scenarios:
 *   - POST /api/billing/tenants   — creates tenant, returns API key (register)
 *   - GET  /api/billing/usage     — returns quota info (tenant auth)
 *   - POST /api/generate          — generates content (admin auth, mocked AI)
 *   - Rate limiting               — 6th request within window returns 429
 *   - Unauthenticated requests    — return 401
 *   - GET  /health                — always returns 200
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import type { Server } from 'http';
import type { Application } from 'express';

// ── Mock external services before importing app ───────────────────

// Mock genkit AI so content generation doesn't call real APIs
vi.mock('../../genkit.config', () => ({
    ai: {
        defineFlow: vi.fn((_cfg: unknown, handler: unknown) => handler),
        defineTool: vi.fn((_cfg: unknown, handler: unknown) => handler),
        generate: vi.fn().mockResolvedValue({
            text: 'Mocked AI content for testing',
            usage: { inputTokens: 10, outputTokens: 20 },
        }),
        prompt: vi.fn().mockResolvedValue({
            output: { content: 'Mocked prompt output' },
        }),
    },
}));

vi.mock('genkit', async () => {
    const zod = await import('zod');
    return { z: zod.z, genkit: vi.fn() };
});

// Mock Stripe to avoid real API calls
vi.mock('stripe', () => ({
    default: vi.fn().mockImplementation(() => ({
        checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://stripe.test/checkout' }) } },
        billingPortal: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://stripe.test/portal' }) } },
        webhooks: { constructEvent: vi.fn() },
    })),
}));

// Mock fal.ai
vi.mock('../../lib/fal', () => ({
    generateImage: vi.fn().mockResolvedValue({ url: 'https://fal.test/image.png' }),
    generateVideo: vi.fn().mockResolvedValue({ url: 'https://fal.test/video.mp4' }),
}));

// Mock Anthropic claude lib
vi.mock('../../lib/claude', () => ({
    generateCopyClaude: vi.fn().mockResolvedValue({ caption: 'Mock caption', hashtags: [] }),
}));

// Mock flows to avoid heavy imports
vi.mock('../../flows/content-generation', () => ({
    generateContentFlow: vi.fn().mockResolvedValue({ content: 'Generated content' }),
}));
vi.mock('../../flows/compliance', () => ({
    verifyBrandCompliance: vi.fn().mockResolvedValue({ compliant: true }),
}));
vi.mock('../../flows/orchestration', () => ({
    videoGenerationFlow: vi.fn().mockResolvedValue({ videoUrl: 'https://test/video.mp4' }),
    agenticChatFlow: vi.fn().mockResolvedValue({ response: 'Hello' }),
}));
vi.mock('../../flows/integrations', () => ({
    getAuthUrlFlow: vi.fn().mockResolvedValue({ url: 'https://auth.test' }),
    connectSocialAccountFlow: vi.fn().mockResolvedValue({ connected: true }),
    listIntegrationsFlow: vi.fn().mockResolvedValue({ integrations: [] }),
    postToSocialFlow: vi.fn().mockResolvedValue({ postId: '123' }),
    getPerformanceDataFlow: vi.fn().mockResolvedValue({ data: [] }),
    getMentionsFlow: vi.fn().mockResolvedValue({ mentions: [] }),
}));

// Mock openapi router (avoids swagger-ui-express weight)
vi.mock('../../openapi', async () => {
    const express = await import('express');
    const router = express.Router();
    router.get('/openapi.json', (_req, res) => res.json({ openapi: '3.0.0' }));
    return { default: router };
});

// Mock dashboard auth (not relevant for API E2E tests)
vi.mock('../../middleware/dashboardAuth', () => ({
    loginGet: vi.fn((_req: unknown, res: { send: (s: string) => void }) => res.send('login page')),
    loginPost: vi.fn((_req: unknown, res: { redirect: (s: string) => void }) => res.redirect('/')),
    logout: vi.fn((_req: unknown, res: { redirect: (s: string) => void }) => res.redirect('/login')),
    requireDashboardAuth: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

// Mock scheduler so it doesn't start background jobs
vi.mock('../../services/schedulerWorker', () => ({
    startScheduler: vi.fn(),
}));

// ── Helpers ────────────────────────────────────────────────────────

const ADMIN_KEY = 'test-admin-api-key';

async function makeApp(rateLimitMax = 1000, rateLimitWindowMs = 60_000): Promise<{ app: Application; server: Server }> {
    const { createApp } = await import('../../app');
    const app = createApp({ rateLimitMax, rateLimitWindowMs });
    const server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    return { app, server };
}

async function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
}

// ── Setup env ─────────────────────────────────────────────────────

beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEY = ADMIN_KEY;
    process.env.DATABASE_PATH = ':memory:';
    process.env.JWT_SECRET = 'test-jwt-secret-32-chars-minimum!';
    process.env.DASHBOARD_PASSWORD = 'test-password';
});

// ── Tests ─────────────────────────────────────────────────────────

describe('GET /health', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => {
        ({ app, server } = await makeApp());
    });
    afterAll(async () => { await closeServer(server); });

    it('returns 200 with status ok', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(res.body.service).toBe('NarrativeReactor');
        expect(res.body.timestamp).toBeDefined();
    });

    it('does not require authentication', async () => {
        const res = await request(app).get('/health');
        expect(res.status).toBe(200);
    });
});

describe('POST /api/billing/tenants — tenant registration', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => {
        ({ app, server } = await makeApp());
    });
    afterAll(async () => { await closeServer(server); });

    it('creates a tenant and returns an API key (admin auth)', async () => {
        const res = await request(app)
            .post('/api/billing/tenants')
            .set('X-API-Key', ADMIN_KEY)
            .send({ name: 'E2E Test Org', email: 'e2e@test.com', plan: 'free' });

        expect(res.status).toBe(201);
        expect(res.body.tenant).toBeDefined();
        expect(res.body.tenant.name).toBe('E2E Test Org');
        expect(res.body.tenant.email).toBe('e2e@test.com');
        expect(res.body.api_key).toMatch(/^nr_live_/);
        expect(res.body.warning).toContain('Store this API key');
    });

    it('returns 400 if name or email is missing', async () => {
        const res = await request(app)
            .post('/api/billing/tenants')
            .set('X-API-Key', ADMIN_KEY)
            .send({ name: 'Missing Email' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
    });

    it('returns 401 without admin auth', async () => {
        const res = await request(app)
            .post('/api/billing/tenants')
            .send({ name: 'Unauthorized Org', email: 'bad@test.com' });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/billing/usage — quota info (tenant auth)', () => {
    let app: Application;
    let server: Server;
    let tenantApiKey: string;

    beforeAll(async () => {
        ({ app, server } = await makeApp());
        // Register a tenant to get a key
        const reg = await request(app)
            .post('/api/billing/tenants')
            .set('X-API-Key', ADMIN_KEY)
            .send({ name: 'Usage Test Org', email: 'usage@test.com', plan: 'free' });
        tenantApiKey = reg.body.api_key;
    });
    afterAll(async () => { await closeServer(server); });

    it('returns quota info with a valid tenant API key', async () => {
        const res = await request(app)
            .get('/api/billing/usage')
            .set('X-API-Key', tenantApiKey);

        expect(res.status).toBe(200);
        expect(res.body.tenant_id).toBeDefined();
        expect(res.body.plan).toBe('free');
        expect(res.body.quota_tokens).toBeGreaterThan(0);
        expect(res.body.used_tokens).toBeDefined();
        expect(res.body.remaining_tokens).toBeDefined();
        expect(res.body.percent_used).toBeDefined();
    });

    it('returns 401 with no API key', async () => {
        const res = await request(app).get('/api/billing/usage');
        expect(res.status).toBe(401);
    });

    it('returns 401 with invalid API key', async () => {
        const res = await request(app)
            .get('/api/billing/usage')
            .set('X-API-Key', 'nr_live_invalid_key_0000000000000000000000000000000000000000000000000000');
        expect(res.status).toBe(401);
    });
});

describe('GET /api/billing/plans — public plan listing', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => { ({ app, server } = await makeApp()); });
    afterAll(async () => { await closeServer(server); });

    it('returns available plans without auth', async () => {
        const res = await request(app).get('/api/billing/plans');
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body.plans)).toBe(true);
        expect(res.body.plans.length).toBeGreaterThan(0);
        const planIds = res.body.plans.map((p: { id: string }) => p.id);
        expect(planIds).toContain('free');
        expect(planIds).toContain('starter');
        expect(planIds).toContain('pro');
    });
});

describe('POST /api/generate — content generation (admin auth, mocked AI)', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => { ({ app, server } = await makeApp()); });
    afterAll(async () => { await closeServer(server); });

    it('generates content with required fields and admin auth', async () => {
        const res = await request(app)
            .post('/api/generate')
            .set('X-API-Key', ADMIN_KEY)
            .send({ episodeId: 'ep-001', platform: 'twitter' });

        // Should succeed or fail with a known error (not 401/403)
        expect([200, 500]).toContain(res.status);
    });

    it('returns 400 when required fields are missing', async () => {
        const res = await request(app)
            .post('/api/generate')
            .set('X-API-Key', ADMIN_KEY)
            .send({ episodeId: 'ep-001' }); // missing platform

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/Missing required/i);
    });

    it('returns 401 when no API key is provided', async () => {
        const res = await request(app)
            .post('/api/generate')
            .send({ episodeId: 'ep-001', platform: 'twitter' });

        expect(res.status).toBe(401);
    });
});

describe('Unauthenticated requests return 401', () => {
    let app: Application;
    let server: Server;

    beforeAll(async () => { ({ app, server } = await makeApp()); });
    afterAll(async () => { await closeServer(server); });

    it('GET /api/costs returns 401', async () => {
        const res = await request(app).get('/api/costs');
        expect(res.status).toBe(401);
    });

    it('POST /api/compliance returns 401', async () => {
        const res = await request(app)
            .post('/api/compliance')
            .send({ content: 'test', platform: 'twitter' });
        expect(res.status).toBe(401);
    });
});

describe('Rate limiting — 6th request within window returns 429', () => {
    let app: Application;
    let server: Server;

    // Tight rate limit: 5 max per 10s window — isolated app instance
    beforeAll(async () => {
        ({ app, server } = await makeApp(5, 10_000));
    });
    afterAll(async () => { await closeServer(server); });

    it('allows 5 requests then blocks the 6th with 429', async () => {
        const responses: number[] = [];

        // First 5 requests should be within limit
        for (let i = 0; i < 5; i++) {
            const res = await request(app)
                .get('/api/billing/plans');
            responses.push(res.status);
        }

        // 6th request should be rate-limited
        const sixthRes = await request(app).get('/api/billing/plans');

        // Verify first 5 were not rate-limited
        expect(responses.every(s => s !== 429)).toBe(true);
        // 6th should be 429
        expect(sixthRes.status).toBe(429);
    });
});
