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
import { guardDestructive } from '../lib/productionGuard';
import { asyncHandler } from '../middleware/asyncHandler';

const router = Router();

// POST /api/generate — content generation
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
    const { episodeId, platform, useClaude } = req.body;
    if (!episodeId || !platform) {
        res.status(400).json({ error: 'Missing required fields: episodeId, platform' });
        return;
    }
    const result = await generateContentFlow({ episodeId, platform, useClaude: useClaude ?? false });
    res.json(result);
}));

// POST /api/compliance — brand compliance check
router.post('/compliance', asyncHandler(async (req: Request, res: Response) => {
    const { content, platform } = req.body;
    if (!content || !platform) {
        res.status(400).json({ error: 'Missing required fields: content, platform' });
        return;
    }
    const result = await verifyBrandCompliance({ content, platform });
    res.json(result);
}));

// POST /api/video — video generation pipeline
router.post('/video', asyncHandler(async (req: Request, res: Response) => {
    const { theme, characters } = req.body;
    if (!theme || !characters) {
        res.status(400).json({ error: 'Missing required fields: theme, characters' });
        return;
    }
    const result = await videoGenerationFlow({ theme, characters });
    res.json(result);
}));

// POST /api/chat — agentic chat
router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
    const { message, history, context } = req.body;
    if (!message) {
        res.status(400).json({ error: 'Missing required field: message' });
        return;
    }
    const result = await agenticChatFlow({ message, history, context });
    res.json(result);
}));

// POST /api/social/post — social media posting
router.post('/social/post', asyncHandler(async (req: Request, res: Response) => {
    const { provider, message } = req.body;
    if (!provider || !message) {
        res.status(400).json({ error: 'Missing required fields: provider, message' });
        return;
    }
    const result = await postToSocialFlow({ provider, message });
    res.json(result);
}));

// GET /api/social/integrations — list connected accounts
router.get('/social/integrations', asyncHandler(async (_req: Request, res: Response) => {
    const result = await listIntegrationsFlow(undefined);
    res.json(result);
}));

// GET /api/social/performance — get analytics
router.get('/social/performance', asyncHandler(async (req: Request, res: Response) => {
    const provider = req.query.provider as string;
    const days = parseInt(req.query.days as string) || 7;
    if (!provider) {
        res.status(400).json({ error: 'Missing required query param: provider' });
        return;
    }
    const result = await getPerformanceDataFlow({ provider, days });
    res.json(result);
}));

// GET /api/social/mentions — get mentions
router.get('/social/mentions', asyncHandler(async (req: Request, res: Response) => {
    const provider = req.query.provider as string;
    if (!provider) {
        res.status(400).json({ error: 'Missing required query param: provider' });
        return;
    }
    const result = await getMentionsFlow({ provider });
    res.json(result);
}));

// GET /api/calendar — list scheduled posts
router.get('/calendar', asyncHandler(async (req: Request, res: Response) => {
    const start = (req.query.start as string) || new Date(0).toISOString();
    const end = (req.query.end as string) || new Date('2099-12-31').toISOString();
    const posts = await getSchedule(start, end);
    res.json(posts);
}));

// POST /api/calendar — schedule a new post
router.post('/calendar', asyncHandler(async (req: Request, res: Response) => {
    const { content, platform, scheduledAt } = req.body;
    if (!content || !platform || !scheduledAt) {
        res.status(400).json({ error: 'Missing required fields: content, platform, scheduledAt' });
        return;
    }
    const post = await schedulePost(content, platform, scheduledAt);
    res.status(201).json(post);
}));

// DELETE /api/calendar/:id — cancel a scheduled post
router.delete('/calendar/:id', asyncHandler(async (req: Request, res: Response) => {
    const post = await cancelPost(req.params.id);
    if (!post) {
        res.status(404).json({ error: 'Post not found' });
        return;
    }
    res.json(post);
}));

// POST /api/publish — cross-platform publish
router.post('/publish', asyncHandler(async (req: Request, res: Response) => {
    const { content, platforms } = req.body;
    if (!content || !platforms || !Array.isArray(platforms)) {
        res.status(400).json({ error: 'Missing required fields: content, platforms (array)' });
        return;
    }
    const results = await publishToAll(content, platforms);
    res.json({ results });
}));

// POST /api/performance/track — track post metrics
router.post('/performance/track', asyncHandler(async (req: Request, res: Response) => {
    const { postId, platform, metrics } = req.body;
    if (!postId || !platform || !metrics) {
        res.status(400).json({ error: 'Missing required fields: postId, platform, metrics' });
        return;
    }
    const entry = trackPost(postId, platform, metrics);
    res.status(201).json(entry);
}));

// GET /api/performance/:postId — get post performance
router.get('/performance/:postId', asyncHandler(async (req: Request, res: Response) => {
    const entries = getPostPerformance(req.params.postId);
    res.json(entries);
}));

// GET /api/performance/best?days=7 — best performing content
router.get('/performance/best', asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 7;
    const results = getBestPerformingContent(days);
    res.json(results);
}));

// GET /api/performance/optimal-times?platform= — optimal posting times
router.get('/performance/optimal-times', asyncHandler(async (req: Request, res: Response) => {
    const platform = req.query.platform as string;
    if (!platform) {
        res.status(400).json({ error: 'Missing required query param: platform' });
        return;
    }
    const times = getOptimalPostingTimes(platform);
    res.json(times);
}));

// GET /api/library — list all content or stats
router.get('/library', asyncHandler(async (_req: Request, res: Response) => {
    const stats = getContentStats();
    res.json(stats);
}));

// GET /api/library/search?q= — search content
router.get('/library/search', asyncHandler(async (req: Request, res: Response) => {
    const q = req.query.q as string;
    if (!q) {
        res.status(400).json({ error: 'Missing required query param: q' });
        return;
    }
    const results = searchContent(q);
    res.json(results);
}));

// GET /api/library/tag/:tag — content by tag
router.get('/library/tag/:tag', asyncHandler(async (req: Request, res: Response) => {
    const results = getContentByTag(req.params.tag);
    res.json(results);
}));

// GET /api/library/:id — get content by id
router.get('/library/:id', asyncHandler(async (req: Request, res: Response) => {
    const entry = getContentById(req.params.id);
    if (!entry) {
        res.status(404).json({ error: 'Content not found' });
        return;
    }
    res.json(entry);
}));

// POST /api/library — save content
router.post('/library', asyncHandler(async (req: Request, res: Response) => {
    const { content, metadata } = req.body;
    if (!content) {
        res.status(400).json({ error: 'Missing required field: content' });
        return;
    }
    const entry = saveContent(content, metadata || {});
    res.status(201).json(entry);
}));

// ==================== Agent Communication ====================

// POST /api/agents/message — receive agent message
router.post('/agents/message', asyncHandler(async (req: Request, res: Response) => {
    const result = await receiveMessage(req.body);
    res.json(result);
}));

// GET /api/agents/log — message log
router.get('/agents/log', (_req: Request, res: Response) => {
    res.json(getMessageLog());
});

// POST /api/agents/send — send message to another agent
router.post('/agents/send', asyncHandler(async (req: Request, res: Response) => {
    const { target, message } = req.body;
    if (!target || !message) {
        res.status(400).json({ error: 'Missing required fields: target, message' });
        return;
    }
    const result = await sendMessage(target, message);
    res.json(result);
}));

// GET /api/agents/registry — list registered agents
router.get('/agents/registry', (_req: Request, res: Response) => {
    res.json(getRegisteredAgents());
});

// ==================== Trendpilot Integration ====================

// GET /api/trends — fetch trending topics from Trendpilot
router.get('/trends', asyncHandler(async (_req: Request, res: Response) => {
    const trends = await fetchTrendingTopics();
    res.json(trends);
}));

// POST /api/trends/brief — generate brief from a trend
router.post('/trends/brief', asyncHandler(async (req: Request, res: Response) => {
    const { trend } = req.body;
    if (!trend) {
        res.status(400).json({ error: 'Missing required field: trend' });
        return;
    }
    const brief = await generateBriefFromTrend(trend);
    res.json(brief);
}));

// POST /api/trends/auto-generate — full pipeline from trend to content
router.post('/trends/auto-generate', asyncHandler(async (req: Request, res: Response) => {
    const { trend } = req.body;
    if (!trend) {
        res.status(400).json({ error: 'Missing required field: trend' });
        return;
    }
    const result = await autoGenerateContent(trend);
    res.json(result);
}));

// ==================== Campaigns ====================

// GET /api/campaigns — list all campaigns
router.get('/campaigns', asyncHandler(async (_req: Request, res: Response) => {
    res.json(listCampaigns());
}));

// GET /api/campaigns/:id — get single campaign
router.get('/campaigns/:id', asyncHandler(async (req: Request, res: Response) => {
    const campaign = getCampaign(req.params.id);
    if (!campaign) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
    }
    res.json(campaign);
}));

// POST /api/campaigns — create campaign
router.post('/campaigns', asyncHandler(async (req: Request, res: Response) => {
    const { theme, days, postsPerDay, name } = req.body;
    if (!theme || !days || !postsPerDay) {
        res.status(400).json({ error: 'Missing required fields: theme, days, postsPerDay' });
        return;
    }
    const campaign = createCampaign(theme, days, postsPerDay, name);
    res.status(201).json(campaign);
}));

// POST /api/campaigns/:id/advance — publish next post
router.post('/campaigns/:id/advance', asyncHandler(async (req: Request, res: Response) => {
    const result = advanceCampaign(req.params.id);
    if (!result) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
    }
    res.json(result);
}));

// DELETE /api/campaigns/:id — delete campaign
router.delete('/campaigns/:id', asyncHandler(async (req: Request, res: Response) => {
    const deleted = deleteCampaign(req.params.id);
    if (!deleted) {
        res.status(404).json({ error: 'Campaign not found' });
        return;
    }
    res.json({ deleted: true });
}));

// ==================== Audio / Voice ====================

// POST /api/audio/tts — text to speech
router.post('/audio/tts', asyncHandler(async (req: Request, res: Response) => {
    const { text, voiceId } = req.body;
    if (!text) {
        res.status(400).json({ error: 'Missing required field: text' });
        return;
    }
    const result = await generateSpeech(text, voiceId);
    res.json(result);
}));

// POST /api/audio/podcast — generate podcast
router.post('/audio/podcast', asyncHandler(async (req: Request, res: Response) => {
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
}));

// POST /api/audio/dialogue — generate dialogue
router.post('/audio/dialogue', asyncHandler(async (req: Request, res: Response) => {
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
}));

// GET /api/audio/library — list generated audio files
router.get('/audio/library', asyncHandler(async (_req: Request, res: Response) => {
    const files = listAudioFiles();
    res.json({ files, count: files.length });
}));

// ==================== Campaign Intelligence ====================

// GET /api/competitors — list competitors
router.get('/competitors', asyncHandler(async (_req: Request, res: Response) => {
    res.json(getCompetitors());
}));

// POST /api/competitors — add competitor
router.post('/competitors', asyncHandler(async (req: Request, res: Response) => {
    const { name, platforms } = req.body;
    if (!name || !platforms) {
        res.status(400).json({ error: 'Missing required fields: name, platforms' });
        return;
    }
    const competitor = addCompetitor(name, platforms);
    res.status(201).json(competitor);
}));

// POST /api/competitors/:id/posts — record a competitor post
router.post('/competitors/:id/posts', asyncHandler(async (req: Request, res: Response) => {
    const post = recordCompetitorPost(req.params.id, req.body);
    res.status(201).json(post);
}));

// GET /api/competitors/:id/activity — get recent activity
router.get('/competitors/:id/activity', asyncHandler(async (req: Request, res: Response) => {
    const days = parseInt(req.query.days as string) || 30;
    res.json(getCompetitorActivity(req.params.id, days));
}));

// GET /api/competitors/:id/strategy — analyze strategy
router.get('/competitors/:id/strategy', asyncHandler(async (req: Request, res: Response) => {
    res.json(analyzeCompetitorStrategy(req.params.id));
}));

// GET /api/hashtags?topic= — discover hashtags
router.get('/hashtags', asyncHandler(async (req: Request, res: Response) => {
    const topic = req.query.topic as string;
    if (!topic) {
        res.status(400).json({ error: 'Missing required query param: topic' });
        return;
    }
    res.json(discoverHashtags(topic));
}));

// POST /api/hashtags/recommend — get recommended hashtags for content
router.post('/hashtags/recommend', asyncHandler(async (req: Request, res: Response) => {
    const { content, platform, count } = req.body;
    if (!content || !platform) {
        res.status(400).json({ error: 'Missing required fields: content, platform' });
        return;
    }
    res.json(getRecommendedHashtags(content, platform, count));
}));

// GET /api/hashtags/:tag/performance — hashtag performance
router.get('/hashtags/:tag/performance', asyncHandler(async (req: Request, res: Response) => {
    res.json(getHashtagPerformance(`#${req.params.tag}`));
}));

// GET /api/optimal-times?platform=&timezone= — optimal posting times
router.get('/optimal-times', asyncHandler(async (req: Request, res: Response) => {
    const platform = req.query.platform as string;
    if (!platform) {
        res.status(400).json({ error: 'Missing required query param: platform' });
        return;
    }
    const timezone = req.query.timezone as string;
    res.json(getOptimalTimes(platform, timezone));
}));

// GET /api/optimal-times/next?platform= — next suggested post time
router.get('/optimal-times/next', asyncHandler(async (req: Request, res: Response) => {
    const platform = req.query.platform as string;
    if (!platform) {
        res.status(400).json({ error: 'Missing required query param: platform' });
        return;
    }
    res.json(suggestNextPostTime(platform));
}));

// GET /api/personas — get default personas
router.get('/personas', asyncHandler(async (_req: Request, res: Response) => {
    res.json(getDefaultPersonas());
}));

// POST /api/personas/build — build custom persona from engagement data
router.post('/personas/build', asyncHandler(async (req: Request, res: Response) => {
    res.json(buildPersona(req.body));
}));

// ==================== Advanced Video Pipeline ====================

// POST /api/video/project — create video project + get stitching script & timeline
router.post('/video/project', asyncHandler(async (req: Request, res: Response) => {
    const { scenes } = req.body;
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
        res.status(400).json({ error: 'Missing required field: scenes (non-empty array)' });
        return;
    }
    const project = createVideoProject(scenes);
    const script = generateStitchingScript(project);
    const timeline = getProjectTimeline(project);
    res.status(201).json({ project, script, timeline });
}));

// POST /api/video/subtitles — generate subtitles
router.post('/video/subtitles', asyncHandler(async (req: Request, res: Response) => {
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
}));

// GET /api/video/templates — list all templates or get specific one
router.get('/video/templates', asyncHandler(async (req: Request, res: Response) => {
    const type = req.query.type as string | undefined;
    if (type) {
        const template = getTemplate(type as TemplateType);
        res.json(template);
        return;
    }
    res.json(listTemplates());
}));

// POST /api/video/thumbnail — generate thumbnail
router.post('/video/thumbnail', asyncHandler(async (req: Request, res: Response) => {
    const { imageUrl, title, subtitle, style } = req.body;
    if (!imageUrl || !title) {
        res.status(400).json({ error: 'Missing required fields: imageUrl, title' });
        return;
    }
    const config = generateThumbnail(imageUrl, title, subtitle, style);
    res.json(config);
}));

// ==================== Brand Management ====================

router.get('/brands', asyncHandler(async (_req: Request, res: Response) => {
    res.json(listBrands());
}));

router.get('/brands/:id', asyncHandler(async (req: Request, res: Response) => {
    const brand = getBrand(req.params.id);
    if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
    res.json(brand);
}));

router.post('/brands', asyncHandler(async (req: Request, res: Response) => {
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
}));

router.put('/brands/:id', asyncHandler(async (req: Request, res: Response) => {
    const brand = updateBrand(req.params.id, req.body);
    if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
    res.json(brand);
}));

router.delete('/brands/:id', asyncHandler(async (req: Request, res: Response) => {
    const deleted = deleteBrand(req.params.id);
    if (!deleted) { res.status(404).json({ error: 'Brand not found' }); return; }
    res.json({ deleted: true });
}));

// POST /api/brands/:id/voice-analysis — analyze brand voice from samples
router.post('/brands/:id/voice-analysis', asyncHandler(async (req: Request, res: Response) => {
    const { samples } = req.body;
    if (!samples || !Array.isArray(samples)) {
        res.status(400).json({ error: 'Missing required field: samples (array of strings)' }); return;
    }
    const profile = analyzeBrandVoice(samples);
    res.json({ brandId: req.params.id, voiceProfile: profile });
}));

// POST /api/brands/:id/generate — generate content in brand voice
router.post('/brands/:id/generate', asyncHandler(async (req: Request, res: Response) => {
    const { prompt } = req.body;
    if (!prompt) { res.status(400).json({ error: 'Missing required field: prompt' }); return; }
    const result = generateWithVoice(prompt, req.params.id);
    res.json(result);
}));

// POST /api/brands/:id/score — score content brand consistency
router.post('/brands/:id/score', asyncHandler(async (req: Request, res: Response) => {
    const { content } = req.body;
    if (!content) { res.status(400).json({ error: 'Missing required field: content' }); return; }
    const score = scoreBrandConsistency(content, req.params.id);
    res.json({ brandId: req.params.id, score });
}));

// ==================== Approval Workflows ====================

router.post('/content/:id/review', asyncHandler(async (req: Request, res: Response) => {
    const { brandId } = req.body;
    if (!brandId) { res.status(400).json({ error: 'Missing required field: brandId' }); return; }
    const review = submitForReview(req.params.id, brandId);
    res.status(201).json(review);
}));

router.post('/content/:id/approve', asyncHandler(async (req: Request, res: Response) => {
    const { reviewerId } = req.body;
    if (!reviewerId) { res.status(400).json({ error: 'Missing required field: reviewerId' }); return; }
    const review = approveContent(req.params.id, reviewerId);
    res.json(review);
}));

router.post('/content/:id/reject', asyncHandler(async (req: Request, res: Response) => {
    const { reviewerId, reason } = req.body;
    if (!reviewerId || !reason) { res.status(400).json({ error: 'Missing required fields: reviewerId, reason' }); return; }
    const review = rejectContent(req.params.id, reviewerId, reason);
    res.json(review);
}));

router.get('/review-queue', asyncHandler(async (req: Request, res: Response) => {
    const brandId = req.query.brandId as string | undefined;
    res.json(getReviewQueue(brandId));
}));

router.get('/content/:id/review', asyncHandler(async (req: Request, res: Response) => {
    const review = getReviewByContentId(req.params.id);
    if (!review) { res.status(404).json({ error: 'No review found' }); return; }
    res.json(review);
}));

// ==================== Team Collaboration ====================

router.post('/content/:id/comments', asyncHandler(async (req: Request, res: Response) => {
    const { userId, comment, parentId } = req.body;
    if (!userId || !comment) { res.status(400).json({ error: 'Missing required fields: userId, comment' }); return; }
    const entry = addComment(req.params.id, userId, comment, parentId);
    res.status(201).json(entry);
}));

router.get('/content/:id/comments', asyncHandler(async (req: Request, res: Response) => {
    res.json(getComments(req.params.id));
}));

router.post('/tasks/assign', asyncHandler(async (req: Request, res: Response) => {
    const { contentId, userId, deadline } = req.body;
    if (!contentId || !userId || !deadline) { res.status(400).json({ error: 'Missing required fields: contentId, userId, deadline' }); return; }
    const task = assignTask(contentId, userId, deadline);
    res.status(201).json(task);
}));

router.get('/tasks/:userId', asyncHandler(async (req: Request, res: Response) => {
    res.json(getAssignments(req.params.userId));
}));

// POST /api/admin/wipe — destructive: clears all content (blocked in production)
router.post('/admin/wipe', asyncHandler(async (_req: Request, res: Response) => {
    guardDestructive('wipe content library');
    // In non-production: perform wipe logic here
    res.json({ status: 'wiped', message: 'Content library cleared (non-production only).' });
}));

export default router;
