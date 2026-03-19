import { Router, Request, Response } from 'express';
import { generateContentFlow } from '../flows/content-generation';
import { videoGenerationFlow } from '../flows/orchestration';
import { postToSocialFlow } from '../flows/integrations';
import { trackCost, DEFAULT_COSTS } from '../services/costTracker';

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
router.post('/n8n/generate', async (req: Request, res: Response) => {
  try {
    const { episodeId, platform, useClaude } = req.body;
    if (!episodeId || !platform) {
      res.status(400).json({ error: 'Missing required fields: episodeId, platform' });
      return;
    }
    const result = await generateContentFlow({ episodeId, platform, useClaude: useClaude ?? false });
    trackCost({ type: 'claude', amount: DEFAULT_COSTS['claude-call'], model: 'claude', description: `n8n generate: ${episodeId}` });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /webhooks/n8n/video — trigger video generation
router.post('/n8n/video', async (req: Request, res: Response) => {
  try {
    const { theme, characters } = req.body;
    if (!theme || !characters) {
      res.status(400).json({ error: 'Missing required fields: theme, characters' });
      return;
    }
    const result = await videoGenerationFlow({ theme, characters });
    trackCost({ type: 'video', amount: DEFAULT_COSTS['fal-video'], model: 'fal-video', description: `n8n video: ${theme}` });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /webhooks/n8n/social — trigger social posting
router.post('/n8n/social', async (req: Request, res: Response) => {
  try {
    const { provider, message } = req.body;
    if (!provider || !message) {
      res.status(400).json({ error: 'Missing required fields: provider, message' });
      return;
    }
    const result = await postToSocialFlow({ provider, message });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
