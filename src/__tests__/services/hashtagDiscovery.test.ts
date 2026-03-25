/**
 * Tests: Hashtag Discovery service
 */
import { describe, it, expect } from 'vitest';
import { discoverHashtags, getRecommendedHashtags, getHashtagPerformance } from '../../services/hashtagDiscovery';

describe('Hashtag Discovery Service', () => {
  describe('discoverHashtags', () => {
    it('returns hashtags for tech topic', () => {
      const hashtags = discoverHashtags('tech');
      expect(hashtags.length).toBeGreaterThan(0);
      expect(hashtags[0]).toHaveProperty('tag');
      expect(hashtags[0]).toHaveProperty('reach');
      expect(hashtags[0]).toHaveProperty('category');
    });

    it('returns hashtags for ai topic', () => {
      const hashtags = discoverHashtags('ai');
      expect(hashtags.length).toBeGreaterThan(0);
      expect(hashtags.some(h => h.tag === '#AI')).toBe(true);
    });

    it('returns hashtags for marketing topic', () => {
      const hashtags = discoverHashtags('marketing');
      expect(hashtags.length).toBeGreaterThan(0);
    });

    it('returns hashtags for startup topic', () => {
      const hashtags = discoverHashtags('startup');
      expect(hashtags.length).toBeGreaterThan(0);
    });

    it('returns partial matches for related terms', () => {
      const hashtags = discoverHashtags('machine');
      expect(hashtags.length).toBeGreaterThan(0);
    });

    it('returns fallback hashtags for unknown topics', () => {
      const hashtags = discoverHashtags('zyxunknownzyxtopic');
      expect(hashtags.length).toBeGreaterThan(0); // should return general fallbacks
    });
  });

  describe('getRecommendedHashtags', () => {
    it('returns recommendations for twitter content', () => {
      const recs = getRecommendedHashtags(
        'Machine learning and AI are transforming the tech industry.',
        'twitter'
      );
      expect(recs.length).toBeGreaterThan(0);
      expect(recs[0]).toHaveProperty('tag');
      expect(recs[0]).toHaveProperty('reach');
      expect(recs[0]).toHaveProperty('relevance');
    });

    it('respects platform default limit for twitter (max 5) when no count specified', () => {
      const recs = getRecommendedHashtags(
        'Tech startup AI marketing content strategy.',
        'twitter'
      );
      expect(recs.length).toBeLessThanOrEqual(5);
    });

    it('allows up to 30 for instagram', () => {
      const recs = getRecommendedHashtags(
        'Tech startup AI marketing content strategy.',
        'instagram'
      );
      expect(recs.length).toBeLessThanOrEqual(30);
    });

    it('returns requested count when within platform limit', () => {
      const recs = getRecommendedHashtags('AI content', 'linkedin', 3);
      expect(recs.length).toBeLessThanOrEqual(3);
    });

    it('sorts by relevance descending', () => {
      const recs = getRecommendedHashtags('AI machine learning deep learning', 'twitter');
      if (recs.length >= 2) {
        expect(recs[0].relevance).toBeGreaterThanOrEqual(recs[1].relevance);
      }
    });
  });

  describe('getHashtagPerformance', () => {
    it('returns performance data for known hashtag', () => {
      const perf = getHashtagPerformance('#AI');
      expect(perf).toHaveProperty('avgEngagement');
      expect(perf).toHaveProperty('weeklyVolume');
      expect(perf).toHaveProperty('trending');
      expect(perf).toHaveProperty('peakHours');
      expect(perf.avgEngagement).toBeGreaterThan(0);
    });

    it('returns performance for various hashtags', () => {
      const hashtags = ['#TechNews', '#StartupLife', '#ContentMarketing', '#MachineLearning'];
      for (const h of hashtags) {
        const perf = getHashtagPerformance(h);
        expect(perf).toBeDefined();
        expect(perf.weeklyVolume).toBeGreaterThan(0);
      }
    });

    it('always returns data (stub behavior)', () => {
      const perf = getHashtagPerformance('#ZZZUnknownHashtag999');
      // Stub always returns data based on hash of tag string
      expect(perf).toBeDefined();
      expect(perf.avgEngagement).toBeGreaterThan(0);
      expect(perf.weeklyVolume).toBeGreaterThan(0);
      expect(Array.isArray(perf.peakHours)).toBe(true);
    });
  });
});
