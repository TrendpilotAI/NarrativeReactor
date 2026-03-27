/**
 * Tests: Webhook routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import { createServer } from 'http';

const mockGenerateContentFlow = vi.fn();
const mockVideoGenerationFlow = vi.fn();
const mockPostToSocialFlow = vi.fn();
const mockTrackCost = vi.fn();

vi.mock('../../flows/content-generation', () => ({
  generateContentFlow: mockGenerateContentFlow,
}));

vi.mock('../../flows/orchestration', () => ({
  videoGenerationFlow: mockVideoGenerationFlow,
  agenticChatFlow: vi.fn(),
}));

vi.mock('../../flows/integrations', () => ({
  postToSocialFlow: mockPostToSocialFlow,
  listIntegrationsFlow: vi.fn(),
  getPerformanceDataFlow: vi.fn(),
  getMentionsFlow: vi.fn(),
}));

vi.mock('../../services/costTracker', () => ({
  trackCost: mockTrackCost,
  DEFAULT_COSTS: { 'claude-call': 0.03 },
}));

async function buildWebhookApp(webhookSecret?: string) {
  if (webhookSecret) {
    process.env.WEBHOOK_SECRET = webhookSecret;
  } else {
    delete process.env.WEBHOOK_SECRET;
  }
  vi.resetModules();
  const app = express();
  app.use(express.json());
  const { default: webhooksRouter } = await import('../../routes/webhooks');
  app.use('/webhooks', webhooksRouter);
  return app;
}

async function makeRequest(
  app: express.Express,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const response = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  );
  return { status: response.status, body: json };
}

describe('Webhook Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.WEBHOOK_SECRET;
  });

  describe('No secret configured (dev mode)', () => {
    it('POST /webhooks/n8n/generate succeeds with valid body', async () => {
      mockGenerateContentFlow.mockResolvedValue({ id: 'draft-1', content: 'Generated' });
      const app = await buildWebhookApp();
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/generate', {
        episodeId: 'ep-001',
        platform: 'twitter',
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockTrackCost).toHaveBeenCalled();
    });

    it('POST /webhooks/n8n/generate returns 400 if episodeId missing', async () => {
      const app = await buildWebhookApp();
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/generate', {
        platform: 'twitter',
      });
      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('POST /webhooks/n8n/generate returns 400 if platform missing', async () => {
      const app = await buildWebhookApp();
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/generate', {
        episodeId: 'ep-001',
      });
      expect(status).toBe(400);
    });

    it('POST /webhooks/n8n/video succeeds with valid body', async () => {
      mockVideoGenerationFlow.mockResolvedValue({ videoUrl: 'https://example.com/video.mp4' });
      const app = await buildWebhookApp();
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/video', {
        theme: 'sci-fi',
        characters: ['hero', 'villain'],
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('POST /webhooks/n8n/video returns 400 if theme missing', async () => {
      const app = await buildWebhookApp();
      const { status } = await makeRequest(app, 'POST', '/webhooks/n8n/video', {
        characters: ['hero'],
      });
      expect(status).toBe(400);
    });

    it('POST /webhooks/n8n/video returns 400 if characters missing', async () => {
      const app = await buildWebhookApp();
      const { status } = await makeRequest(app, 'POST', '/webhooks/n8n/video', {
        theme: 'sci-fi',
      });
      expect(status).toBe(400);
    });

    it('POST /webhooks/n8n/social succeeds with valid body', async () => {
      mockPostToSocialFlow.mockResolvedValue({ posted: true });
      const app = await buildWebhookApp();
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/social', {
        provider: 'twitter',
        message: 'Hello world!',
      });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });

    it('POST /webhooks/n8n/social returns 400 if provider missing', async () => {
      const app = await buildWebhookApp();
      const { status } = await makeRequest(app, 'POST', '/webhooks/n8n/social', {
        message: 'Hello world!',
      });
      expect(status).toBe(400);
    });

    it('POST /webhooks/n8n/social returns 400 if message missing', async () => {
      const app = await buildWebhookApp();
      const { status } = await makeRequest(app, 'POST', '/webhooks/n8n/social', {
        provider: 'twitter',
      });
      expect(status).toBe(400);
    });
  });

  describe('With webhook secret configured', () => {
    it('rejects requests without secret header', async () => {
      const app = await buildWebhookApp('my-secret');
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/generate', {
        episodeId: 'ep-001',
        platform: 'twitter',
      });
      expect(status).toBe(401);
      expect(body.error).toContain('Invalid webhook secret');
    });

    it('rejects requests with wrong secret', async () => {
      const app = await buildWebhookApp('correct-secret');
      const { status } = await makeRequest(app, 'POST', '/webhooks/n8n/generate', {
        episodeId: 'ep-001',
        platform: 'twitter',
      }, { 'x-webhook-secret': 'wrong-secret' });
      expect(status).toBe(401);
    });

    it('allows requests with correct secret', async () => {
      mockGenerateContentFlow.mockResolvedValue({ id: 'draft-1' });
      const app = await buildWebhookApp('correct-secret');
      const { status, body } = await makeRequest(app, 'POST', '/webhooks/n8n/generate', {
        episodeId: 'ep-001',
        platform: 'twitter',
      }, { 'x-webhook-secret': 'correct-secret' });
      expect(status).toBe(200);
      expect(body.success).toBe(true);
    });
  });
});
