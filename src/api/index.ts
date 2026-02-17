/**
 * Campaign Intelligence API Routes
 * Express routes for competitor tracking, hashtag discovery, posting scheduler,
 * persona builder, and weekly strategy reports.
 */

import { Router, Request, Response } from 'express';
import { addCompetitor, getCompetitors, recordCompetitorPost, getCompetitorActivity, analyzeCompetitorStrategy } from '../services/competitorTracker';
import { discoverHashtags, getRecommendedHashtags, getHashtagPerformance } from '../services/hashtagDiscovery';
import { getAudienceAwareSchedule, buildWeeklyPlan, analyzeEngagementPatterns, getOptimalTimes, suggestNextPostTime } from '../services/postingScheduler';
import { buildEnrichedPersona, matchPersona, mergeSnapshots, getDefaultPersonas } from '../services/personaBuilder';
import { generateWeeklyReport, formatReportAsText } from '../services/strategyReport';
import { createVideoProject, getVideoProject, generateStitchingScript, getProjectTimeline } from '../services/videoStitcher';
import { generateCaptions, translateCaptions, getSupportedLanguages } from '../services/captionGenerator';
import { getTemplate, listTemplates, customizeTemplate } from '../services/videoTemplates';
import { generateThumbnail } from '../services/thumbnailGenerator';
import { predictPerformance } from '../services/videoPredictor';
import { createBrand, getBrand, listBrands, updateBrand, deleteBrand } from '../services/brandManager';
import { createVoiceProfile, addSamples, getVoiceProfile, getProfilesByBrand, generateContentGuidance, analyzeContent, deleteVoiceProfile } from '../services/voiceCloner';
import { submitForReview, approveContent, rejectContent, getReviewQueue, getReviewByContentId } from '../services/approvalWorkflow';
import { scoreContent, batchScore } from '../services/brandScorer';
import { assignTask, addComment, getComments, getAssignments, getNotifications } from '../services/teamCollab';

const router = Router();

// ── Competitor Tracker ──

router.get('/intelligence/competitors', (_req: Request, res: Response) => {
  try { res.json(getCompetitors()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/competitors', (req: Request, res: Response) => {
  try {
    const { name, platforms } = req.body;
    if (!name || !platforms) { res.status(400).json({ error: 'name and platforms required' }); return; }
    res.status(201).json(addCompetitor(name, platforms));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/competitors/:id/posts', (req: Request, res: Response) => {
  try {
    const post = recordCompetitorPost(req.params.id, req.body);
    res.status(201).json(post);
  } catch (err: any) { res.status(404).json({ error: err.message }); }
});

router.get('/intelligence/competitors/:id/activity', (req: Request, res: Response) => {
  try {
    const days = Number(req.query.days) || 30;
    res.json(getCompetitorActivity(req.params.id, days));
  } catch (err: any) { res.status(404).json({ error: err.message }); }
});

router.get('/intelligence/competitors/:id/strategy', (req: Request, res: Response) => {
  try { res.json(analyzeCompetitorStrategy(req.params.id)); }
  catch (err: any) { res.status(404).json({ error: err.message }); }
});

// ── Hashtag Discovery ──

router.get('/intelligence/hashtags', (req: Request, res: Response) => {
  try {
    const topic = (req.query.topic as string) || '';
    if (!topic) { res.status(400).json({ error: 'topic query param required' }); return; }
    res.json(discoverHashtags(topic));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/hashtags/recommend', (req: Request, res: Response) => {
  try {
    const { content, platform, count } = req.body;
    if (!content || !platform) { res.status(400).json({ error: 'content and platform required' }); return; }
    res.json(getRecommendedHashtags(content, platform, count));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/intelligence/hashtags/:tag/performance', (req: Request, res: Response) => {
  try { res.json(getHashtagPerformance(req.params.tag)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Posting Scheduler ──

router.get('/intelligence/schedule/optimal', (req: Request, res: Response) => {
  try {
    const platform = (req.query.platform as string) || 'twitter';
    const timezone = (req.query.timezone as string) || 'UTC';
    res.json(getOptimalTimes(platform, timezone));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/intelligence/schedule/next', (req: Request, res: Response) => {
  try {
    const platform = (req.query.platform as string) || 'twitter';
    res.json(suggestNextPostTime(platform));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/schedule/weekly-plan', (req: Request, res: Response) => {
  try {
    const { platform, postsPerWeek, timezone } = req.body;
    if (!platform || !postsPerWeek) { res.status(400).json({ error: 'platform and postsPerWeek required' }); return; }
    res.json(buildWeeklyPlan(platform, postsPerWeek, timezone));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/schedule/audience-aware', (req: Request, res: Response) => {
  try {
    const { platform, persona } = req.body;
    if (!platform || !persona) { res.status(400).json({ error: 'platform and persona required' }); return; }
    res.json(getAudienceAwareSchedule(platform, persona));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/schedule/analyze', (req: Request, res: Response) => {
  try {
    const { data } = req.body;
    if (!data || !Array.isArray(data)) { res.status(400).json({ error: 'data array required' }); return; }
    res.json(analyzeEngagementPatterns(data));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Persona Builder ──

router.get('/intelligence/personas', (_req: Request, res: Response) => {
  try { res.json(getDefaultPersonas()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/personas/build', (req: Request, res: Response) => {
  try {
    res.json(buildEnrichedPersona(req.body));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/personas/match', (req: Request, res: Response) => {
  try {
    const { topics } = req.body;
    if (!topics || !Array.isArray(topics)) { res.status(400).json({ error: 'topics array required' }); return; }
    res.json(matchPersona(topics));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/personas/merge', (req: Request, res: Response) => {
  try {
    const { snapshots } = req.body;
    if (!snapshots || !Array.isArray(snapshots)) { res.status(400).json({ error: 'snapshots array required' }); return; }
    res.json(mergeSnapshots(snapshots));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Strategy Report ──

router.post('/intelligence/report/weekly', (req: Request, res: Response) => {
  try {
    const { posts, previousWeekEngagement } = req.body;
    if (!posts || !Array.isArray(posts)) { res.status(400).json({ error: 'posts array required' }); return; }
    const report = generateWeeklyReport(posts, previousWeekEngagement);
    res.json(report);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/intelligence/report/weekly/text', (req: Request, res: Response) => {
  try {
    const { posts, previousWeekEngagement } = req.body;
    if (!posts || !Array.isArray(posts)) { res.status(400).json({ error: 'posts array required' }); return; }
    const report = generateWeeklyReport(posts, previousWeekEngagement);
    res.type('text/plain').send(formatReportAsText(report));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Video Stitcher ──

router.post('/video/projects', (req: Request, res: Response) => {
  try {
    const { scenes } = req.body;
    if (!scenes || !Array.isArray(scenes)) { res.status(400).json({ error: 'scenes array required' }); return; }
    const project = createVideoProject(scenes);
    res.status(201).json(project);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/video/projects/:id', (req: Request, res: Response) => {
  try {
    const project = getVideoProject(req.params.id);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(project);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/video/projects/:id/timeline', (req: Request, res: Response) => {
  try {
    const project = getVideoProject(req.params.id);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json(getProjectTimeline(project));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/video/projects/:id/script', (req: Request, res: Response) => {
  try {
    const project = getVideoProject(req.params.id);
    if (!project) { res.status(404).json({ error: 'Project not found' }); return; }
    res.json({ script: generateStitchingScript(project) });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Captions ──

router.post('/video/captions', (req: Request, res: Response) => {
  try {
    const { text, format, language, startOffset, wordsPerMinute } = req.body;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }
    res.json(generateCaptions(text, { format, language, startOffset, wordsPerMinute }));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/video/captions/translate', (req: Request, res: Response) => {
  try {
    const { captions, targetLanguage } = req.body;
    if (!captions || !targetLanguage) { res.status(400).json({ error: 'captions and targetLanguage required' }); return; }
    res.json(translateCaptions(captions, targetLanguage));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/video/captions/languages', (_req: Request, res: Response) => {
  res.json(getSupportedLanguages());
});

// ── Video Templates ──

router.get('/video/templates', (_req: Request, res: Response) => {
  try { res.json(listTemplates()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/video/templates/:type', (req: Request, res: Response) => {
  try { res.json(getTemplate(req.params.type as any)); }
  catch (err: any) { res.status(404).json({ error: err.message }); }
});

router.post('/video/templates/:type/customize', (req: Request, res: Response) => {
  try {
    const template = getTemplate(req.params.type as any);
    res.json(customizeTemplate(template, req.body));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ── Thumbnails ──

router.post('/video/thumbnails', (req: Request, res: Response) => {
  try {
    const { imageUrl, title, subtitle, style } = req.body;
    if (!imageUrl || !title) { res.status(400).json({ error: 'imageUrl and title required' }); return; }
    res.json(generateThumbnail(imageUrl, title, subtitle, style));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Video Predictor ──

router.post('/video/predict', (req: Request, res: Response) => {
  try {
    const { attributes, historicalData } = req.body;
    if (!attributes) { res.status(400).json({ error: 'attributes required' }); return; }
    res.json(predictPerformance(attributes, historicalData));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Brand Management ──

router.get('/brands', (_req: Request, res: Response) => {
  try { res.json(listBrands()); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/brands/:id', (req: Request, res: Response) => {
  try {
    const brand = getBrand(req.params.id);
    if (!brand) { res.status(404).json({ error: 'Brand not found' }); return; }
    res.json(brand);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/brands', (req: Request, res: Response) => {
  try {
    const { name, guidelines, voiceTone, colors, logos, targetAudience, prohibitedWords } = req.body;
    if (!name) { res.status(400).json({ error: 'name required' }); return; }
    res.status(201).json(createBrand({ name, guidelines: guidelines || '', voiceTone: voiceTone || '', colors: colors || [], logos: logos || [], targetAudience: targetAudience || '', prohibitedWords: prohibitedWords || [] }));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.put('/brands/:id', (req: Request, res: Response) => {
  try {
    const updated = updateBrand(req.params.id, req.body);
    if (!updated) { res.status(404).json({ error: 'Brand not found' }); return; }
    res.json(updated);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.delete('/brands/:id', (req: Request, res: Response) => {
  try {
    const ok = deleteBrand(req.params.id);
    if (!ok) { res.status(404).json({ error: 'Brand not found' }); return; }
    res.json({ success: true });
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Voice Cloner ──

router.post('/voice/profiles', (req: Request, res: Response) => {
  try {
    const { brandId, name, samples } = req.body;
    if (!brandId || !name || !samples?.length) { res.status(400).json({ error: 'brandId, name, and samples required' }); return; }
    res.status(201).json(createVoiceProfile(brandId, name, samples));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/voice/profiles/:id/samples', (req: Request, res: Response) => {
  try {
    const { samples } = req.body;
    if (!samples?.length) { res.status(400).json({ error: 'samples required' }); return; }
    res.json(addSamples(req.params.id, samples));
  } catch (err: any) { res.status(404).json({ error: err.message }); }
});

router.get('/voice/profiles/:id', (req: Request, res: Response) => {
  try {
    const profile = getVoiceProfile(req.params.id);
    if (!profile) { res.status(404).json({ error: 'Profile not found' }); return; }
    res.json(profile);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/voice/profiles/:id/guidance', (req: Request, res: Response) => {
  try { res.json(generateContentGuidance(req.params.id)); }
  catch (err: any) { res.status(404).json({ error: err.message }); }
});

router.post('/voice/analyze', (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }
    res.json(analyzeContent(text));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Approval Workflow ──

router.post('/workflow/submit', (req: Request, res: Response) => {
  try {
    const { contentId, brandId } = req.body;
    if (!contentId || !brandId) { res.status(400).json({ error: 'contentId and brandId required' }); return; }
    res.status(201).json(submitForReview(contentId, brandId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/workflow/approve', (req: Request, res: Response) => {
  try {
    const { contentId, reviewerId } = req.body;
    if (!contentId || !reviewerId) { res.status(400).json({ error: 'contentId and reviewerId required' }); return; }
    res.json(approveContent(contentId, reviewerId));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.post('/workflow/reject', (req: Request, res: Response) => {
  try {
    const { contentId, reviewerId, reason } = req.body;
    if (!contentId || !reviewerId || !reason) { res.status(400).json({ error: 'contentId, reviewerId, and reason required' }); return; }
    res.json(rejectContent(contentId, reviewerId, reason));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.get('/workflow/queue', (req: Request, res: Response) => {
  try {
    const brandId = req.query.brandId as string | undefined;
    res.json(getReviewQueue(brandId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/workflow/:contentId', (req: Request, res: Response) => {
  try {
    const review = getReviewByContentId(req.params.contentId);
    if (!review) { res.status(404).json({ error: 'Review not found' }); return; }
    res.json(review);
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

// ── Brand Scorer ──

router.post('/brands/score', (req: Request, res: Response) => {
  try {
    const { brandId, content } = req.body;
    if (!brandId || !content) { res.status(400).json({ error: 'brandId and content required' }); return; }
    res.json(scoreContent(brandId, content));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.post('/brands/score/batch', (req: Request, res: Response) => {
  try {
    const { brandId, contents } = req.body;
    if (!brandId || !contents?.length) { res.status(400).json({ error: 'brandId and contents required' }); return; }
    res.json(batchScore(brandId, contents));
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

// ── Team Collaboration ──

router.post('/collab/assign', (req: Request, res: Response) => {
  try {
    const { contentId, userId, deadline } = req.body;
    if (!contentId || !userId || !deadline) { res.status(400).json({ error: 'contentId, userId, and deadline required' }); return; }
    res.status(201).json(assignTask(contentId, userId, deadline));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.post('/collab/comments', (req: Request, res: Response) => {
  try {
    const { contentId, userId, comment, parentId } = req.body;
    if (!contentId || !userId || !comment) { res.status(400).json({ error: 'contentId, userId, and comment required' }); return; }
    res.status(201).json(addComment(contentId, userId, comment, parentId));
  } catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/collab/comments/:contentId', (req: Request, res: Response) => {
  try { res.json(getComments(req.params.contentId)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/collab/assignments/:userId', (req: Request, res: Response) => {
  try { res.json(getAssignments(req.params.userId)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

router.get('/collab/notifications/:userId', (req: Request, res: Response) => {
  try { res.json(getNotifications(req.params.userId)); }
  catch (err: any) { res.status(500).json({ error: err.message }); }
});

export default router;
