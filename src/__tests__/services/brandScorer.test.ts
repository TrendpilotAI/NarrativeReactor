/**
 * Tests: Brand Scorer service
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const BRANDS_FILE = path.join(process.cwd(), 'data', 'brands.json');

function cleanupBrand(id: string) {
  if (!fs.existsSync(BRANDS_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf-8'));
    data.brands = data.brands.filter((b: any) => b.id !== id);
    fs.writeFileSync(BRANDS_FILE, JSON.stringify(data, null, 2));
  } catch { /* ignore */ }
}

import { scoreContent, batchScore } from '../../services/brandScorer';
import { createBrand } from '../../services/brandManager';

describe('Brand Scorer Service', () => {
  let brandId: string;

  beforeAll(() => {
    const brand = createBrand({
      name: `Score Test Brand ${Date.now()}`,
      guidelines: 'innovative professional audience-first content creation technology framework',
      voiceTone: 'confident, knowledgeable, approachable',
      colors: ['#6C5CE7'],
      logos: [],
      targetAudience: 'Content creators',
      prohibitedWords: ['spam', 'cheap', 'clickbait'],
    });
    brandId = brand.id;
  });

  afterAll(() => {
    cleanupBrand(brandId);
  });

  describe('scoreContent', () => {
    it('returns a score result with the correct brandId', () => {
      const result = scoreContent(brandId, 'This is innovative and professional content for the audience.');
      expect(result.brandId).toBe(brandId);
      expect(result.breakdown).toBeDefined();
      expect(result.breakdown.overall).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.overall).toBeLessThanOrEqual(100);
      expect(result.scoredAt).toBeDefined();
    });

    it('includes a content snippet (max 100 chars)', () => {
      const longText = 'innovative professional '.repeat(20);
      const result = scoreContent(brandId, longText);
      expect(result.contentSnippet.length).toBeLessThanOrEqual(100);
    });

    it('penalizes prohibited words', () => {
      const cleanResult = scoreContent(brandId, 'Great innovative technology for professionals.');
      const spamResult = scoreContent(brandId, 'cheap spam clickbait for everyone.');
      expect(spamResult.breakdown.prohibitedWordPenalty).toBeGreaterThan(0);
      expect(spamResult.breakdown.overall).toBeLessThan(cleanResult.breakdown.overall);
    });

    it('provides suggestions when score is low', () => {
      const result = scoreContent(brandId, 'cheap spam clickbait rubbish!');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('throws when brand not found', () => {
      expect(() => scoreContent('nonexistent-brand-xyz-123', 'some content')).toThrow('Brand not found');
    });

    it('has a breakdown with all required fields', () => {
      const result = scoreContent(brandId, 'Professional content.');
      expect(result.breakdown).toMatchObject({
        keywordScore: expect.any(Number),
        toneScore: expect.any(Number),
        guidelineScore: expect.any(Number),
        prohibitedWordPenalty: expect.any(Number),
        overall: expect.any(Number),
      });
    });
  });

  describe('batchScore', () => {
    it('scores multiple content pieces', () => {
      const results = batchScore(brandId, [
        'Innovative professional content.',
        'cheap spam here',
      ]);
      expect(results.length).toBe(2);
      expect(results[0].brandId).toBe(brandId);
      expect(results[1].brandId).toBe(brandId);
    });

    it('returns empty array for empty input', () => {
      const results = batchScore(brandId, []);
      expect(results).toEqual([]);
    });

    it('scores single item batch', () => {
      const results = batchScore(brandId, ['Single item content.']);
      expect(results.length).toBe(1);
    });
  });
});
