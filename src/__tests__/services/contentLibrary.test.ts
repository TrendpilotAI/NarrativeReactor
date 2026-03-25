/**
 * Tests: Content Library service
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Use real data dir but clean specific entries between tests via unique IDs
const LIB_FILE = path.join(process.cwd(), 'data', 'content-library.json');

// Tag prefix for test entries — easy to clean up
const TEST_TAG = `test-run-${Date.now()}`;

function cleanupTestEntries() {
  if (!fs.existsSync(LIB_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(LIB_FILE, 'utf-8'));
    data.entries = data.entries.filter((e: any) =>
      !(e.metadata?.tags || []).includes(TEST_TAG)
    );
    fs.writeFileSync(LIB_FILE, JSON.stringify(data, null, 2));
  } catch { /* ignore */ }
}

// Make sure data dir exists
beforeEach(() => {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
});

import {
  saveContent,
  searchContent,
  getContentByTag,
  getContentStats,
  getContentById,
} from '../../services/contentLibrary';

describe('Content Library Service', () => {
  afterEach(() => {
    cleanupTestEntries();
  });

  const withTag = (extra: any = {}) => ({
    tags: [TEST_TAG],
    ...extra,
  });

  describe('saveContent', () => {
    it('saves a content entry with ID and timestamp', () => {
      const entry = saveContent('Hello world', withTag({ type: 'tweet' }));
      expect(entry.id).toBeDefined();
      expect(entry.content).toBe('Hello world');
      expect(entry.metadata.type).toBe('tweet');
      expect(entry.createdAt).toBeDefined();
    });

    it('saves with empty metadata', () => {
      const entry = saveContent('Simple post', { tags: [TEST_TAG] });
      expect(entry.metadata).toBeDefined();
    });
  });

  describe('searchContent', () => {
    it('finds content by keyword', () => {
      const uniqueWord = `xqztransformingxqz${Date.now()}`;
      saveContent(`AI is ${uniqueWord} the world`, withTag({ type: 'blog' }));
      const results = searchContent(uniqueWord);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain(uniqueWord);
    });

    it('searches by metadata title', () => {
      const uniqueTitle = `MySpecialArticle${Date.now()}`;
      saveContent('Some content', withTag({ title: uniqueTitle }));
      const results = searchContent(uniqueTitle.toLowerCase());
      expect(results.length).toBeGreaterThan(0);
    });

    it('returns empty array when no match', () => {
      const results = searchContent(`zzz-no-match-xyz-${Date.now()}`);
      expect(results).toEqual([]);
    });
  });

  describe('getContentByTag', () => {
    it('returns content matching the test tag', () => {
      saveContent('Tagged content', { tags: [TEST_TAG] });
      const results = getContentByTag(TEST_TAG);
      expect(results.length).toBeGreaterThan(0);
    });

    it('is case-insensitive', () => {
      const uniqueTag = `uppercasetag${Date.now()}`;
      saveContent('Upper case tag', { tags: [uniqueTag.toUpperCase()] });
      const results = getContentByTag(uniqueTag.toLowerCase());
      expect(results.length).toBeGreaterThan(0);
      cleanupTestEntries();
    });

    it('returns empty array when tag not found', () => {
      const results = getContentByTag(`absolutely-not-a-tag-${Date.now()}`);
      expect(results).toEqual([]);
    });
  });

  describe('getContentById', () => {
    it('returns a content entry by ID', () => {
      const entry = saveContent('Find me', withTag({ type: 'thread' }));
      const found = getContentById(entry.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(entry.id);
    });

    it('returns undefined for unknown ID', () => {
      expect(getContentById('nonexistent-id-xyz-123')).toBeUndefined();
    });
  });

  describe('getContentStats', () => {
    it('returns stats with correct structure', () => {
      saveContent('Tweet 1', withTag({ type: 'tweet', platform: 'twitter' }));
      saveContent('Tweet 2', withTag({ type: 'tweet', platform: 'twitter' }));

      const stats = getContentStats();
      expect(stats).toHaveProperty('total');
      expect(stats).toHaveProperty('byType');
      expect(stats).toHaveProperty('byPlatform');
      expect(stats.total).toBeGreaterThanOrEqual(2);
    });

    it('groups correctly by type', () => {
      saveContent('Article 1', withTag({ type: 'article', platform: 'web' }));
      const stats = getContentStats();
      expect(stats.byType['article']).toBeGreaterThanOrEqual(1);
    });
  });
});


