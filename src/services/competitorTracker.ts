import fs from 'fs';
import path from 'path';

const DATA_PATH = path.join(process.cwd(), 'data', 'competitors.json');

export interface CompetitorPost {
  id: string;
  platform: string;
  content: string;
  timestamp: string;
  engagement?: { likes?: number; shares?: number; comments?: number };
  topics?: string[];
}

export interface Competitor {
  id: string;
  name: string;
  platforms: string[];
  posts: CompetitorPost[];
  createdAt: string;
}

interface CompetitorData {
  competitors: Competitor[];
}

function loadData(): CompetitorData {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { competitors: [] };
  }
}

function saveData(data: CompetitorData): void {
  const dir = path.dirname(DATA_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

export function addCompetitor(name: string, platforms: string[]): Competitor {
  const data = loadData();
  const competitor: Competitor = {
    id: `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    platforms,
    posts: [],
    createdAt: new Date().toISOString(),
  };
  data.competitors.push(competitor);
  saveData(data);
  return competitor;
}

export function getCompetitors(): Competitor[] {
  return loadData().competitors;
}

export function recordCompetitorPost(competitorId: string, post: Omit<CompetitorPost, 'id'>): CompetitorPost {
  const data = loadData();
  const comp = data.competitors.find(c => c.id === competitorId);
  if (!comp) throw new Error(`Competitor ${competitorId} not found`);
  const fullPost: CompetitorPost = {
    ...post,
    id: `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
  };
  comp.posts.push(fullPost);
  saveData(data);
  return fullPost;
}

export function getCompetitorActivity(competitorId: string, days: number = 30): CompetitorPost[] {
  const data = loadData();
  const comp = data.competitors.find(c => c.id === competitorId);
  if (!comp) throw new Error(`Competitor ${competitorId} not found`);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  return comp.posts.filter(p => p.timestamp >= cutoff).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function analyzeCompetitorStrategy(competitorId: string): {
  postingFrequency: { postsPerWeek: number; mostActiveDay: string; mostActivePlatform: string };
  topTopics: { topic: string; count: number }[];
  engagementPatterns: { avgLikes: number; avgShares: number; avgComments: number; bestPerformingTopic: string };
} {
  const data = loadData();
  const comp = data.competitors.find(c => c.id === competitorId);
  if (!comp) throw new Error(`Competitor ${competitorId} not found`);

  const posts = comp.posts;
  if (posts.length === 0) {
    return {
      postingFrequency: { postsPerWeek: 0, mostActiveDay: 'N/A', mostActivePlatform: 'N/A' },
      topTopics: [],
      engagementPatterns: { avgLikes: 0, avgShares: 0, avgComments: 0, bestPerformingTopic: 'N/A' },
    };
  }

  // Posting frequency
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayCounts: Record<string, number> = {};
  const platformCounts: Record<string, number> = {};
  posts.forEach(p => {
    const day = dayNames[new Date(p.timestamp).getDay()];
    dayCounts[day] = (dayCounts[day] || 0) + 1;
    platformCounts[p.platform] = (platformCounts[p.platform] || 0) + 1;
  });

  const sortedDays = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  const sortedPlatforms = Object.entries(platformCounts).sort((a, b) => b[1] - a[1]);

  const timeSpanDays = Math.max(1, (Date.now() - new Date(posts[0].timestamp).getTime()) / 86400000);
  const postsPerWeek = Math.round((posts.length / timeSpanDays) * 7 * 10) / 10;

  // Topics
  const topicCounts: Record<string, number> = {};
  posts.forEach(p => (p.topics || []).forEach(t => { topicCounts[t] = (topicCounts[t] || 0) + 1; }));
  const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, count }));

  // Engagement
  let totalLikes = 0, totalShares = 0, totalComments = 0;
  const topicEngagement: Record<string, number> = {};
  posts.forEach(p => {
    const e = p.engagement || {};
    totalLikes += e.likes || 0;
    totalShares += e.shares || 0;
    totalComments += e.comments || 0;
    const total = (e.likes || 0) + (e.shares || 0) + (e.comments || 0);
    (p.topics || []).forEach(t => { topicEngagement[t] = (topicEngagement[t] || 0) + total; });
  });

  const bestTopic = Object.entries(topicEngagement).sort((a, b) => b[1] - a[1])[0];

  return {
    postingFrequency: {
      postsPerWeek,
      mostActiveDay: sortedDays[0]?.[0] || 'N/A',
      mostActivePlatform: sortedPlatforms[0]?.[0] || 'N/A',
    },
    topTopics,
    engagementPatterns: {
      avgLikes: Math.round(totalLikes / posts.length),
      avgShares: Math.round(totalShares / posts.length),
      avgComments: Math.round(totalComments / posts.length),
      bestPerformingTopic: bestTopic?.[0] || 'N/A',
    },
  };
}
