/**
 * Tests: CompetitorTracker service — uses chdir for temp isolation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-competitor-test-'));
const dataDir = path.join(tmpDir, 'data');
const dataFile = path.join(dataDir, 'competitors.json');
const originalCwd = process.cwd();

describe('CompetitorTracker Service', () => {
  beforeEach(() => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('addCompetitor creates a new competitor', async () => {
    const { addCompetitor } = await import('../../services/competitorTracker');
    const comp = addCompetitor('Acme Corp', ['twitter', 'linkedin']);
    expect(comp.name).toBe('Acme Corp');
    expect(comp.platforms).toEqual(['twitter', 'linkedin']);
    expect(comp.id).toMatch(/^comp_/);
    expect(comp.posts).toEqual([]);
  });

  it('getCompetitors returns all competitors', async () => {
    const { addCompetitor, getCompetitors } = await import('../../services/competitorTracker');
    addCompetitor('Company A', ['twitter']);
    addCompetitor('Company B', ['linkedin']);
    const list = getCompetitors();
    expect(list.length).toBe(2);
    expect(list.map(c => c.name)).toContain('Company A');
    expect(list.map(c => c.name)).toContain('Company B');
  });

  it('getCompetitors returns empty array when no data', async () => {
    const { getCompetitors } = await import('../../services/competitorTracker');
    const list = getCompetitors();
    expect(list).toEqual([]);
  });

  it('recordCompetitorPost adds post to competitor', async () => {
    const { addCompetitor, recordCompetitorPost } = await import('../../services/competitorTracker');
    const comp = addCompetitor('Test Corp', ['twitter']);
    const post = recordCompetitorPost(comp.id, {
      platform: 'twitter',
      content: 'Hello world',
      timestamp: new Date().toISOString(),
      topics: ['AI', 'tech'],
      engagement: { likes: 100, shares: 20, comments: 5 },
    });
    expect(post.id).toMatch(/^post_/);
    expect(post.content).toBe('Hello world');
    expect(post.platform).toBe('twitter');
  });

  it('recordCompetitorPost throws for unknown competitor', async () => {
    const { recordCompetitorPost } = await import('../../services/competitorTracker');
    expect(() => recordCompetitorPost('nonexistent', {
      platform: 'twitter',
      content: 'test',
      timestamp: new Date().toISOString(),
    })).toThrow('Competitor nonexistent not found');
  });

  it('getCompetitorActivity filters by days', async () => {
    const { addCompetitor, recordCompetitorPost, getCompetitorActivity } = await import('../../services/competitorTracker');
    const comp = addCompetitor('Active Corp', ['twitter']);
    const recentTime = new Date().toISOString();
    const oldTime = new Date(Date.now() - 40 * 86400000).toISOString();
    recordCompetitorPost(comp.id, { platform: 'twitter', content: 'Recent', timestamp: recentTime });
    recordCompetitorPost(comp.id, { platform: 'twitter', content: 'Old', timestamp: oldTime });
    const activity = getCompetitorActivity(comp.id, 30);
    expect(activity.length).toBe(1);
    expect(activity[0].content).toBe('Recent');
  });

  it('getCompetitorActivity throws for unknown competitor', async () => {
    const { getCompetitorActivity } = await import('../../services/competitorTracker');
    expect(() => getCompetitorActivity('invalid-id')).toThrow('Competitor invalid-id not found');
  });

  it('analyzeCompetitorStrategy returns zeros for empty posts', async () => {
    const { addCompetitor, analyzeCompetitorStrategy } = await import('../../services/competitorTracker');
    const comp = addCompetitor('Empty Corp', ['twitter']);
    const analysis = analyzeCompetitorStrategy(comp.id);
    expect(analysis.postingFrequency.postsPerWeek).toBe(0);
    expect(analysis.topTopics).toEqual([]);
    expect(analysis.engagementPatterns.avgLikes).toBe(0);
  });

  it('analyzeCompetitorStrategy throws for unknown competitor', async () => {
    const { analyzeCompetitorStrategy } = await import('../../services/competitorTracker');
    expect(() => analyzeCompetitorStrategy('bad-id')).toThrow('Competitor bad-id not found');
  });

  it('analyzeCompetitorStrategy calculates stats from posts', async () => {
    const { addCompetitor, recordCompetitorPost, analyzeCompetitorStrategy } = await import('../../services/competitorTracker');
    const comp = addCompetitor('Stats Corp', ['twitter']);
    const posts = [
      { platform: 'twitter', content: 'Post 1', timestamp: new Date().toISOString(), topics: ['AI'], engagement: { likes: 100, shares: 10, comments: 5 } },
      { platform: 'twitter', content: 'Post 2', timestamp: new Date().toISOString(), topics: ['AI', 'tech'], engagement: { likes: 200, shares: 20, comments: 10 } },
      { platform: 'linkedin', content: 'Post 3', timestamp: new Date().toISOString(), topics: ['tech'], engagement: { likes: 50 } },
    ];
    for (const post of posts) recordCompetitorPost(comp.id, post);

    const analysis = analyzeCompetitorStrategy(comp.id);
    expect(analysis.postingFrequency.postsPerWeek).toBeGreaterThan(0);
    expect(analysis.topTopics.length).toBeGreaterThan(0);
    const aiTopic = analysis.topTopics.find(t => t.topic === 'AI');
    expect(aiTopic?.count).toBe(2);
    expect(analysis.engagementPatterns.avgLikes).toBeGreaterThan(0);
    expect(analysis.engagementPatterns.bestPerformingTopic).toBeDefined();
  });

  it('analyzeCompetitorStrategy identifies most active platform', async () => {
    const { addCompetitor, recordCompetitorPost, analyzeCompetitorStrategy } = await import('../../services/competitorTracker');
    const comp = addCompetitor('Platform Corp', ['twitter', 'linkedin']);
    const ts = new Date().toISOString();
    recordCompetitorPost(comp.id, { platform: 'twitter', content: 'T1', timestamp: ts });
    recordCompetitorPost(comp.id, { platform: 'twitter', content: 'T2', timestamp: ts });
    recordCompetitorPost(comp.id, { platform: 'linkedin', content: 'L1', timestamp: ts });
    const analysis = analyzeCompetitorStrategy(comp.id);
    expect(analysis.postingFrequency.mostActivePlatform).toBe('twitter');
  });
});
