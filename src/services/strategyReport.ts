/**
 * Weekly Content Strategy Report
 * Auto-generates weekly reports with insights, recommendations, and performance summary.
 */

import { getCompetitors, analyzeCompetitorStrategy } from './competitorTracker';
import { getDefaultPersonas } from './audiencePersona';

export interface PerformanceSummary {
  totalPosts: number;
  totalEngagement: number;
  avgEngagementPerPost: number;
  topPlatform: string;
  topContentType: string;
  growthRate: number; // percentage
}

export interface WeeklyReport {
  id: string;
  generatedAt: string;
  weekStart: string;
  weekEnd: string;
  performance: PerformanceSummary;
  competitorInsights: { name: string; postsPerWeek: number; topTopic: string }[];
  recommendations: string[];
  highlights: string[];
  risks: string[];
}

export interface PostData {
  platform: string;
  contentType: string;
  engagement: number;
  timestamp: string;
}

/**
 * Generate a weekly strategy report from post data.
 */
export function generateWeeklyReport(
  posts: PostData[],
  previousWeekEngagement?: number,
): WeeklyReport {
  const now = new Date();
  const weekEnd = now.toISOString();
  const weekStart = new Date(now.getTime() - 7 * 86400000).toISOString();

  // Filter to this week's posts
  const weekPosts = posts.filter(p => p.timestamp >= weekStart && p.timestamp <= weekEnd);

  const performance = computePerformance(weekPosts, previousWeekEngagement);
  const competitorInsights = getCompetitorInsights();
  const recommendations = generateRecommendations(performance, competitorInsights);
  const highlights = generateHighlights(performance, weekPosts);
  const risks = identifyRisks(performance);

  return {
    id: `report_${Date.now()}`,
    generatedAt: now.toISOString(),
    weekStart,
    weekEnd,
    performance,
    competitorInsights,
    recommendations,
    highlights,
    risks,
  };
}

/**
 * Generate a report summary as readable text.
 */
export function formatReportAsText(report: WeeklyReport): string {
  const lines: string[] = [
    `📊 Weekly Content Strategy Report`,
    `Week: ${report.weekStart.slice(0, 10)} — ${report.weekEnd.slice(0, 10)}`,
    `Generated: ${report.generatedAt.slice(0, 10)}`,
    '',
    '## Performance Summary',
    `- Total Posts: ${report.performance.totalPosts}`,
    `- Total Engagement: ${report.performance.totalEngagement.toLocaleString()}`,
    `- Avg Engagement/Post: ${report.performance.avgEngagementPerPost}`,
    `- Top Platform: ${report.performance.topPlatform}`,
    `- Top Content Type: ${report.performance.topContentType}`,
    `- Growth Rate: ${report.performance.growthRate > 0 ? '+' : ''}${report.performance.growthRate}%`,
    '',
  ];

  if (report.competitorInsights.length > 0) {
    lines.push('## Competitor Insights');
    for (const ci of report.competitorInsights) {
      lines.push(`- ${ci.name}: ${ci.postsPerWeek} posts/week, top topic: ${ci.topTopic}`);
    }
    lines.push('');
  }

  if (report.highlights.length > 0) {
    lines.push('## Highlights');
    for (const h of report.highlights) lines.push(`✅ ${h}`);
    lines.push('');
  }

  if (report.risks.length > 0) {
    lines.push('## Risks');
    for (const r of report.risks) lines.push(`⚠️ ${r}`);
    lines.push('');
  }

  if (report.recommendations.length > 0) {
    lines.push('## Recommendations');
    for (const r of report.recommendations) lines.push(`💡 ${r}`);
  }

  return lines.join('\n');
}

/**
 * Compute performance metrics from post data.
 */
function computePerformance(posts: PostData[], previousWeekEngagement?: number): PerformanceSummary {
  if (posts.length === 0) {
    return {
      totalPosts: 0,
      totalEngagement: 0,
      avgEngagementPerPost: 0,
      topPlatform: 'N/A',
      topContentType: 'N/A',
      growthRate: 0,
    };
  }

  const totalEngagement = posts.reduce((sum, p) => sum + p.engagement, 0);
  const platformEng: Record<string, number> = {};
  const typeEng: Record<string, number> = {};

  for (const p of posts) {
    platformEng[p.platform] = (platformEng[p.platform] || 0) + p.engagement;
    typeEng[p.contentType] = (typeEng[p.contentType] || 0) + p.engagement;
  }

  const topPlatform = Object.entries(platformEng).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
  const topContentType = Object.entries(typeEng).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  let growthRate = 0;
  if (previousWeekEngagement && previousWeekEngagement > 0) {
    growthRate = Math.round(((totalEngagement - previousWeekEngagement) / previousWeekEngagement) * 100);
  }

  return {
    totalPosts: posts.length,
    totalEngagement,
    avgEngagementPerPost: Math.round(totalEngagement / posts.length),
    topPlatform,
    topContentType,
    growthRate,
  };
}

function getCompetitorInsights(): WeeklyReport['competitorInsights'] {
  try {
    const competitors = getCompetitors();
    return competitors.slice(0, 5).map(c => {
      try {
        const strategy = analyzeCompetitorStrategy(c.id);
        return {
          name: c.name,
          postsPerWeek: strategy.postingFrequency.postsPerWeek,
          topTopic: strategy.topTopics[0]?.topic || 'N/A',
        };
      } catch {
        return { name: c.name, postsPerWeek: 0, topTopic: 'N/A' };
      }
    });
  } catch {
    return [];
  }
}

function generateRecommendations(perf: PerformanceSummary, competitors: WeeklyReport['competitorInsights']): string[] {
  const recs: string[] = [];

  if (perf.growthRate < 0) {
    recs.push('Engagement is declining — consider testing new content formats or posting times');
  } else if (perf.growthRate > 20) {
    recs.push('Strong growth this week — double down on what\'s working');
  }

  if (perf.totalPosts < 5) {
    recs.push('Posting frequency is low — aim for at least 5 posts per week');
  }

  if (perf.topPlatform !== 'N/A') {
    recs.push(`${perf.topPlatform} is your top performer — allocate more content there`);
  }

  if (competitors.length > 0) {
    const avgCompPosts = competitors.reduce((s, c) => s + c.postsPerWeek, 0) / competitors.length;
    if (perf.totalPosts < avgCompPosts) {
      recs.push(`Competitors average ${Math.round(avgCompPosts)} posts/week — consider increasing your output`);
    }
  }

  if (recs.length === 0) {
    recs.push('Keep up the good work — maintain current strategy');
  }

  return recs;
}

function generateHighlights(perf: PerformanceSummary, posts: PostData[]): string[] {
  const highlights: string[] = [];

  if (perf.growthRate > 0) {
    highlights.push(`Engagement grew ${perf.growthRate}% week-over-week`);
  }

  if (posts.length > 0) {
    const best = posts.reduce((a, b) => a.engagement > b.engagement ? a : b);
    highlights.push(`Best performing post: ${best.contentType} on ${best.platform} (${best.engagement} engagement)`);
  }

  if (perf.totalPosts >= 7) {
    highlights.push('Consistent daily posting achieved');
  }

  return highlights;
}

function identifyRisks(perf: PerformanceSummary): string[] {
  const risks: string[] = [];

  if (perf.growthRate < -10) {
    risks.push('Significant engagement decline — review content quality and relevance');
  }

  if (perf.totalPosts === 0) {
    risks.push('No posts this week — audience retention may be affected');
  }

  if (perf.avgEngagementPerPost < 10 && perf.totalPosts > 0) {
    risks.push('Very low average engagement — content may not be reaching target audience');
  }

  return risks;
}
