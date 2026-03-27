/**
 * Tests: PerformanceTracker service — uses chdir for temp isolation
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-perf-test-'));
const dataDir = path.join(tmpDir, 'data');
const perfFile = path.join(dataDir, 'performance.json');
const originalCwd = process.cwd();

describe('PerformanceTracker Service', () => {
  beforeEach(() => {
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(perfFile)) fs.unlinkSync(perfFile);
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('trackPost creates a performance entry', async () => {
    const { trackPost } = await import('../../services/performanceTracker');
    const entry = trackPost('post-123', 'twitter', { likes: 50, shares: 10, comments: 3 });
    expect(entry.postId).toBe('post-123');
    expect(entry.platform).toBe('twitter');
    expect(entry.metrics.likes).toBe(50);
    expect(entry.timestamp).toBeDefined();
  });

  it('getPostPerformance returns entries for a post', async () => {
    const { trackPost, getPostPerformance } = await import('../../services/performanceTracker');
    trackPost('post-abc', 'twitter', { likes: 100 });
    trackPost('post-abc', 'twitter', { likes: 150 });
    trackPost('post-xyz', 'linkedin', { likes: 30 });
    const results = getPostPerformance('post-abc');
    expect(results.length).toBe(2);
    expect(results.every(e => e.postId === 'post-abc')).toBe(true);
  });

  it('getPostPerformance returns empty for unknown post', async () => {
    const { getPostPerformance } = await import('../../services/performanceTracker');
    const results = getPostPerformance('unknown-post');
    expect(results).toEqual([]);
  });

  it('getBestPerformingContent returns top posts by engagement', async () => {
    const { trackPost, getBestPerformingContent } = await import('../../services/performanceTracker');
    trackPost('post-high', 'twitter', { likes: 1000, shares: 200, comments: 50, clicks: 300 });
    trackPost('post-low', 'twitter', { likes: 10, shares: 2, comments: 1 });
    const best = getBestPerformingContent(30);
    expect(best.length).toBeGreaterThan(0);
    expect(best[0].postId).toBe('post-high');
  });

  it('getBestPerformingContent returns empty when no posts', async () => {
    const { getBestPerformingContent } = await import('../../services/performanceTracker');
    const result = getBestPerformingContent(30);
    expect(result).toEqual([]);
  });

  it('getBestPerformingContent deduplicates by postId (keeps latest)', async () => {
    const { trackPost, getBestPerformingContent } = await import('../../services/performanceTracker');
    trackPost('post-dup', 'twitter', { likes: 50 });
    // Add slight delay to ensure different timestamp
    await new Promise(r => setTimeout(r, 10));
    trackPost('post-dup', 'twitter', { likes: 500 });
    const best = getBestPerformingContent(30);
    const dupEntries = best.filter(e => e.postId === 'post-dup');
    expect(dupEntries.length).toBe(1);
    expect(dupEntries[0].metrics.likes).toBe(500);
  });

  it('getOptimalPostingTimes returns times for platform', async () => {
    const { trackPost, getOptimalPostingTimes } = await import('../../services/performanceTracker');
    trackPost('p1', 'twitter', { likes: 100, shares: 20, comments: 5 });
    trackPost('p2', 'twitter', { likes: 50, shares: 5, comments: 1 });
    const times = getOptimalPostingTimes('twitter');
    expect(Array.isArray(times)).toBe(true);
    times.forEach(t => {
      expect(t.hour).toBeGreaterThanOrEqual(0);
      expect(t.hour).toBeLessThan(24);
      expect(t.avgEngagement).toBeGreaterThanOrEqual(0);
    });
  });

  it('getOptimalPostingTimes returns empty for platform with no posts', async () => {
    const { getOptimalPostingTimes } = await import('../../services/performanceTracker');
    const times = getOptimalPostingTimes('tiktok');
    expect(times).toEqual([]);
  });

  it('engagement score uses weighted formula: shares x2, comments x3', async () => {
    const { trackPost, getBestPerformingContent } = await import('../../services/performanceTracker');
    // post-a: score = 100
    trackPost('post-a', 'twitter', { likes: 100, shares: 0, comments: 0 });
    // post-b: score = 10 + 50*2 + 10*3 = 10 + 100 + 30 = 140
    trackPost('post-b', 'twitter', { likes: 10, shares: 50, comments: 10 });
    const best = getBestPerformingContent(30);
    expect(best[0].postId).toBe('post-b');
  });
});
