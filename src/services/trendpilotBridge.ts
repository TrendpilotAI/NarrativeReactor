import { saveContent } from './contentLibrary';

const TRENDPILOT_URL = process.env.TRENDPILOT_URL || 'http://localhost:3500';

export interface TrendingTopic {
  id: string;
  title: string;
  score: number;
  source: string;
  category?: string;
  keywords?: string[];
  url?: string;
  [key: string]: any;
}

export interface ContentBrief {
  topic: string;
  angle: string;
  targetPlatforms: string[];
  keyPoints: string[];
  suggestedHashtags: string[];
  tone: string;
}

// --- Fetch trending topics from Trendpilot ---

export async function fetchTrendingTopics(): Promise<TrendingTopic[]> {
  const resp = await fetch(`${TRENDPILOT_URL}/api/trends`);
  if (!resp.ok) {
    throw new Error(`Trendpilot error: HTTP ${resp.status}`);
  }
  const data = await resp.json();
  return Array.isArray(data) ? data : data.trends || [];
}

// --- Generate a content brief from a trend (AI placeholder) ---

export async function generateBriefFromTrend(trend: TrendingTopic): Promise<ContentBrief> {
  // In production, this would call a Genkit flow or LLM
  // For now, generate a structured brief from the trend data
  const brief: ContentBrief = {
    topic: trend.title,
    angle: `Fresh take on "${trend.title}" — why it matters now`,
    targetPlatforms: ['twitter', 'instagram', 'linkedin'],
    keyPoints: [
      `${trend.title} is trending (score: ${trend.score})`,
      `Source: ${trend.source}`,
      ...(trend.keywords || []).slice(0, 3).map(k => `Related: ${k}`),
    ],
    suggestedHashtags: (trend.keywords || [trend.title.replace(/\s+/g, '')]).map(k => `#${k.replace(/\s+/g, '')}`),
    tone: 'engaging, informative',
  };
  return brief;
}

// --- Full auto-generate pipeline ---

export async function autoGenerateContent(trend: TrendingTopic): Promise<{ brief: ContentBrief; contentId: string }> {
  const brief = await generateBriefFromTrend(trend);

  // Generate content from the brief
  const content = [
    `📈 ${brief.topic}`,
    '',
    brief.angle,
    '',
    ...brief.keyPoints.map(p => `• ${p}`),
    '',
    brief.suggestedHashtags.join(' '),
  ].join('\n');

  // Save to content library
  const entry = saveContent(content, {
    type: 'trend-generated',
    title: brief.topic,
    tags: brief.suggestedHashtags.map(h => h.replace('#', '')),
    platform: brief.targetPlatforms[0],
    trendId: trend.id,
    trendSource: trend.source,
    brief,
  });

  return { brief, contentId: entry.id };
}
