/**
 * Tests: Pipeline Routes (request validation, response formats)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';

// Mock heavy dependencies
vi.mock('../../services/contentPipeline', () => ({
  runContentPipeline: vi.fn().mockResolvedValue({
    id: 'draft-1',
    topic: 'AI in healthcare',
    research: { summary: 'summary', keyPoints: [], angles: [], sources: [] },
    formats: { xThread: 'thread', linkedinPost: 'linkedin', blogArticle: 'blog' },
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }),
  getDraft: vi.fn().mockImplementation((id: string) => id === 'draft-1' ? { id: 'draft-1', topic: 'AI' } : undefined),
  listDrafts: vi.fn().mockReturnValue([{ id: 'draft-1' }]),
  approveDraft: vi.fn().mockImplementation((id: string) => id === 'draft-1' ? { id: 'draft-1', status: 'approved' } : undefined),
  rejectDraft: vi.fn().mockImplementation((id: string) => id === 'draft-1' ? { id: 'draft-1', status: 'rejected' } : undefined),
  updateDraftContent: vi.fn().mockImplementation((id: string) => id === 'draft-1' ? { id: 'draft-1' } : undefined),
  researchTopic: vi.fn().mockResolvedValue({ summary: 'test', keyPoints: [], angles: [], sources: [] }),
}));

vi.mock('../../services/blotatoPublisher', () => ({
  publishDraftViaBlotato: vi.fn(),
  publishContentViaBlotato: vi.fn(),
  getBlotatoQueue: vi.fn().mockReturnValue([]),
  getBlotatoPostStatus: vi.fn(),
  cancelBlotatoPost: vi.fn(),
  listBlotatoAccounts: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../services/tenants', () => ({
  incrementUsage: vi.fn(),
}));

vi.mock('../../lib/blotato', () => ({
  BlotatoPlatform: { TWITTER: 'twitter', LINKEDIN: 'linkedin' },
}));

import { createServer } from 'http';

async function buildTestApp() {
  const app = express();
  app.use(express.json());
  // Dynamically import the router after mocks are set up
  const { default: pipelineRouter } = await import('../../routes/pipeline');
  app.use('/api/pipeline', pipelineRouter);
  return app;
}

async function makeRequest(app: express.Express, method: string, path: string, body?: any, headers?: Record<string, string>) {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;

  const response = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await response.json();

  await new Promise<void>((resolve, reject) =>
    server.close(err => err ? reject(err) : resolve())
  );
  return { status: response.status, body: json };
}

describe('Pipeline Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    app = await buildTestApp();
  });

  describe('POST /api/pipeline/generate', () => {
    it('returns 400 when topic is missing', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/pipeline/generate', {});
      expect(status).toBe(400);
      expect(body.error).toContain('topic');
    });

    it('returns 201 with draft when topic provided', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/pipeline/generate', { topic: 'AI in healthcare' });
      expect(status).toBe(201);
      expect(body.id).toBeDefined();
    });
  });

  describe('POST /api/pipeline/research', () => {
    it('returns 400 when topic is missing', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/pipeline/research', {});
      expect(status).toBe(400);
      expect(body.error).toContain('topic');
    });

    it('returns research result when topic provided', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/pipeline/research', { topic: 'AI trends' });
      expect(status).toBe(200);
      expect(body.summary).toBeDefined();
    });
  });

  describe('GET /api/pipeline/drafts', () => {
    it('returns list of drafts', async () => {
      const { status, body } = await makeRequest(app, 'GET', '/api/pipeline/drafts');
      expect(status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });
  });

  describe('GET /api/pipeline/drafts/:id', () => {
    it('returns 404 for unknown draft', async () => {
      const { status } = await makeRequest(app, 'GET', '/api/pipeline/drafts/unknown-draft');
      expect(status).toBe(404);
    });

    it('returns draft for known ID', async () => {
      const { status, body } = await makeRequest(app, 'GET', '/api/pipeline/drafts/draft-1');
      expect(status).toBe(200);
      expect(body.id).toBe('draft-1');
    });
  });
});
