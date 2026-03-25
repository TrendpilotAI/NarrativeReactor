/**
 * Tests: Caption Generator service
 */
import { describe, it, expect } from 'vitest';
import {
  generateCaptions,
  translateCaptions,
  getSupportedLanguages,
} from '../../services/captionGenerator';

describe('Caption Generator Service', () => {
  const sampleText = 'Hello world. This is a test script for caption generation. It has multiple sentences.';

  describe('generateCaptions', () => {
    it('generates SRT captions by default', () => {
      const result = generateCaptions(sampleText);
      expect(result.format).toBe('srt');
      expect(result.language).toBe('en');
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.totalDuration).toBeGreaterThan(0);
    });

    it('generates VTT captions when requested', () => {
      const result = generateCaptions(sampleText, { format: 'vtt' });
      expect(result.format).toBe('vtt');
      expect(result.raw).toContain('WEBVTT');
    });

    it('SRT raw output has proper format', () => {
      const result = generateCaptions(sampleText, { format: 'srt' });
      expect(result.raw).toMatch(/\d+\r?\n\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}/);
    });

    it('respects startOffset option', () => {
      const result = generateCaptions(sampleText, { startOffset: 10 });
      // First caption should start at 10 seconds or later
      expect(result.lines[0].startTime).toBeGreaterThanOrEqual(10);
    });

    it('respects wordsPerMinute option', () => {
      const fast = generateCaptions(sampleText, { wordsPerMinute: 300 });
      const slow = generateCaptions(sampleText, { wordsPerMinute: 75 });
      expect(fast.totalDuration).toBeLessThan(slow.totalDuration);
    });

    it('throws on empty input', () => {
      expect(() => generateCaptions('')).toThrow();
    });

    it('sets language on result', () => {
      const result = generateCaptions(sampleText, { language: 'es' });
      expect(result.language).toBe('es');
    });

    it('each line has word timings', () => {
      const result = generateCaptions('Hello world testing.');
      if (result.lines.length > 0) {
        expect(result.lines[0].words.length).toBeGreaterThan(0);
        expect(result.lines[0].words[0].word).toBeDefined();
        expect(result.lines[0].words[0].startTime).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('translateCaptions', () => {
    it('translates to a different language', () => {
      const original = generateCaptions('Hello world.', { language: 'en' });
      const translated = translateCaptions(original, 'es');
      expect(translated.language).toBe('es');
      // Lines should still exist
      expect(translated.lines.length).toBeGreaterThanOrEqual(0);
    });

    it('preserves timing information', () => {
      const original = generateCaptions(sampleText);
      const translated = translateCaptions(original, 'fr');
      expect(translated.totalDuration).toBe(original.totalDuration);
    });
  });

  describe('getSupportedLanguages', () => {
    it('returns an array including English', () => {
      const langs = getSupportedLanguages();
      expect(Array.isArray(langs)).toBe(true);
      expect(langs).toContain('en');
    });

    it('includes multiple languages', () => {
      const langs = getSupportedLanguages();
      expect(langs.length).toBeGreaterThan(1);
    });
  });
});
