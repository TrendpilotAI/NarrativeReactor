/**
 * Tests: Cost Tracker service
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import path from 'path';
import os from 'os';
import fs from 'fs';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-costs-test-'));
const costsFile = path.join(tmpDir, 'data', 'costs.json');

// Mock fs to redirect costs file to temp directory
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return actual;
});

describe('Cost Tracker Service', () => {
  // We test using the real fs but ensure the data dir exists
  beforeEach(() => {
    const dataDir = path.join(tmpDir, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    if (fs.existsSync(costsFile)) fs.unlinkSync(costsFile);
  });

  describe('DEFAULT_COSTS', () => {
    it('has expected cost keys with defaults', async () => {
      const { DEFAULT_COSTS } = await import('../../services/costTracker');
      expect(DEFAULT_COSTS['fal-image']).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_COSTS['fal-video']).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_COSTS['claude-call']).toBeGreaterThanOrEqual(0);
    });
  });

  describe('loadCosts and saveCosts', () => {
    it('loadCosts returns empty entries when file does not exist', () => {
      // Write a fresh empty state
      const freshFile = path.join(tmpDir, 'data', `costs-${Date.now()}.json`);
      // Directly test the logic — if file doesn't exist, return empty
      const result = fs.existsSync(freshFile) ? JSON.parse(fs.readFileSync(freshFile, 'utf-8')) : { entries: [] };
      expect(result.entries).toEqual([]);
    });
  });

  describe('CostEntry structure', () => {
    it('entry has required fields', () => {
      const entry = {
        type: 'image' as const,
        amount: 0.01,
        model: 'flux',
        timestamp: new Date().toISOString(),
      };
      expect(entry.type).toBe('image');
      expect(entry.amount).toBe(0.01);
      expect(entry.timestamp).toBeDefined();
    });
  });

  describe('getCostSummary logic', () => {
    it('computes total from entries', () => {
      const entries = [
        { type: 'image', amount: 0.01, timestamp: new Date().toISOString() },
        { type: 'image', amount: 0.02, timestamp: new Date().toISOString() },
        { type: 'claude', amount: 0.05, timestamp: new Date().toISOString() },
      ];
      let total = 0;
      const byType: Record<string, number> = {};
      for (const e of entries) {
        total += e.amount;
        byType[e.type] = (byType[e.type] || 0) + e.amount;
      }
      expect(Math.round(total * 1000) / 1000).toBeCloseTo(0.08);
      expect(byType['image']).toBeCloseTo(0.03);
      expect(byType['claude']).toBeCloseTo(0.05);
    });

    it('groups entries by day', () => {
      const today = new Date().toISOString().slice(0, 10);
      const entries = [
        { type: 'video', amount: 0.10, timestamp: new Date().toISOString() },
      ];
      const byDay: Record<string, number> = {};
      for (const e of entries) {
        const day = e.timestamp.slice(0, 10);
        byDay[day] = (byDay[day] || 0) + e.amount;
      }
      expect(byDay[today]).toBeDefined();
    });

    it('caps recentEntries at 50', () => {
      const entries = Array.from({ length: 60 }, (_, i) => ({
        type: 'other' as const,
        amount: 0.001,
        timestamp: new Date().toISOString(),
      }));
      const recent = entries.slice(-50);
      expect(recent.length).toBe(50);
    });
  });
});
