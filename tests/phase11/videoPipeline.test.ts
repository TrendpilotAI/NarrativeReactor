import { describe, it, expect } from 'vitest';

import { createVideoProject, generateStitchingScript, getProjectTimeline, getVideoProject, Scene } from '../../src/services/videoStitcher';
import { generateCaptions, translateCaptions, getSupportedLanguages } from '../../src/services/captionGenerator';
import { getTemplate, listTemplates, customizeTemplate } from '../../src/services/videoTemplates';
import { generateThumbnail, getThumbnailFromScene } from '../../src/services/thumbnailGenerator';
import { predictPerformance, VideoAttributes } from '../../src/services/videoPredictor';

// ── Video Stitcher ──

describe('VideoStitcher', () => {
  const scenes: Scene[] = [
    { id: 's1', description: 'Intro', imageUrl: 'img1.jpg', duration: 5, transition: 'fade' },
    { id: 's2', description: 'Main', imageUrl: 'img2.jpg', audioUrl: 'audio.mp3', duration: 10, transition: 'cut' },
    { id: 's3', description: 'Outro', imageUrl: 'img3.jpg', duration: 3, transition: 'dissolve' },
  ];

  it('creates a project and retrieves it', () => {
    const project = createVideoProject(scenes);
    expect(project.id).toBeTruthy();
    expect(project.scenes).toHaveLength(3);
    const retrieved = getVideoProject(project.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(project.id);
  });

  it('throws on empty scenes', () => {
    expect(() => createVideoProject([])).toThrow();
  });

  it('generates timeline with correct total duration', () => {
    const project = createVideoProject(scenes);
    const timeline = getProjectTimeline(project);
    expect(timeline.totalDuration).toBe(18);
    expect(timeline.sceneCount).toBe(3);
    expect(timeline.breakdown[1].startTime).toBe(5);
  });

  it('generates stitching script for single scene', () => {
    const project = createVideoProject([scenes[0]]);
    const script = generateStitchingScript(project);
    expect(script).toContain('ffmpeg');
    expect(script).toContain('img1.jpg');
  });

  it('generates stitching script with transitions for multi-scene', () => {
    const project = createVideoProject(scenes);
    const script = generateStitchingScript(project);
    expect(script).toContain('concat');
    expect(script).toContain('filter_complex');
  });
});

// ── Caption Generator ──

describe('CaptionGenerator', () => {
  const sampleText = 'Hello world this is a test of the caption generator system';

  it('generates SRT captions with correct structure', () => {
    const result = generateCaptions(sampleText, { format: 'srt' });
    expect(result.format).toBe('srt');
    expect(result.language).toBe('en');
    expect(result.lines.length).toBeGreaterThan(0);
    expect(result.raw).toContain('-->');
    expect(result.totalDuration).toBeGreaterThan(0);
  });

  it('generates VTT captions with header', () => {
    const result = generateCaptions(sampleText, { format: 'vtt' });
    expect(result.raw).toMatch(/^WEBVTT/);
  });

  it('provides word-level timing', () => {
    const result = generateCaptions(sampleText);
    const firstLine = result.lines[0];
    expect(firstLine.words.length).toBeGreaterThan(0);
    expect(firstLine.words[0].startTime).toBe(firstLine.startTime);
  });

  it('throws on empty text', () => {
    expect(() => generateCaptions('')).toThrow();
  });

  it('translates captions to Spanish', () => {
    const captions = generateCaptions('hello world', { format: 'srt' });
    const translated = translateCaptions(captions, 'es');
    expect(translated.language).toBe('es');
    expect(translated.lines[0].text).toContain('hola');
  });

  it('lists supported languages', () => {
    const langs = getSupportedLanguages();
    expect(langs).toContain('en');
    expect(langs).toContain('es');
    expect(langs).toContain('fr');
  });
});

// ── Video Templates ──

describe('VideoTemplates', () => {
  it('lists all templates', () => {
    const all = listTemplates();
    expect(all.length).toBeGreaterThanOrEqual(4);
  });

  it('gets product_launch template', () => {
    const t = getTemplate('product_launch');
    expect(t.type).toBe('product_launch');
    expect(t.scenes.length).toBeGreaterThan(0);
  });

  it('throws on unknown template', () => {
    expect(() => getTemplate('nonexistent' as any)).toThrow();
  });

  it('customizes a template', () => {
    const t = getTemplate('social_clip');
    const custom = customizeTemplate(t, { pacing: 'slow' });
    expect(custom.pacing).toBe('slow');
    expect(custom.type).toBe('social_clip');
  });
});

// ── Thumbnail Generator ──

describe('ThumbnailGenerator', () => {
  it('generates a thumbnail config', () => {
    const thumb = generateThumbnail('img.jpg', 'My Title', 'Subtitle', 'bold');
    expect(thumb.width).toBe(1280);
    expect(thumb.height).toBe(720);
    expect(thumb.overlays).toHaveLength(2);
    expect(thumb.ffmpegCommand).toContain('ffmpeg');
  });

  it('throws on missing params', () => {
    expect(() => generateThumbnail('', 'title')).toThrow();
  });

  it('generates thumbnail from scene', () => {
    const scene: Scene = { id: 's1', description: 'Test scene', imageUrl: 'scene.jpg', duration: 5, transition: 'cut' };
    const thumb = getThumbnailFromScene(scene, 'minimal');
    expect(thumb.style).toBe('minimal');
    expect(thumb.imageUrl).toBe('scene.jpg');
  });
});

// ── Video Predictor ──

describe('VideoPredictor', () => {
  const baseAttrs: VideoAttributes = {
    title: 'How to Build Amazing Apps in 2024',
    duration: 480,
    topic: 'technology',
    thumbnailQuality: 85,
    hasSubtitles: true,
    platform: 'youtube',
  };

  it('returns prediction with all fields', () => {
    const pred = predictPerformance(baseAttrs);
    expect(pred.overallScore).toBeGreaterThan(0);
    expect(pred.estimatedViews.mid).toBeGreaterThan(0);
    expect(pred.factors.length).toBeGreaterThan(0);
    expect(pred.recommendations.length).toBeGreaterThan(0);
  });

  it('throws on invalid input', () => {
    expect(() => predictPerformance({ ...baseAttrs, title: '', duration: 0 })).toThrow();
  });

  it('scores higher with subtitles than without', () => {
    const withSubs = predictPerformance({ ...baseAttrs, hasSubtitles: true });
    const noSubs = predictPerformance({ ...baseAttrs, hasSubtitles: false });
    expect(withSubs.overallScore).toBeGreaterThanOrEqual(noSubs.overallScore);
  });

  it('uses historical data to adjust predictions', () => {
    const history = [
      { views: 50000, likes: 2000, shares: 200, comments: 100, duration: 300, topic: 'technology' },
    ];
    const pred = predictPerformance(baseAttrs, history);
    expect(pred.estimatedViews.mid).toBeGreaterThan(0);
  });

  it('provides platform-specific duration scoring', () => {
    const ytPred = predictPerformance({ ...baseAttrs, platform: 'youtube', duration: 480 });
    const ttPred = predictPerformance({ ...baseAttrs, platform: 'tiktok', duration: 480 });
    // 480s is ideal for YT but way too long for TikTok
    const ytDur = ytPred.factors.find(f => f.name === 'duration_fitness')!.score;
    const ttDur = ttPred.factors.find(f => f.name === 'duration_fitness')!.score;
    expect(ytDur).toBeGreaterThan(ttDur);
  });
});
