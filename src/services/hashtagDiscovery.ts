const HASHTAG_DB: Record<string, { hashtags: { tag: string; reach: number; category: string }[] }> = {
  tech: {
    hashtags: [
      { tag: '#TechNews', reach: 5200000, category: 'tech' },
      { tag: '#Programming', reach: 3800000, category: 'tech' },
      { tag: '#WebDev', reach: 2900000, category: 'tech' },
      { tag: '#DevOps', reach: 1800000, category: 'tech' },
      { tag: '#OpenSource', reach: 2100000, category: 'tech' },
      { tag: '#JavaScript', reach: 4100000, category: 'tech' },
      { tag: '#Python', reach: 3500000, category: 'tech' },
      { tag: '#CloudComputing', reach: 1600000, category: 'tech' },
      { tag: '#CyberSecurity', reach: 2400000, category: 'tech' },
      { tag: '#SoftwareEngineering', reach: 1900000, category: 'tech' },
    ],
  },
  marketing: {
    hashtags: [
      { tag: '#DigitalMarketing', reach: 6100000, category: 'marketing' },
      { tag: '#ContentMarketing', reach: 3200000, category: 'marketing' },
      { tag: '#SEO', reach: 4500000, category: 'marketing' },
      { tag: '#SocialMedia', reach: 5800000, category: 'marketing' },
      { tag: '#MarketingTips', reach: 2700000, category: 'marketing' },
      { tag: '#BrandStrategy', reach: 1400000, category: 'marketing' },
      { tag: '#GrowthHacking', reach: 1900000, category: 'marketing' },
      { tag: '#EmailMarketing', reach: 1600000, category: 'marketing' },
      { tag: '#Copywriting', reach: 2100000, category: 'marketing' },
      { tag: '#Analytics', reach: 1300000, category: 'marketing' },
    ],
  },
  startup: {
    hashtags: [
      { tag: '#Startup', reach: 7200000, category: 'startup' },
      { tag: '#Entrepreneurship', reach: 5500000, category: 'startup' },
      { tag: '#VC', reach: 1800000, category: 'startup' },
      { tag: '#Founder', reach: 2400000, category: 'startup' },
      { tag: '#SaaS', reach: 1600000, category: 'startup' },
      { tag: '#ProductHunt', reach: 1200000, category: 'startup' },
      { tag: '#ScaleUp', reach: 800000, category: 'startup' },
      { tag: '#StartupLife', reach: 3100000, category: 'startup' },
      { tag: '#Innovation', reach: 4200000, category: 'startup' },
      { tag: '#Bootstrapped', reach: 900000, category: 'startup' },
    ],
  },
  ai: {
    hashtags: [
      { tag: '#AI', reach: 8900000, category: 'ai' },
      { tag: '#MachineLearning', reach: 5600000, category: 'ai' },
      { tag: '#DeepLearning', reach: 3200000, category: 'ai' },
      { tag: '#GenerativeAI', reach: 4800000, category: 'ai' },
      { tag: '#LLM', reach: 2100000, category: 'ai' },
      { tag: '#ChatGPT', reach: 6200000, category: 'ai' },
      { tag: '#NLP', reach: 1800000, category: 'ai' },
      { tag: '#ComputerVision', reach: 1500000, category: 'ai' },
      { tag: '#AIEthics', reach: 1100000, category: 'ai' },
      { tag: '#DataScience', reach: 4100000, category: 'ai' },
    ],
  },
};

const PLATFORM_LIMITS: Record<string, number> = {
  twitter: 5,
  linkedin: 5,
  threads: 10,
  instagram: 30,
};

export function discoverHashtags(topic: string): { tag: string; reach: number; category: string }[] {
  const key = topic.toLowerCase().trim();
  // Direct match
  if (HASHTAG_DB[key]) return HASHTAG_DB[key].hashtags;
  // Partial match across all categories
  const results: { tag: string; reach: number; category: string }[] = [];
  for (const cat of Object.values(HASHTAG_DB)) {
    for (const h of cat.hashtags) {
      if (h.tag.toLowerCase().includes(key) || h.category.includes(key)) {
        results.push(h);
      }
    }
  }
  if (results.length > 0) return results.sort((a, b) => b.reach - a.reach);
  // Fallback: return top from all categories
  return Object.values(HASHTAG_DB)
    .flatMap(c => c.hashtags)
    .sort((a, b) => b.reach - a.reach)
    .slice(0, 10);
}

export function getRecommendedHashtags(content: string, platform: string, count?: number): { tag: string; reach: number; relevance: number }[] {
  const limit = count || PLATFORM_LIMITS[platform.toLowerCase()] || 5;
  const contentLower = content.toLowerCase();

  // Score each hashtag by keyword overlap
  const allHashtags = Object.values(HASHTAG_DB).flatMap(c => c.hashtags);
  const scored = allHashtags.map(h => {
    const keywords = h.tag.replace('#', '').replace(/([A-Z])/g, ' $1').toLowerCase().trim().split(/\s+/);
    const relevance = keywords.filter(k => contentLower.includes(k)).length / Math.max(keywords.length, 1);
    return { tag: h.tag, reach: h.reach, relevance: Math.round(relevance * 100) / 100 };
  });

  return scored
    .sort((a, b) => b.relevance - a.relevance || b.reach - a.reach)
    .slice(0, limit);
}

export function getHashtagPerformance(hashtag: string): {
  hashtag: string;
  avgEngagement: number;
  weeklyVolume: number;
  trending: boolean;
  peakHours: number[];
} {
  // Stub with realistic-looking data
  const hash = hashtag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return {
    hashtag,
    avgEngagement: 1200 + (hash % 5000),
    weeklyVolume: 10000 + (hash % 90000),
    trending: hash % 3 === 0,
    peakHours: [9, 12, 17],
  };
}
