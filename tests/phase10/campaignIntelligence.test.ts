import { describe, it, expect, beforeEach } from 'vitest';

// Competitor Tracker
import { addCompetitor, getCompetitors, recordCompetitorPost, getCompetitorActivity, analyzeCompetitorStrategy } from '../../src/services/competitorTracker';

// Hashtag Discovery
import { discoverHashtags, getRecommendedHashtags, getHashtagPerformance } from '../../src/services/hashtagDiscovery';

// Posting Scheduler
import { getAudienceAwareSchedule, buildWeeklyPlan, analyzeEngagementPatterns } from '../../src/services/postingScheduler';
import { getOptimalTimes, suggestNextPostTime } from '../../src/services/postingOptimizer';

// Persona Builder
import { buildEnrichedPersona, matchPersona, mergeSnapshots } from '../../src/services/personaBuilder';
import { getDefaultPersonas } from '../../src/services/audiencePersona';

// Strategy Report
import { generateWeeklyReport, formatReportAsText } from '../../src/services/strategyReport';

// ── Hashtag Discovery Tests ──

describe('Hashtag Discovery', () => {
  it('should discover hashtags for a known topic', () => {
    const results = discoverHashtags('tech');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('tag');
    expect(results[0]).toHaveProperty('reach');
  });

  it('should return fallback hashtags for unknown topic', () => {
    const results = discoverHashtags('xyznonexistent');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should recommend hashtags for content with platform limits', () => {
    const recs = getRecommendedHashtags('Learn JavaScript and Python programming', 'twitter');
    expect(recs.length).toBeLessThanOrEqual(5); // twitter limit
    expect(recs[0]).toHaveProperty('relevance');
  });

  it('should return hashtag performance data', () => {
    const perf = getHashtagPerformance('#AI');
    expect(perf.hashtag).toBe('#AI');
    expect(perf.avgEngagement).toBeGreaterThan(0);
    expect(perf).toHaveProperty('trending');
    expect(perf.peakHours).toBeInstanceOf(Array);
  });
});

// ── Posting Scheduler Tests ──

describe('Posting Scheduler', () => {
  it('should return optimal times for a platform', () => {
    const result = getOptimalTimes('linkedin');
    expect(result.platform).toBe('linkedin');
    expect(result.windows.length).toBeGreaterThan(0);
    expect(result.bestOverall).toHaveProperty('day');
    expect(result.bestOverall).toHaveProperty('hour');
  });

  it('should suggest next post time', () => {
    const suggestion = suggestNextPostTime('twitter');
    expect(suggestion).toHaveProperty('suggestedTime');
    expect(suggestion).toHaveProperty('day');
    expect(suggestion).toHaveProperty('hour');
  });

  it('should build a weekly plan', () => {
    const plan = buildWeeklyPlan('twitter', 5);
    expect(plan.platform).toBe('twitter');
    expect(plan.postsPerWeek).toBe(5);
    expect(plan.slots.length).toBe(5);
    expect(plan.slots[0]).toHaveProperty('priority');
  });

  it('should analyze engagement patterns', () => {
    const data = [
      { day: 'Monday', hour: 9, engagement: 150 },
      { day: 'Monday', hour: 12, engagement: 200 },
      { day: 'Tuesday', hour: 9, engagement: 180 },
      { day: 'Wednesday', hour: 14, engagement: 50 },
    ];
    const result = analyzeEngagementPatterns(data);
    expect(result.bestDay).toBe('Monday');
    expect(result.avgEngagement).toBeGreaterThan(0);
    expect(result.personalizedWindows.length).toBeGreaterThan(0);
  });

  it('should handle empty engagement data', () => {
    const result = analyzeEngagementPatterns([]);
    expect(result.bestDay).toBe('N/A');
    expect(result.avgEngagement).toBe(0);
  });

  it('should generate audience-aware schedule', () => {
    const personas = getDefaultPersonas();
    const schedule = getAudienceAwareSchedule('twitter', personas[0]);
    expect(schedule.persona).toBe(personas[0].name);
    expect(schedule.platform).toBe('twitter');
    expect(schedule.recommendedSlots.length).toBeGreaterThan(0);
    // Should be sorted by score descending
    for (let i = 1; i < schedule.recommendedSlots.length; i++) {
      expect(schedule.recommendedSlots[i].score).toBeLessThanOrEqual(schedule.recommendedSlots[i - 1].score);
    }
  });
});

// ── Persona Builder Tests ──

describe('Persona Builder', () => {
  it('should build enriched persona from engagement data', () => {
    const result = buildEnrichedPersona({
      ageGroups: { '25-34': 500, '35-44': 300 },
      locations: { 'US': 600, 'UK': 200 },
      activeHourCounts: { 9: 100, 12: 150, 17: 80 },
      contentTypeEngagement: { 'tutorials': 400, 'news': 200 },
      platformEngagement: { 'twitter': 500, 'linkedin': 300 },
      dayEngagement: { 'Tuesday': 400, 'Wednesday': 350 },
    });
    expect(result.persona).toHaveProperty('id');
    expect(result.insights.length).toBeGreaterThan(0);
    expect(result.contentRecommendations.length).toBeGreaterThan(0);
    expect(result.bestPlatforms).toContain('twitter');
  });

  it('should match content topics to a persona', () => {
    const persona = matchPersona(['software', 'development', 'cloud']);
    expect(persona).toHaveProperty('id');
    expect(persona).toHaveProperty('name');
  });

  it('should merge multiple snapshots', () => {
    const merged = mergeSnapshots([
      { ageGroups: { '25-34': 100 }, interests: ['ai'] },
      { ageGroups: { '25-34': 200, '35-44': 50 }, interests: ['ml', 'ai'] },
    ]);
    expect(merged.ageGroups!['25-34']).toBe(300);
    expect(merged.ageGroups!['35-44']).toBe(50);
    expect(merged.interests).toContain('ai');
    expect(merged.interests).toContain('ml');
    // Should deduplicate
    expect(merged.interests!.filter(i => i === 'ai').length).toBe(1);
  });
});

// ── Strategy Report Tests ──

describe('Strategy Report', () => {
  const now = new Date();
  const makePosts = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      platform: i % 2 === 0 ? 'twitter' : 'linkedin',
      contentType: i % 3 === 0 ? 'thread' : 'article',
      engagement: 100 + i * 50,
      timestamp: new Date(now.getTime() - (i * 86400000 / 2)).toISOString(),
    }));
  };

  it('should generate a weekly report', () => {
    const report = generateWeeklyReport(makePosts(10), 500);
    expect(report).toHaveProperty('id');
    expect(report).toHaveProperty('performance');
    expect(report).toHaveProperty('recommendations');
    expect(report.performance.totalPosts).toBeGreaterThan(0);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('should handle empty posts', () => {
    const report = generateWeeklyReport([], 100);
    expect(report.performance.totalPosts).toBe(0);
    expect(report.performance.avgEngagementPerPost).toBe(0);
    expect(report.risks.length).toBeGreaterThan(0);
  });

  it('should format report as text', () => {
    const report = generateWeeklyReport(makePosts(5));
    const text = formatReportAsText(report);
    expect(text).toContain('Weekly Content Strategy Report');
    expect(text).toContain('Performance Summary');
  });

  it('should detect declining engagement', () => {
    const report = generateWeeklyReport(makePosts(3), 99999);
    // Growth rate should be negative since current engagement < 99999
    expect(report.performance.growthRate).toBeLessThan(0);
    expect(report.recommendations.some(r => r.includes('declining') || r.includes('Engagement'))).toBe(true);
  });
});
