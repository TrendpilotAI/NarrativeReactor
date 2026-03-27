/**
 * Tests: Cost Tracker service — full coverage
 * Uses real filesystem in temp directory
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';
import fs from 'fs';

// Create a completely fresh temp dir per test suite run
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-costs-full-'));
const dataDir = path.join(tmpDir, 'data');
const costsFile = path.join(dataDir, 'costs.json');

// Override process.cwd() is tricky, instead we patch the module by using
// the fact that costTracker.ts uses path.resolve(process.cwd(), 'data')
// We'll use chdir only during test setup
const originalCwd = process.cwd();

describe('CostTracker Service — Full Coverage', () => {
  beforeEach(() => {
    // Ensure data dir exists in tmp
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    // Remove costs file before each test for clean state
    if (fs.existsSync(costsFile)) fs.unlinkSync(costsFile);
    // Change cwd to tmpDir so costTracker uses tmpDir/data/costs.json
    process.chdir(tmpDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
  });

  it('loadCosts returns empty when file does not exist', async () => {
    const { loadCosts } = await import('../../services/costTracker');
    const data = loadCosts();
    expect(Array.isArray(data.entries)).toBe(true);
    expect(data.entries.length).toBe(0);
  });

  it('loadCosts returns empty on parse error', async () => {
    fs.writeFileSync(costsFile, 'not-valid-json');
    const { loadCosts } = await import('../../services/costTracker');
    const data = loadCosts();
    expect(data.entries).toEqual([]);
  });

  it('saveCosts and loadCosts round-trip', async () => {
    const { saveCosts, loadCosts } = await import('../../services/costTracker');
    const testData = {
      entries: [
        { type: 'image' as const, amount: 0.01, timestamp: new Date().toISOString() },
        { type: 'video' as const, amount: 0.10, timestamp: new Date().toISOString() },
      ],
    };
    saveCosts(testData);
    const loaded = loadCosts();
    expect(loaded.entries.length).toBe(2);
    expect(loaded.entries[0].type).toBe('image');
    expect(loaded.entries[1].type).toBe('video');
  });

  it('trackCost adds entry with timestamp', async () => {
    const { trackCost, loadCosts } = await import('../../services/costTracker');
    const entry = trackCost({ type: 'claude', amount: 0.03, model: 'claude-3', description: 'API call' });
    expect(entry.type).toBe('claude');
    expect(entry.amount).toBe(0.03);
    expect(entry.model).toBe('claude-3');
    expect(entry.timestamp).toBeDefined();
    const data = loadCosts();
    expect(data.entries.length).toBeGreaterThanOrEqual(1);
    const found = data.entries.find(e => e.model === 'claude-3');
    expect(found).toBeDefined();
  });

  it('trackCost accumulates multiple entries', async () => {
    const { trackCost, loadCosts } = await import('../../services/costTracker');
    trackCost({ type: 'image', amount: 0.01 });
    trackCost({ type: 'video', amount: 0.10 });
    trackCost({ type: 'claude', amount: 0.03 });
    const data = loadCosts();
    expect(data.entries.length).toBeGreaterThanOrEqual(3);
  });

  it('getCostSummary sums totals correctly', async () => {
    const { trackCost, getCostSummary } = await import('../../services/costTracker');
    trackCost({ type: 'image', amount: 0.01 });
    trackCost({ type: 'image', amount: 0.02 });
    trackCost({ type: 'claude', amount: 0.05 });
    const summary = getCostSummary();
    expect(summary.total).toBeCloseTo(0.08, 2);
    expect(summary.byType['image']).toBeCloseTo(0.03, 2);
    expect(summary.byType['claude']).toBeCloseTo(0.05, 2);
  });

  it('getCostSummary groups by day', async () => {
    const { trackCost, getCostSummary } = await import('../../services/costTracker');
    trackCost({ type: 'other', amount: 0.005 });
    const summary = getCostSummary();
    const today = new Date().toISOString().slice(0, 10);
    expect(summary.byDay[today]).toBeGreaterThan(0);
  });

  it('getCostSummary returns last 50 entries', async () => {
    const { trackCost, getCostSummary } = await import('../../services/costTracker');
    for (let i = 0; i < 60; i++) {
      trackCost({ type: 'other', amount: 0.001 });
    }
    const summary = getCostSummary();
    expect(summary.recentEntries.length).toBe(50);
  });

  it('getCostSummary handles empty file gracefully', async () => {
    const { getCostSummary } = await import('../../services/costTracker');
    const summary = getCostSummary();
    expect(summary.total).toBe(0);
    expect(summary.byType).toEqual({});
    expect(summary.recentEntries).toEqual([]);
  });

  it('DEFAULT_COSTS has expected keys', async () => {
    const { DEFAULT_COSTS } = await import('../../services/costTracker');
    expect(DEFAULT_COSTS).toHaveProperty('fal-image');
    expect(DEFAULT_COSTS).toHaveProperty('fal-video');
    expect(DEFAULT_COSTS).toHaveProperty('claude-call');
    expect(DEFAULT_COSTS['fal-image']).toBeGreaterThanOrEqual(0);
  });
});
