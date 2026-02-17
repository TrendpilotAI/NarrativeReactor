import { Router, Request, Response } from 'express';
import { generateContentFlow } from '../flows/content-generation';
import { verifyBrandCompliance } from '../flows/compliance';
import { videoGenerationFlow, agenticChatFlow } from '../flows/orchestration';
import { postToSocialFlow, listIntegrationsFlow, getPerformanceDataFlow, getMentionsFlow } from '../flows/integrations';
import { schedulePost, getSchedule, cancelPost } from '../services/calendar';
import { publishToAll } from '../services/publisher';
import { trackPost, getPostPerformance, getBestPerformingContent, getOptimalPostingTimes } from '../services/performanceTracker';
import { saveContent, searchContent, getContentByTag, getContentStats, getContentById } from '../services/contentLibrary';
import { receiveMessage, getMessageLog, sendMessage, getRegisteredAgents } from '../services/agentComm';
import { fetchTrendingTopics, generateBriefFromTrend, autoGenerateContent } from '../services/trendpilotBridge';
import { createCampaign, getCampaign, listCampaigns, advanceCampaign, deleteCampaign } from '../services/campaigns';
import { generateSpeech, listAudioFiles } from '../services/tts';
import { generatePodcastScript, scriptToAudio } from '../services/podcastGenerator';
import { generateDialogue, renderDialogue } from '../services/dialogue';
import { addCompetitor, getCompetitors, recordCompetitorPost, getCompetitorActivity, analyzeCompetitorStrategy } from '../services/competitorTracker';
import { discoverHashtags, getRecommendedHashtags, getHashtagPerformance } from '../services/hashtagDiscovery';
import { getOptimalTimes, suggestNextPostTime } from '../services/postingOptimizer';
import { getDefaultPersonas, buildPersona } from '../services/audiencePersona';
import { createVideoProject, generateStitchingScript, getProjectTimeline } from '../services/videoStitcher';
import { generateSubtitles, generateVTT, embedSubtitles } from '../services/subtitles';
import { getTemplate, customizeTemplate, listTemplates, TemplateType } from '../services/videoTemplates';
import { generateThumbnail } from '../services/thumbnailGenerator';
import { createBrand, getBrand, listBrands, updateBrand, deleteBrand } from '../services/brandManager';
import { analyzeBrandVoice, generateWithVoice, scoreBrandConsistency } from '../services/brandVoice';
import { submitForReview, approveContent, rejectContent, getReviewQueue, getReviewByContentId } from '../services/approvalWorkflow';
import { assignTask, addComment, getComments, getAssignments } from '../services/teamCollab';

const router = Router();

// POST /api/generate — content generation
router.post('/generate', async (req: Request, res: Response) => {
    try {
        const { episodeId, platform, useClaude } = req.body;
        if (!episodeId || !platform) {
            res.status(400).json({ error: 'Missing required fields: episodeId, platform' });
            return;
        }
        const result = await generateContentFlow({ episodeId, platform, useClaude: useClaude ?? false });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/compliance — brand compliance check
router.post('/compliance', async (req: Request, res: Response) => {
    try {
        const { content, platform } = req.body;
        if (!content || !platform) {
            res.status(400).json({ error: 'Missing required fields: content, platform' });
            return;
        }
        const result = await verifyBrandCompliance({ content, platform });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/video — video generation pipeline
router.post('/video', async (req: Request, res: Response) => {
    try {
        const { theme, characters } = req.body;
        if (!theme || !characters) {
            res.status(400).json({ error: 'Missing required fields: theme, characters' });
            return;
        }
        const result = await videoGenerationFlow({ theme, characters });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/chat — agentic chat
router.post('/chat', async (req: Request, res: Response) => {
    try {
        const { message, history, context } = req.body;
        if (!message) {
            res.status(400).json({ error: 'Missing required field: message' });
            return;
        }
        const result = await agenticChatFlow({ message, history, context });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/social/post — social media posting
router.post('/social/post', async (req: Request, res: Response) => {
    try {
        const { provider, message } = req.body;
        if (!provider || !message) {
            res.status(400).json({ error: 'Missing required fields: provider, message' });
            return;
        }
        const result = await postToSocialFlow({ provider, message });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/social/integrations — list connected accounts
router.get('/social/integrations', async (_req: Request, res: Response) => {
    try {
        const result = await listIntegrationsFlow(undefined);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/social/performance — get analytics
router.get('/social/performance', async (req: Request, res: Response) => {
    try {
        const provider = req.query.provider as string;
        const days = parseInt(req.query.days as string) || 7;
        if (!provider) {
            res.status(400).json({ error: 'Missing required query param: provider' });
            return;
        }
        const result = await getPerformanceDataFlow({ provider, days });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/social/mentions — get mentions
router.get('/social/mentions', async (req: Request, res: Response) => {
    try {
        const provider = req.query.provider as string;
        if (!provider) {
            res.status(400).json({ error: 'Missing required query param: provider' });
            return;
        }
        const result = await getMentionsFlow({ provider });
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/calendar — list scheduled posts
router.get('/calendar', async (req: Request, res: Response) => {
    try {
        const start = (req.query.start as string) || new Date(0).toISOString();
        const end = (req.query.end as string) || new Date('2099-12-31').toISOString();
        const posts = await getSchedule(start, end);
        res.json(posts);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/calendar — schedule a new post
router.post('/calendar', async (req: Request, res: Response) => {
    try {
        const { content, platform, scheduledAt } = req.body;
        if (!content || !platform || !scheduledAt) {
            res.status(400).json({ error: 'Missing required fields: content, platform, scheduledAt' });
            return;
        }
        const post = await schedulePost(content, platform, scheduledAt);
        res.status(201).json(post);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/calendar/:id — cancel a scheduled post
router.delete('/calendar/:id', async (req: Request, res: Response) => {
    try {
        const post = await cancelPost(req.params.id);
        if (!post) {
            res.status(404).json({ error: 'Post not found' });
            return;
        }
        res.json(post);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/publish — cross-platform publish
router.post('/publish', async (req: Request, res: Response) => {
    try {
        const { content, platforms } = req.body;
        if (!content || !platforms || !Array.isArray(platforms)) {
            res.status(400).json({ error: 'Missing required fields: content, platforms (array)' });
            return;
        }
        const results = await publishToAll(content, platforms);
        res.json({ results });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/performance/track — track post metrics
router.post('/performance/track', async (req: Request, res: Response) => {
    try {
        const { postId, platform, metrics } = req.body;
        if (!postId || !platform || !metrics) {
            res.status(400).json({ error: 'Missing required fields: postId, platform, metrics' });
            return;
        }
        const entry = trackPost(postId, platform, metrics);
        res.status(201).json(entry);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/performance/:postId — get post performance
router.get('/performance/:postId', async (req: Request, res: Response) => {
    try {
        const entries = getPostPerformance(req.params.postId);
        res.json(entries);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/performance/best?days=7 — best performing content
router.get('/performance/best', async (req: Request, res: Response) => {
    try {
        const days = parseInt(req.query.days as string) || 7;
        const results = getBestPerformingContent(days);
        res.json(results);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/performance/optimal-times?platform= — optimal posting times
router.get('/performance/optimal-times', async (req: Request, res: Response) => {
    try {
        const platform = req.query.platform as string;
        if (!platform) {
            res.status(400).json({ error: 'Missing required query param: platform' });
            return;
        }
        const times = getOptimalPostingTimes(platform);
        res.json(times);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/library — list all content or stats
router.get('/library', async (_req: Request, res: Response) => {
    try {
        const stats = getContentStats();
        res.json(stats);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/library/search?q= — search content
router.get('/library/search', async (req: Request, res: Response) => {
    try {
        const q = req.query.q as string;
        if (!q) {
            res.status(400).json({ error: 'Missing required query param: q' });
            return;
        }
        const results = searchContent(q);
        res.json(results);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/library/tag/:tag — content by tag
router.get('/library/tag/:tag', async (req: Request, res: Response) => {
    try {
        const results = getContentByTag(req.params.tag);
        res.json(results);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/library — save content
router.post('/library', async (req: Request, res: Response) => {
    try {
        const { content, metadata } = req.body;
        if (!content) {
            res.status(400).json({ error: 'Missing required field: content' });
            return;
        }
        const entry = saveContent(content, metadata || {});
        res.status(201).json(entry);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Agent Communication ====================

// POST /api/agents/message — receive agent message
router.post('/agents/message', async (req: Request, res: Response) => {
    try {
        const result = await receiveMessage(req.body);
        res.json(result);
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// GET /api/agents/log — message log
router.get('/agents/log', async (_req: Request, res: Response) => {
    res.json(getMessageLog());
});

// POST /api/agents/send — send message to another agent
router.post('/agents/send', async (req: Request, res: Response) => {
    try {
        const { target, message } = req.body;
        if (!target || !message) {
            res.status(400).json({ error: 'Missing required fields: target, message' });
            return;
        }
        const result = await sendMessage(target, message);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/agents/registry — list registered agents
router.get('/agents/registry', async (_req: Request, res: Response) => {
    res.json(getRegisteredAgents());
});

// ==================== Trendpilot Integration ====================

// GET /api/trends — fetch trending topics from Trendpilot
router.get('/trends', async (_req: Request, res: Response) => {
    try {
        const trends = await fetchTrendingTopics();
        res.json(trends);
    } catch (err: any) {
        res.status(502).json({ error: err.message });
    }
});

// POST /api/trends/brief — generate brief from a trend
router.post('/trends/brief', async (req: Request, res: Response) => {
    try {
        const { trend } = req.body;
        if (!trend) {
            res.status(400).json({ error: 'Missing required field: trend' });
            return;
        }
        const brief = await generateBriefFromTrend(trend);
        res.json(brief);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/trends/auto-generate — full pipeline from trend to content
router.post('/trends/auto-generate', async (req: Request, res: Response) => {
    try {
        const { trend } = req.body;
        if (!trend) {
            res.status(400).json({ error: 'Missing required field: trend' });
            return;
        }
        const result = await autoGenerateContent(trend);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Campaigns ====================

// GET /api/campaigns — list all campaigns
router.get('/campaigns', async (_req: Request, res: Response) => {
    try {
        res.json(listCampaigns());
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/campaigns/:id — get single campaign
router.get('/campaigns/:id', async (req: Request, res: Response) => {
    try {
        const campaign = getCampaign(req.params.id);
        if (!campaign) {
            res.status(404).json({ error: 'Campaign not found' });
            return;
        }
        res.json(campaign);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns — create campaign
router.post('/campaigns', async (req: Request, res: Response) => {
    try {
        const { theme, days, postsPerDay, name } = req.body;
        if (!theme || !days || !postsPerDay) {
            res.status(400).json({ error: 'Missing required fields: theme, days, postsPerDay' });
            return;
        }
        const campaign = createCampaign(theme, days, postsPerDay, name);
        res.status(201).json(campaign);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/campaigns/:id/advance — publish next post
router.post('/campaigns/:id/advance', async (req: Request, res: Response) => {
    try {
        const result = advanceCampaign(req.params.id);
        if (!result) {
            res.status(404).json({ error: 'Campaign not found' });
            return;
        }
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/campaigns/:id — delete campaign
router.delete('/campaigns/:id', async (req: Request, res: Response) => {
    try {
        const deleted = deleteCampaign(req.params.id);
        if (!deleted) {
            res.status(404).json({ error: 'Campaign not found' });
            return;
        }
        res.json({ deleted: true });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Audio / Voice ====================

// POST /api/audio/tts — text to speech
router.post('/audio/tts', async (req: Request, res: Response) => {
    try {
        const { text, voiceId } = req.body;
        if (!text) {
            res.status(400).json({ error: 'Missing required field: text' });
            return;
        }
        const result = await generateSpeech(text, voiceId);
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/audio/podcast — generate podcast
router.post('/audio/podcast', async (req: Request, res: Response) => {
    try {
        const { topic, style, generateAudio } = req.body;
        if (!topic || !style) {
            res.status(400).json({ error: 'Missing required fields: topic, style' });
            return;
        }
        const script = await generatePodcastScript(topic, style);
        if (generateAudio) {
            const result = await scriptToAudio(script);
            res.json(result);
            return;
        }
        res.json(script);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/audio/dialogue — generate dialogue
router.post('/audio/dialogue', async (req: Request, res: Response) => {
    try {
        const { characters, topic, generateAudio } = req.body;
        if (!characters || !topic) {
            res.status(400).json({ error: 'Missing required fields: characters, topic' });
            return;
        }
        const dialogue = await generateDialogue(characters, topic);
        if (generateAudio) {
            const result = await renderDialogue(dialogue);
            res.json(result);
            return;
        }
        res.json(dialogue);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/audio/library — list generated audio files
router.get('/audio/library', async (_req: Request, res: Response) => {
    try {
        const files = listAudioFiles();
        res.json({ files, count: files.length });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Campaign Intelligence ====================

// GET /api/competitors — list competitors
router.get('/competitors', async (_req: Request, res: Response) => {
    try {
        res.json(getCompetitors());
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/competitors — add competitor
router.post('/competitors', async (req: Request, res: Response) => {
    try {
        const { name, platforms } = req.body;
        if (!name || !platforms) {
            res.status(400).json({ error: 'Missing required fields: name, platforms' });
            return;
        }
        const competitor = addCompetitor(name, platforms);
        res.status(201).json(competitor);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/competitors/:id/posts — record a competitor post
router.post('/competitors/:id/posts', async (req: Request, res: Response) => {
    try {
        const post = recordCompetitorPost(req.params.id, req.body);
        res.status(201).json(post);
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
});

// GET /api/competitors/:id/activity — get recent activity
router.get('/competitors/:id/activity', async (req: Request, res: Response) => {
    try {
        const days = parseInt(req.query.days as string) || 30;
        res.json(getCompetitorActivity(req.params.id, days));
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
});

// GET /api/competitors/:id/strategy — analyze strategy
router.get('/competitors/:id/strategy', async (req: Request, res: Response) => {
    try {
        res.json(analyzeCompetitorStrategy(req.params.id));
    } catch (err: any) {
        res.status(404).json({ error: err.message });
    }
});

// GET /api/hashtags?topic= — discover hashtags
router.get('/hashtags', async (req: Request, res: Response) => {
    try {
        const topic = req.query.topic as string;
        if (!topic) {
            res.status(400).json({ error: 'Missing required query param: topic' });
            return;
        }
        res.json(discoverHashtags(topic));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/hashtags/recommend — get recommended hashtags for content
router.post('/hashtags/recommend', async (req: Request, res: Response) => {
    try {
        const { content, platform, count } = req.body;
        if (!content || !platform) {
            res.status(400).json({ error: 'Missing required fields: content, platform' });
            return;
        }
        res.json(getRecommendedHashtags(content, platform, count));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/hashtags/:tag/performance — hashtag performance
router.get('/hashtags/:tag/performance', async (req: Request, res: Response) => {
    try {
        res.json(getHashtagPerformance(`#${req.params.tag}`));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/optimal-times?platform=&timezone= — optimal posting times
router.get('/optimal-times', async (req: Request, res: Response) => {
    try {
        const platform = req.query.platform as string;
        if (!platform) {
            res.status(400).json({ error: 'Missing required query param: platform' });
            return;
        }
        const timezone = req.query.timezone as string;
        res.json(getOptimalTimes(platform, timezone));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/optimal-times/next?platform= — next suggested post time
router.get('/optimal-times/next', async (req: Request, res: Response) => {
    try {
        const platform = req.query.platform as string;
        if (!platform) {
            res.status(400).json({ error: 'Missing required query param: platform' });
            return;
        }
        res.json(suggestNextPostTime(platform));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/personas — get default personas
router.get('/personas', async (_req: Request, res: Response) => {
    try {
        res.json(getDefaultPersonas());
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/personas/build — build custom persona from engagement data
router.post('/personas/build', async (req: Request, res: Response) => {
    try {
        res.json(buildPersona(req.body));
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Advanced Video Pipeline ====================

// POST /api/video/project — create video project + get stitching script & timeline
router.post('/video/project', async (req: Request, res: Response) => {
    try {
        const { scenes } = req.body;
        if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
            res.status(400).json({ error: 'Missing required field: scenes (non-empty array)' });
            return;
        }
        const project = createVideoProject(scenes);
        const script = generateStitchingScript(project);
        const timeline = getProjectTimeline(project);
        res.status(201).json({ project, script, timeline });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/video/subtitles — generate subtitles
router.post('/video/subtitles', async (req: Request, res: Response) => {
    try {
        const { script, format, wordTimings, videoUrl } = req.body;
        if (!script) {
            res.status(400).json({ error: 'Missing required field: script' });
            return;
        }
        const fmt = format || 'srt';
        const content = fmt === 'vtt' ? generateVTT(script, wordTimings) : generateSubtitles(script, wordTimings);
        const result: any = { format: fmt, content };
        if (videoUrl) {
            result.embedCommand = embedSubtitles(videoUrl, content);
        }
        res.json(result);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/video/templates — list all templates or get specific one
router.get('/video/templates', async (req: Request, res: Response) => {
    try {
        const type = req.query.type as string | undefined;
        if (type) {
            const template = getTemplate(type as TemplateType);
            res.json(template);
            return;
        }
        res.json(listTemplates());
    } catch (err: any) {
        res.status(400).json({ error: err.message });
    }
});

// POST /api/video/thumbnail — generate thumbnail
router.post('/video/thumbnail', async (req: Request, res: Response) => {
    try {
        const { imageUrl, title, subtitle, style } = req.body;
        if (!imageUrl || !title) {
            res.status(400).json({ error: 'Missing required fields: imageUrl, title' });
            return;
        }
        const config = generateThumbnail(imageUrl, title, subtitle, style);
        res.json(config);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== Brand Management ====================

router.get('/brands', async (_req: Request, res: Response) => {
    try { res.json(listBrands()); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/brands/:id', async (req: Request, res: Response) => {
    try {
        const brand = getBrand(req.params.id);
        if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
        res.json(brand);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/brands', async (req: Request, res: Response) => {
    try {
        const { name, guidelines, voiceTone, colors, logos, targetAudience, prohibitedWords } = req.body;
        if (!name) { res.status(400).json({ error: 'Missing required field: name' }); return; }
        const brand = createBrand({
            name,
            guidelines: guidelines || '',
            voiceTone: voiceTone || '',
            colors: colors || [],
            logos: logos || [],
            targetAudience: targetAudience || '',
            prohibitedWords: prohibitedWords || [],
        });
        res.status(201).json(brand);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/brands/:id', async (req: Request, res: Response) => {
    try {
        const brand = updateBrand(req.params.id, req.body);
        if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
        res.json(brand);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/brands/:id', async (req: Request, res: Response) => {
    try {
        const deleted = deleteBrand(req.params.id);
        if (!deleted) { res.status(404).json({ error: 'Brand not found' }); return; }
        res.json({ deleted: true });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/brands/:id/voice-analysis — analyze brand voice from samples
router.post('/brands/:id/voice-analysis', async (req: Request, res: Response) => {
    try {
        const { samples } = req.body;
        if (!samples || !Array.isArray(samples)) {
            res.status(400).json({ error: 'Missing required field: samples (array of strings)' }); return;
        }
        const profile = analyzeBrandVoice(samples);
        res.json({ brandId: req.params.id, voiceProfile: profile });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/brands/:id/generate — generate content in brand voice
router.post('/brands/:id/generate', async (req: Request, res: Response) => {
    try {
        const { prompt } = req.body;
        if (!prompt) { res.status(400).json({ error: 'Missing required field: prompt' }); return; }
        const result = generateWithVoice(prompt, req.params.id);
        res.json(result);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// POST /api/brands/:id/score — score content brand consistency
router.post('/brands/:id/score', async (req: Request, res: Response) => {
    try {
        const { content } = req.body;
        if (!content) { res.status(400).json({ error: 'Missing required field: content' }); return; }
        const score = scoreBrandConsistency(content, req.params.id);
        res.json({ brandId: req.params.id, score });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==================== Approval Workflows ====================

router.post('/content/:id/review', async (req: Request, res: Response) => {
    try {
        const { brandId } = req.body;
        if (!brandId) { res.status(400).json({ error: 'Missing required field: brandId' }); return; }
        const review = submitForReview(req.params.id, brandId);
        res.status(201).json(review);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/content/:id/approve', async (req: Request, res: Response) => {
    try {
        const { reviewerId } = req.body;
        if (!reviewerId) { res.status(400).json({ error: 'Missing required field: reviewerId' }); return; }
        const review = approveContent(req.params.id, reviewerId);
        res.json(review);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.post('/content/:id/reject', async (req: Request, res: Response) => {
    try {
        const { reviewerId, reason } = req.body;
        if (!reviewerId || !reason) { res.status(400).json({ error: 'Missing required fields: reviewerId, reason' }); return; }
        const review = rejectContent(req.params.id, reviewerId, reason);
        res.json(review);
    } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.get('/review-queue', async (req: Request, res: Response) => {
    try {
        const brandId = req.query.brandId as string | undefined;
        res.json(getReviewQueue(brandId));
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/content/:id/review', async (req: Request, res: Response) => {
    try {
        const review = getReviewByContentId(req.params.id);
        if (!review) { res.status(404).json({ error: 'No review found' }); return; }
        res.json(review);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ==================== Team Collaboration ====================

router.post('/content/:id/comments', async (req: Request, res: Response) => {
    try {
        const { userId, comment, parentId } = req.body;
        if (!userId || !comment) { res.status(400).json({ error: 'Missing required fields: userId, comment' }); return; }
        const entry = addComment(req.params.id, userId, comment, parentId);
        res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/content/:id/comments', async (req: Request, res: Response) => {
    try { res.json(getComments(req.params.id)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/tasks/assign', async (req: Request, res: Response) => {
    try {
        const { contentId, userId, deadline } = req.body;
        if (!contentId || !userId || !deadline) { res.status(400).json({ error: 'Missing required fields: contentId, userId, deadline' }); return; }
        const task = assignTask(contentId, userId, deadline);
        res.status(201).json(task);
    } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/tasks/:userId', async (req: Request, res: Response) => {
    try { res.json(getAssignments(req.params.userId)); } catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
