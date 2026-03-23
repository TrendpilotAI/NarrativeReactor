/**
 * Content Pipeline & Blotato Publishing Routes
 */

import { Router, Request, Response } from 'express';
import {
  runContentPipeline,
  getDraft,
  listDrafts,
  approveDraft,
  rejectDraft,
  updateDraftContent,
  researchTopic,
} from '../services/contentPipeline';
import {
  publishDraftViaBlotato,
  publishContentViaBlotato,
  getBlotatoQueue,
  getBlotatoPostStatus,
  cancelBlotatoPost,
  listBlotatoAccounts,
} from '../services/blotatoPublisher';

import { incrementUsage } from '../services/tenants';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// ── Content Pipeline ──

// POST /api/pipeline/generate — full pipeline: topic → research → multi-format drafts
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { topic, context, useClaude, brandGuidelines } = req.body;
  if (!topic) {
    res.status(400).json({ error: 'Missing required field: topic' });
    return;
  }
  const draft = await runContentPipeline({ topic, context, useClaude, brandGuidelines });

  // Track token usage for tenant accounts (admin key bypasses quota — no tracking needed)
  if (req.tenant) {
    const totalChars = JSON.stringify(draft.formats).length;
    const estimatedTokens = Math.max(500, Math.ceil(totalChars / 4));
    incrementUsage(req.tenant.id, estimatedTokens, '/api/pipeline/generate', useClaude ? 'claude' : 'gemini');
  }

  res.status(201).json(draft);
}));

// POST /api/pipeline/research — research only (no draft generation)
router.post('/research', asyncHandler(async (req: Request, res: Response) => {
  const { topic, context } = req.body;
  if (!topic) {
    res.status(400).json({ error: 'Missing required field: topic' });
    return;
  }
  const research = await researchTopic(topic, context);

  // Track token usage for tenant accounts
  if (req.tenant) {
    const totalChars = JSON.stringify(research).length;
    const estimatedTokens = Math.max(200, Math.ceil(totalChars / 4));
    incrementUsage(req.tenant.id, estimatedTokens, '/api/pipeline/research', 'gemini');
  }

  res.json(research);
}));

// GET /api/pipeline/drafts — list all drafts, optionally filter by status
router.get('/drafts', asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  res.json(listDrafts(status));
}));

// GET /api/pipeline/drafts/:id — get a specific draft
router.get('/drafts/:id', asyncHandler(async (req: Request, res: Response) => {
  const draft = getDraft((req.params.id as string));
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(draft);
}));

// POST /api/pipeline/drafts/:id/approve — approve a draft
router.post('/drafts/:id/approve', asyncHandler(async (req: Request, res: Response) => {
  const draft = approveDraft((req.params.id as string));
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(draft);
}));

// POST /api/pipeline/drafts/:id/reject — reject a draft with feedback
router.post('/drafts/:id/reject', asyncHandler(async (req: Request, res: Response) => {
  const { feedback } = req.body;
  if (!feedback) {
    res.status(400).json({ error: 'Missing required field: feedback' });
    return;
  }
  const draft = rejectDraft((req.params.id as string), feedback);
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(draft);
}));

// PUT /api/pipeline/drafts/:id/content — edit a specific format in a draft
router.put('/drafts/:id/content', asyncHandler(async (req: Request, res: Response) => {
  const { format, content } = req.body;
  if (!format || !content) {
    res.status(400).json({ error: 'Missing required fields: format, content' });
    return;
  }
  if (!['xThread', 'linkedinPost', 'blogArticle'].includes(format)) {
    res.status(400).json({ error: 'format must be xThread, linkedinPost, or blogArticle' });
    return;
  }
  const draft = updateDraftContent((req.params.id as string), format, content);
  if (!draft) {
    res.status(404).json({ error: 'Draft not found' });
    return;
  }
  res.json(draft);
}));

// ── Blotato Publishing ──

// POST /api/pipeline/publish — publish a draft via Blotato
router.post('/publish', asyncHandler(async (req: Request, res: Response) => {
  const { draftId, platforms, format, scheduledAt, mediaUrls } = req.body;
  if (!draftId || !platforms || !format) {
    res.status(400).json({ error: 'Missing required fields: draftId, platforms, format' });
    return;
  }
  const result = await publishDraftViaBlotato({ draftId, platforms, format, scheduledAt, mediaUrls });
  res.json(result);
}));

// POST /api/pipeline/publish/direct — publish raw content via Blotato (no draft)
router.post('/publish/direct', asyncHandler(async (req: Request, res: Response) => {
  const { content, platforms, scheduledAt, mediaUrls } = req.body;
  if (!content || !platforms) {
    res.status(400).json({ error: 'Missing required fields: content, platforms' });
    return;
  }
  const result = await publishContentViaBlotato(content, platforms, scheduledAt, mediaUrls);
  res.json(result);
}));

// GET /api/pipeline/queue — get Blotato publishing queue
router.get('/queue', asyncHandler(async (_req: Request, res: Response) => {
  const queue = await getBlotatoQueue();
  res.json(queue);
}));

// GET /api/pipeline/queue/:id — get status of a Blotato post
router.get('/queue/:id', asyncHandler(async (req: Request, res: Response) => {
  const post = await getBlotatoPostStatus((req.params.id as string));
  res.json(post);
}));

// DELETE /api/pipeline/queue/:id — cancel a scheduled Blotato post
router.delete('/queue/:id', asyncHandler(async (req: Request, res: Response) => {
  const result = await cancelBlotatoPost((req.params.id as string));
  res.json(result);
}));

// GET /api/pipeline/accounts — list connected Blotato accounts
router.get('/accounts', asyncHandler(async (_req: Request, res: Response) => {
  const accounts = await listBlotatoAccounts();
  res.json(accounts);
}));

export default router;
