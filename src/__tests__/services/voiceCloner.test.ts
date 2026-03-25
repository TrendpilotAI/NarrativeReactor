/**
 * Tests: Voice Cloner service (in-memory, no file IO)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Clean up test brands
const BRANDS_FILE = path.join(process.cwd(), 'data', 'brands.json');
function cleanupBrand(id: string) {
  if (!fs.existsSync(BRANDS_FILE)) return;
  try {
    const data = JSON.parse(fs.readFileSync(BRANDS_FILE, 'utf-8'));
    data.brands = data.brands.filter((b: any) => b.id !== id);
    fs.writeFileSync(BRANDS_FILE, JSON.stringify(data, null, 2));
  } catch { /* ignore */ }
}

import {
  analyzeContent,
  createVoiceProfile,
  addSamples,
  getVoiceProfile,
  getProfilesByBrand,
  generateContentGuidance,
  deleteVoiceProfile,
} from '../../services/voiceCloner';
import { createBrand } from '../../services/brandManager';

describe('Voice Cloner Service', () => {
  let brandId: string;

  beforeAll(() => {
    const brand = createBrand({
      name: `VoiceCloner Test Brand ${Date.now()}`,
      guidelines: 'Test guidelines',
      voiceTone: 'professional',
      colors: [],
      logos: [],
      targetAudience: 'Testers',
      prohibitedWords: [],
    });
    brandId = brand.id;
  });

  afterAll(() => {
    cleanupBrand(brandId);
  });

  describe('analyzeContent', () => {
    it('returns tone metrics for normal text', () => {
      const metrics = analyzeContent('This is a great and wonderful content.');
      expect(metrics).toHaveProperty('formality');
      expect(metrics).toHaveProperty('enthusiasm');
      expect(metrics).toHaveProperty('complexity');
      expect(metrics).toHaveProperty('sentimentPolarity');
      expect(metrics).toHaveProperty('avgSentenceLength');
      expect(metrics).toHaveProperty('vocabularyRichness');
    });

    it('detects positive sentiment for positive words', () => {
      const positive = analyzeContent('This is good great love amazing excellent wonderful best fantastic!');
      const negative = analyzeContent('This is bad terrible hate awful worst horrible poor ugly disappointing.');
      // Positive content should have higher or equal polarity than negative
      expect(positive.sentimentPolarity).toBeGreaterThanOrEqual(negative.sentimentPolarity);
    });

    it('detects formal language', () => {
      const formal = analyzeContent('Therefore, we should consequently implement this framework accordingly.');
      const casual = analyzeContent('hey cool stuff yeah gonna do it lol.');
      expect(formal.formality).toBeGreaterThan(casual.formality);
    });

    it('returns zero metrics for empty string', () => {
      const metrics = analyzeContent('');
      expect(metrics.avgSentenceLength).toBe(0);
      expect(metrics.vocabularyRichness).toBe(0);
    });
  });

  describe('createVoiceProfile', () => {
    it('creates a voice profile and returns it', () => {
      const profile = createVoiceProfile(brandId, 'Test Profile', [
        'Professional content about technology.',
        'Innovative solutions for modern problems.',
      ]);
      expect(profile.id).toBeDefined();
      expect(profile.brandId).toBe(brandId);
      expect(profile.name).toBe('Test Profile');
      expect(profile.sampleCount).toBe(2);
      expect(profile.metrics).toBeDefined();
      expect(profile.createdAt).toBeDefined();

      // cleanup
      deleteVoiceProfile(profile.id);
    });

    it('returns the profile from getVoiceProfile', () => {
      const profile = createVoiceProfile(brandId, 'Get Test', ['Sample text here.']);
      const found = getVoiceProfile(profile.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(profile.id);

      deleteVoiceProfile(profile.id);
    });
  });

  describe('addSamples', () => {
    it('adds samples and increases sampleCount', () => {
      const profile = createVoiceProfile(brandId, 'AddSamples Test', ['Initial sample.']);
      const updated = addSamples(profile.id, ['New sample 1.', 'New sample 2.']);
      expect(updated.sampleCount).toBe(3);

      deleteVoiceProfile(profile.id);
    });

    it('throws for unknown profile', () => {
      expect(() => addSamples('nonexistent-profile', ['text'])).toThrow();
    });
  });

  describe('getProfilesByBrand', () => {
    it('returns profiles for a specific brand', () => {
      const p1 = createVoiceProfile(brandId, 'Brand Profile 1', ['Sample 1.']);
      const p2 = createVoiceProfile(brandId, 'Brand Profile 2', ['Sample 2.']);
      const profiles = getProfilesByBrand(brandId);
      expect(profiles.some(p => p.id === p1.id)).toBe(true);
      expect(profiles.some(p => p.id === p2.id)).toBe(true);

      deleteVoiceProfile(p1.id);
      deleteVoiceProfile(p2.id);
    });

    it('returns empty array for unknown brand', () => {
      const profiles = getProfilesByBrand('nonexistent-brand-xyz-999');
      expect(profiles).toEqual([]);
    });
  });

  describe('generateContentGuidance', () => {
    it('returns guidance object with toneDescription and writingTips', () => {
      const profile = createVoiceProfile(brandId, 'Guidance Test', [
        'Professional content with great innovation.',
        'Excellent technical implementation framework.',
      ]);
      const guidance = generateContentGuidance(profile.id);
      expect(guidance).toHaveProperty('toneDescription');
      expect(guidance).toHaveProperty('writingTips');
      expect(guidance).toHaveProperty('examplePhrases');
      expect(Array.isArray(guidance.writingTips)).toBe(true);

      deleteVoiceProfile(profile.id);
    });

    it('throws for unknown profile', () => {
      expect(() => generateContentGuidance('nonexistent-profile-xyz')).toThrow();
    });
  });

  describe('deleteVoiceProfile', () => {
    it('deletes an existing profile', () => {
      const profile = createVoiceProfile(brandId, 'Delete Me', ['Text.']);
      const deleted = deleteVoiceProfile(profile.id);
      expect(deleted).toBe(true);
      expect(getVoiceProfile(profile.id)).toBeUndefined();
    });

    it('returns false for unknown profile', () => {
      expect(deleteVoiceProfile('nonexistent-xyz-999')).toBe(false);
    });
  });
});
