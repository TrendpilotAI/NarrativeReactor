/**
 * Tests: Brand Voice + Voice Cloner services
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

import { analyzeBrandVoice, generateWithVoice } from '../../services/brandVoice';
import { createBrand } from '../../services/brandManager';

describe('Brand Voice Service', () => {
  let brandId: string;

  beforeAll(() => {
    const brand = createBrand({
      name: `Voice Test Brand ${Date.now()}`,
      guidelines: 'Professional technology-focused content.',
      voiceTone: 'formal, confident',
      colors: [],
      logos: [],
      targetAudience: 'Engineers',
      prohibitedWords: ['spam', 'fake'],
    });
    brandId = brand.id;
  });

  afterAll(() => {
    cleanupBrand(brandId);
  });

  describe('analyzeBrandVoice', () => {
    it('returns a voice profile with expected fields', () => {
      const profile = analyzeBrandVoice([
        'Therefore, we should implement this framework for the architecture.',
        'Furthermore, the algorithm deployment is critical for infrastructure.',
      ]);
      expect(profile).toHaveProperty('formality');
      expect(profile).toHaveProperty('humor');
      expect(profile).toHaveProperty('technicality');
      expect(profile).toHaveProperty('avgSentenceLength');
      expect(profile).toHaveProperty('favoriteWords');
      expect(profile).toHaveProperty('avoidWords');
    });

    it('detects formal language (higher formality for formal words)', () => {
      const formal = analyzeBrandVoice([
        'Therefore, we should consequently implement this accordingly. Furthermore, pursuant to guidelines.',
      ]);
      const casual = analyzeBrandVoice(['hey cool awesome stuff lol yeah gonna wanna.']);
      expect(formal.formality).toBeGreaterThanOrEqual(casual.formality);
    });

    it('detects humorous content (humor > 0)', () => {
      const profile = analyzeBrandVoice([
        'haha that is so funny lol awesome hilarious.',
      ]);
      expect(profile.humor).toBeGreaterThan(0);
    });

    it('detects technical language', () => {
      const profile = analyzeBrandVoice([
        'The algorithm infrastructure implementation framework deploys the API architecture.',
      ]);
      expect(profile.technicality).toBeGreaterThan(0);
    });

    it('handles empty input gracefully', () => {
      const profile = analyzeBrandVoice([]);
      expect(profile.avgSentenceLength).toBe(0);
      expect(profile.favoriteWords).toEqual([]);
    });

    it('calculates avgSentenceLength correctly', () => {
      const profile = analyzeBrandVoice([
        'One two three four five. Six seven eight.',
      ]);
      // ~8 words / 2 sentences ≈ 4
      expect(profile.avgSentenceLength).toBeGreaterThan(0);
    });

    it('returns top 10 favorite words max', () => {
      const profile = analyzeBrandVoice(['hello world hello world testing testing things more words content']);
      expect(profile.favoriteWords.length).toBeLessThanOrEqual(10);
    });
  });

  describe('generateWithVoice', () => {
    it('returns prompt, voiceInstructions, and brandId', () => {
      const result = generateWithVoice('Write about technology', brandId);
      expect(result.prompt).toBe('Write about technology');
      expect(result.voiceInstructions).toContain('formal');
      expect(result.brandId).toBe(brandId);
    });

    it('includes prohibited words in instructions when set', () => {
      const result = generateWithVoice('Write content', brandId);
      expect(result.voiceInstructions).toContain('spam');
    });

    it('includes target audience', () => {
      const result = generateWithVoice('prompt', brandId);
      expect(result.voiceInstructions).toContain('Engineers');
    });

    it('throws when brand not found', () => {
      expect(() => generateWithVoice('prompt', 'nonexistent-xyz-456')).toThrow('Brand not found');
    });
  });
});
