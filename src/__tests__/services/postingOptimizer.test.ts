/**
 * Tests: Posting Optimizer service
 */
import { describe, it, expect } from 'vitest';
import { getOptimalTimes, personalizeSchedule, suggestNextPostTime } from '../../services/postingOptimizer';

describe('Posting Optimizer Service', () => {
  describe('getOptimalTimes', () => {
    it('returns optimal times for twitter', () => {
      const result = getOptimalTimes('twitter');
      expect(result.platform).toBe('twitter');
      expect(result.windows.length).toBeGreaterThan(0);
      expect(result.bestOverall.day).toBeDefined();
      expect(result.bestOverall.hour).toBeDefined();
    });

    it('returns optimal times for linkedin', () => {
      const result = getOptimalTimes('linkedin');
      expect(result.platform).toBe('linkedin');
      expect(result.windows.some(w => w.score >= 90)).toBe(true); // LinkedIn mid-week is 90+
    });

    it('returns optimal times for threads', () => {
      const result = getOptimalTimes('threads');
      expect(result.platform).toBe('threads');
    });

    it('falls back to twitter for unknown platforms', () => {
      const result = getOptimalTimes('unknown_platform');
      expect(result.windows.length).toBeGreaterThan(0);
    });

    it('accepts a timezone parameter', () => {
      const result = getOptimalTimes('twitter', 'US/Eastern');
      expect(result.timezone).toBe('US/Eastern');
    });

    it('picks best day by score', () => {
      const result = getOptimalTimes('twitter');
      // Wednesday typically scores 92 for twitter — it should be the best
      expect(result.bestOverall.day).toBe('Wednesday');
    });
  });

  describe('personalizeSchedule', () => {
    it('returns empty array for empty data', () => {
      const windows = personalizeSchedule([]);
      expect(windows).toEqual([]);
    });

    it('creates windows from engagement data', () => {
      const data = [
        { day: 'Monday', hour: 9, engagement: 50 },
        { day: 'Monday', hour: 12, engagement: 50 },
        { day: 'Tuesday', hour: 9, engagement: 200 }, // Tuesday has much higher total
      ];
      const windows = personalizeSchedule(data);
      expect(windows.length).toBeGreaterThan(0);
      // Tuesday should score higher than Monday (more total engagement)
      const tuesday = windows.find(w => w.day === 'Tuesday');
      const monday = windows.find(w => w.day === 'Monday');
      expect(tuesday).toBeDefined();
      expect(monday).toBeDefined();
      expect(tuesday!.score).toBeGreaterThan(monday!.score);
    });

    it('scores windows relative to max engagement', () => {
      const data = [
        { day: 'Monday', hour: 9, engagement: 50 },
        { day: 'Tuesday', hour: 9, engagement: 100 },
      ];
      const windows = personalizeSchedule(data);
      const monday = windows.find(w => w.day === 'Monday')!;
      const tuesday = windows.find(w => w.day === 'Tuesday')!;
      expect(tuesday.score).toBeGreaterThan(monday.score);
    });
  });

  describe('suggestNextPostTime', () => {
    it('returns a suggested time with day and hour', () => {
      const result = suggestNextPostTime('twitter');
      expect(result.suggestedTime).toBeDefined();
      expect(result.day).toBeDefined();
      expect(typeof result.hour).toBe('number');
    });

    it('works for linkedin', () => {
      const result = suggestNextPostTime('linkedin');
      expect(result.suggestedTime).toBeDefined();
    });
  });
});
