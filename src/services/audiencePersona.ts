export interface PersonaProfile {
  id: string;
  name: string;
  demographics: { ageRange: string; gender: string; location: string; education: string; income: string };
  interests: string[];
  activeHours: { start: number; end: number; timezone: string }[];
  preferredContentTypes: string[];
  engagementPatterns: { peakDays: string[]; avgSessionMinutes: number; preferredPlatforms: string[]; contentInteractionRate: number };
}

const DEFAULT_PERSONAS: PersonaProfile[] = [
  {
    id: 'persona_tech_professional',
    name: 'Tech Professional',
    demographics: { ageRange: '28-42', gender: 'Mixed', location: 'US/Europe metro areas', education: "Bachelor's/Master's in CS or Engineering", income: '$90k-$160k' },
    interests: ['software development', 'cloud computing', 'open source', 'AI/ML', 'developer tools', 'tech conferences', 'career growth'],
    activeHours: [
      { start: 7, end: 9, timezone: 'US/Pacific' },
      { start: 12, end: 13, timezone: 'US/Pacific' },
      { start: 20, end: 22, timezone: 'US/Pacific' },
    ],
    preferredContentTypes: ['tutorials', 'technical deep-dives', 'tool comparisons', 'career advice', 'code snippets', 'thread breakdowns'],
    engagementPatterns: { peakDays: ['Tuesday', 'Wednesday', 'Thursday'], avgSessionMinutes: 12, preferredPlatforms: ['twitter', 'linkedin', 'threads'], contentInteractionRate: 0.034 },
  },
  {
    id: 'persona_startup_founder',
    name: 'Startup Founder',
    demographics: { ageRange: '25-45', gender: 'Mixed', location: 'Global tech hubs (SF, NYC, London, Berlin)', education: "Bachelor's+, often MBA or dropout", income: '$60k-$300k (variable)' },
    interests: ['fundraising', 'product-market fit', 'growth strategies', 'venture capital', 'leadership', 'bootstrapping', 'SaaS metrics'],
    activeHours: [
      { start: 6, end: 8, timezone: 'US/Eastern' },
      { start: 12, end: 13, timezone: 'US/Eastern' },
      { start: 21, end: 23, timezone: 'US/Eastern' },
    ],
    preferredContentTypes: ['founder stories', 'lessons learned', 'metric breakdowns', 'fundraising tips', 'hot takes', 'build-in-public updates'],
    engagementPatterns: { peakDays: ['Monday', 'Tuesday', 'Wednesday'], avgSessionMinutes: 8, preferredPlatforms: ['twitter', 'linkedin'], contentInteractionRate: 0.052 },
  },
  {
    id: 'persona_marketing_manager',
    name: 'Marketing Manager',
    demographics: { ageRange: '26-40', gender: 'Mixed (60% female)', location: 'US/UK/Australia urban areas', education: "Bachelor's in Marketing/Communications", income: '$65k-$120k' },
    interests: ['content strategy', 'SEO', 'social media trends', 'brand building', 'analytics', 'copywriting', 'influencer marketing'],
    activeHours: [
      { start: 8, end: 10, timezone: 'US/Central' },
      { start: 13, end: 14, timezone: 'US/Central' },
      { start: 17, end: 19, timezone: 'US/Central' },
    ],
    preferredContentTypes: ['case studies', 'strategy frameworks', 'trend reports', 'tool reviews', 'engagement tips', 'infographics'],
    engagementPatterns: { peakDays: ['Tuesday', 'Wednesday', 'Thursday'], avgSessionMinutes: 15, preferredPlatforms: ['linkedin', 'threads', 'twitter'], contentInteractionRate: 0.045 },
  },
];

export function getDefaultPersonas(): PersonaProfile[] {
  return DEFAULT_PERSONAS;
}

export function buildPersona(engagementData: {
  ageGroups?: Record<string, number>;
  locations?: Record<string, number>;
  activeHourCounts?: Record<number, number>;
  contentTypeEngagement?: Record<string, number>;
  platformEngagement?: Record<string, number>;
  dayEngagement?: Record<string, number>;
}): PersonaProfile {
  const topEntry = (map: Record<string, number> | undefined) => {
    if (!map) return 'Unknown';
    return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
  };

  const topN = (map: Record<string, number> | undefined, n: number) => {
    if (!map) return [];
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  };

  const topHours = (map: Record<number, number> | undefined, n: number) => {
    if (!map) return [];
    return Object.entries(map).sort((a, b) => Number(b[1]) - Number(a[1])).slice(0, n).map(([h]) => Number(h));
  };

  const hours = topHours(engagementData.activeHourCounts, 3);
  const activeHours = hours.map(h => ({ start: h, end: h + 2, timezone: 'UTC' }));

  return {
    id: `persona_custom_${Date.now()}`,
    name: 'Custom Persona',
    demographics: {
      ageRange: topEntry(engagementData.ageGroups),
      gender: 'Mixed',
      location: topEntry(engagementData.locations),
      education: 'Unknown',
      income: 'Unknown',
    },
    interests: topN(engagementData.contentTypeEngagement, 5),
    activeHours,
    preferredContentTypes: topN(engagementData.contentTypeEngagement, 4),
    engagementPatterns: {
      peakDays: topN(engagementData.dayEngagement, 3),
      avgSessionMinutes: 10,
      preferredPlatforms: topN(engagementData.platformEngagement, 3),
      contentInteractionRate: 0.04,
    },
  };
}
