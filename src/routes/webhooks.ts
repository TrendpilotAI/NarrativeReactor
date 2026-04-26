import { Router, Request, Response } from 'express';
import { generateContentFlow } from '../flows/content-generation';
import { videoGenerationFlow } from '../flows/orchestration';
import { postToSocialFlow } from '../flows/integrations';
import { trackCost, DEFAULT_COSTS } from '../services/costTracker';
import { asyncHandler } from '../middleware/asyncHandler';
import { publishApprovedVideoJobs, renderShortFormVideo, ShortFormPlatform } from '../services/videoJobs';

const router = Router();

// Webhook secret validation middleware
function validateWebhookSecret(req: Request, res: Response, next: Function): void {
  const secret = process.env.WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — allow (dev mode)
    next();
    return;
  }
  const provided = req.headers['x-webhook-secret'] as string;
  if (provided !== secret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }
  next();
}

router.use(validateWebhookSecret);

// POST /webhooks/n8n/generate — trigger content generation
router.post('/n8n/generate', asyncHandler(async (req: Request, res: Response) => {
  const { episodeId, platform, useClaude } = req.body;
  if (!episodeId || !platform) {
    res.status(400).json({ error: 'Missing required fields: episodeId, platform' });
    return;
  }
  const result = await generateContentFlow({ episodeId, platform, useClaude: useClaude ?? false });
  trackCost({ type: 'claude', amount: DEFAULT_COSTS['claude-call'], model: 'claude', description: `n8n generate: ${episodeId}` });
  res.json({ success: true, data: result });
}));

// POST /webhooks/n8n/video — create/render short-form video job
router.post('/n8n/video', asyncHandler(async (req: Request, res: Response) => {
  const { theme, platformTargets } = req.body;
  if (!theme) {
    res.status(400).json({ error: 'Missing required field: theme' });
    return;
  }
  if (platformTargets && (!Array.isArray(platformTargets) || platformTargets.some((p: string) => p !== 'youtube' && p !== 'tiktok'))) {
    res.status(400).json({ error: 'platformTargets must contain only youtube and/or tiktok' });
    return;
  }
  const result = await renderShortFormVideo({
    ...req.body,
    platformTargets: platformTargets as ShortFormPlatform[] | undefined,
  });
  res.status(result.status === 'rendered' ? 201 : 202).json({ success: result.status === 'rendered', data: result });
}));

// POST /webhooks/n8n/video/orchestrate — legacy production package flow
router.post('/n8n/video/orchestrate', asyncHandler(async (req: Request, res: Response) => {
  const { theme, characters } = req.body;
  if (!theme || !characters) {
    res.status(400).json({ error: 'Missing required fields: theme, characters' });
    return;
  }
  const result = await videoGenerationFlow({ theme, characters });
  res.json({ success: result.video?.status !== 'failed', data: result });
}));

// POST /webhooks/n8n/video/publish-approved — publish approved rendered jobs only
router.post('/n8n/video/publish-approved', asyncHandler(async (_req: Request, res: Response) => {
  const jobs = await publishApprovedVideoJobs();
  res.json({ success: true, published: jobs.length, data: jobs });
}));

// POST /webhooks/n8n/social — trigger social posting
router.post('/n8n/social', asyncHandler(async (req: Request, res: Response) => {
  const { provider, message } = req.body;
  if (!provider || !message) {
    res.status(400).json({ error: 'Missing required fields: provider, message' });
    return;
  }
  const result = await postToSocialFlow({ provider, message });
  res.json({ success: true, data: result });
}));

export default router;
