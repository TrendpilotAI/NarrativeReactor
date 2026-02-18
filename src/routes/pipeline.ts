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
import { BlotatoPlatform } from '../lib/blotato';

const router = Router();

// ── Content Pipeline ──

// POST /api/pipeline/generate — full pipeline: topic → research → multi-format drafts
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { topic, context, useClaude, brandGuidelines } = req.body;
    if (!topic) {
      res.status(400).json({ error: 'Missing required field: topic' });
      return;
    }
    const draft = await runContentPipeline({ topic, context, useClaude, brandGuidelines });
    res.status(201).json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipeline/research — research only (no draft generation)
router.post('/research', async (req: Request, res: Response) => {
  try {
    const { topic, context } = req.body;
    if (!topic) {
      res.status(400).json({ error: 'Missing required field: topic' });
      return;
    }
    const research = await researchTopic(topic, context);
    res.json(research);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/drafts — list all drafts, optionally filter by status
router.get('/drafts', async (req: Request, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    res.json(listDrafts(status));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/drafts/:id — get a specific draft
router.get('/drafts/:id', async (req: Request, res: Response) => {
  try {
    const draft = getDraft(req.params.id);
    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipeline/drafts/:id/approve — approve a draft
router.post('/drafts/:id/approve', async (req: Request, res: Response) => {
  try {
    const draft = approveDraft(req.params.id);
    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipeline/drafts/:id/reject — reject a draft with feedback
router.post('/drafts/:id/reject', async (req: Request, res: Response) => {
  try {
    const { feedback } = req.body;
    if (!feedback) {
      res.status(400).json({ error: 'Missing required field: feedback' });
      return;
    }
    const draft = rejectDraft(req.params.id, feedback);
    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/pipeline/drafts/:id/content — edit a specific format in a draft
router.put('/drafts/:id/content', async (req: Request, res: Response) => {
  try {
    const { format, content } = req.body;
    if (!format || !content) {
      res.status(400).json({ error: 'Missing required fields: format, content' });
      return;
    }
    if (!['xThread', 'linkedinPost', 'blogArticle'].includes(format)) {
      res.status(400).json({ error: 'format must be xThread, linkedinPost, or blogArticle' });
      return;
    }
    const draft = updateDraftContent(req.params.id, format, content);
    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json(draft);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Blotato Publishing ──

// POST /api/pipeline/publish — publish a draft via Blotato
router.post('/publish', async (req: Request, res: Response) => {
  try {
    const { draftId, platforms, format, scheduledAt, mediaUrls } = req.body;
    if (!draftId || !platforms || !format) {
      res.status(400).json({ error: 'Missing required fields: draftId, platforms, format' });
      return;
    }
    const result = await publishDraftViaBlotato({ draftId, platforms, format, scheduledAt, mediaUrls });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/pipeline/publish/direct — publish raw content via Blotato (no draft)
router.post('/publish/direct', async (req: Request, res: Response) => {
  try {
    const { content, platforms, scheduledAt, mediaUrls } = req.body;
    if (!content || !platforms) {
      res.status(400).json({ error: 'Missing required fields: content, platforms' });
      return;
    }
    const result = await publishContentViaBlotato(content, platforms, scheduledAt, mediaUrls);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/queue — get Blotato publishing queue
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const queue = await getBlotatoQueue();
    res.json(queue);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/queue/:id — get status of a Blotato post
router.get('/queue/:id', async (req: Request, res: Response) => {
  try {
    const post = await getBlotatoPostStatus(req.params.id);
    res.json(post);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/pipeline/queue/:id — cancel a scheduled Blotato post
router.delete('/queue/:id', async (req: Request, res: Response) => {
  try {
    const result = await cancelBlotatoPost(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/pipeline/accounts — list connected Blotato accounts
router.get('/accounts', async (_req: Request, res: Response) => {
  try {
    const accounts = await listBlotatoAccounts();
    res.json(accounts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
