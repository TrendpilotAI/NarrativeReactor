/**
 * Video Performance Predictor
 * Estimates engagement metrics before publishing based on video attributes and historical data.
 */

export interface VideoAttributes {
  title: string;
  description?: string;
  duration: number; // seconds
  topic: string;
  thumbnailQuality: number; // 0-100
  hasSubtitles: boolean;
  platform: 'youtube' | 'tiktok' | 'instagram' | 'twitter' | 'linkedin';
}

export interface HistoricalDataPoint {
  views: number;
  likes: number;
  shares: number;
  comments: number;
  duration: number;
  topic: string;
}

export interface EngagementPrediction {
  estimatedViews: { low: number; mid: number; high: number };
  estimatedLikes: { low: number; mid: number; high: number };
  estimatedShares: { low: number; mid: number; high: number };
  engagementRate: number; // 0-1
  overallScore: number; // 0-100
  factors: PredictionFactor[];
  recommendations: string[];
}

export interface PredictionFactor {
  name: string;
  score: number; // 0-1
  weight: number;
  description: string;
}

const OPTIMAL_DURATIONS: Record<string, { min: number; max: number; ideal: number }> = {
  youtube: { min: 60, max: 600, ideal: 480 },
  tiktok: { min: 15, max: 60, ideal: 30 },
  instagram: { min: 15, max: 90, ideal: 30 },
  twitter: { min: 15, max: 140, ideal: 45 },
  linkedin: { min: 30, max: 300, ideal: 120 },
};

const TOPIC_MULTIPLIERS: Record<string, number> = {
  technology: 1.2,
  entertainment: 1.3,
  education: 1.1,
  business: 1.0,
  health: 1.05,
  finance: 1.15,
  lifestyle: 1.1,
  gaming: 1.25,
  news: 0.95,
  sports: 1.1,
};

function scoreTitleQuality(title: string): number {
  let score = 0.5;
  const len = title.length;
  if (len >= 30 && len <= 70) score += 0.15;
  else if (len < 10 || len > 100) score -= 0.15;
  if (/\d/.test(title)) score += 0.1; // numbers
  if (/[?!]/.test(title)) score += 0.05; // engagement punctuation
  if (/how|why|what|best|top|guide|secret|amazing/i.test(title)) score += 0.1;
  if (title === title.toUpperCase() && title.length > 5) score -= 0.1; // all caps penalty
  return Math.max(0, Math.min(1, score));
}

function scoreDuration(duration: number, platform: string): number {
  const range = OPTIMAL_DURATIONS[platform] || OPTIMAL_DURATIONS.youtube;
  if (duration >= range.min && duration <= range.max) {
    const dist = Math.abs(duration - range.ideal) / range.ideal;
    return Math.max(0.3, 1 - dist * 0.5);
  }
  if (duration < range.min) return 0.3;
  return Math.max(0.1, 0.5 - (duration - range.max) / range.max);
}

function scoreThumbnail(quality: number): number {
  return Math.max(0, Math.min(1, quality / 100));
}

function computeBaseViews(platform: string): number {
  const bases: Record<string, number> = {
    youtube: 5000, tiktok: 10000, instagram: 3000, twitter: 2000, linkedin: 1500,
  };
  return bases[platform] || 3000;
}

export function predictPerformance(
  attrs: VideoAttributes,
  historicalData?: HistoricalDataPoint[]
): EngagementPrediction {
  if (!attrs.title || attrs.duration <= 0) {
    throw new Error('Valid title and positive duration required');
  }

  const factors: PredictionFactor[] = [];

  // Title quality
  const titleScore = scoreTitleQuality(attrs.title);
  factors.push({ name: 'title_quality', score: titleScore, weight: 0.2, description: 'Title length, keywords, and engagement triggers' });

  // Duration fitness
  const durationScore = scoreDuration(attrs.duration, attrs.platform);
  factors.push({ name: 'duration_fitness', score: durationScore, weight: 0.2, description: 'How well duration fits platform norms' });

  // Thumbnail quality
  const thumbScore = scoreThumbnail(attrs.thumbnailQuality);
  factors.push({ name: 'thumbnail_quality', score: thumbScore, weight: 0.25, description: 'Visual quality and appeal of thumbnail' });

  // Subtitles bonus
  const subtitleScore = attrs.hasSubtitles ? 0.8 : 0.4;
  factors.push({ name: 'accessibility', score: subtitleScore, weight: 0.1, description: 'Subtitles and accessibility features' });

  // Topic relevance
  const topicMult = TOPIC_MULTIPLIERS[attrs.topic.toLowerCase()] || 1.0;
  const topicScore = Math.min(1, topicMult / 1.3);
  factors.push({ name: 'topic_relevance', score: topicScore, weight: 0.25, description: 'Topic popularity and trend alignment' });

  // Weighted overall
  const overallRaw = factors.reduce((sum, f) => sum + f.score * f.weight, 0);
  const overallScore = Math.round(overallRaw * 100);

  // Historical adjustment
  let histMultiplier = 1;
  if (historicalData && historicalData.length > 0) {
    const avgViews = historicalData.reduce((s, d) => s + d.views, 0) / historicalData.length;
    const base = computeBaseViews(attrs.platform);
    histMultiplier = avgViews / base;
    if (histMultiplier < 0.5) histMultiplier = 0.5;
    if (histMultiplier > 5) histMultiplier = 5;
  }

  const baseViews = computeBaseViews(attrs.platform) * overallRaw * topicMult * histMultiplier;
  const estimatedViews = {
    low: Math.round(baseViews * 0.5),
    mid: Math.round(baseViews),
    high: Math.round(baseViews * 2),
  };

  const engagementRate = overallRaw * 0.08; // ~8% max
  const estimatedLikes = {
    low: Math.round(estimatedViews.low * engagementRate * 0.5),
    mid: Math.round(estimatedViews.mid * engagementRate),
    high: Math.round(estimatedViews.high * engagementRate * 1.5),
  };
  const estimatedShares = {
    low: Math.round(estimatedLikes.low * 0.1),
    mid: Math.round(estimatedLikes.mid * 0.15),
    high: Math.round(estimatedLikes.high * 0.25),
  };

  // Recommendations
  const recommendations: string[] = [];
  if (titleScore < 0.6) recommendations.push('Improve title: add numbers, questions, or power words');
  if (durationScore < 0.5) recommendations.push(`Adjust duration closer to ${OPTIMAL_DURATIONS[attrs.platform]?.ideal || 120}s for ${attrs.platform}`);
  if (thumbScore < 0.6) recommendations.push('Improve thumbnail quality — use high-contrast images with clear text');
  if (!attrs.hasSubtitles) recommendations.push('Add subtitles to increase accessibility and engagement');
  if (recommendations.length === 0) recommendations.push('Looking good! Consider A/B testing thumbnails for further optimization');

  return {
    estimatedViews,
    estimatedLikes,
    estimatedShares,
    engagementRate: Math.round(engagementRate * 1000) / 1000,
    overallScore,
    factors,
    recommendations,
  };
}
