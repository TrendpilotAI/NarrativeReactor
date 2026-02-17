/**
 * Audience Persona Builder
 * AI-generated personas from engagement data (demographics, interests, behavior).
 * Extends audiencePersona with richer persona generation.
 */

import { PersonaProfile, getDefaultPersonas, buildPersona } from './audiencePersona';

export interface EngagementSnapshot {
  ageGroups?: Record<string, number>;
  locations?: Record<string, number>;
  activeHourCounts?: Record<number, number>;
  contentTypeEngagement?: Record<string, number>;
  platformEngagement?: Record<string, number>;
  dayEngagement?: Record<string, number>;
  genderSplit?: Record<string, number>;
  interests?: string[];
}

export interface PersonaSummary {
  persona: PersonaProfile;
  insights: string[];
  contentRecommendations: string[];
  bestPlatforms: string[];
}

/**
 * Build an enriched persona with actionable insights.
 */
export function buildEnrichedPersona(data: EngagementSnapshot): PersonaSummary {
  const persona = buildPersona(data);

  // Override name with something more descriptive
  const topAge = topKey(data.ageGroups);
  const topLocation = topKey(data.locations);
  if (topAge !== 'Unknown' || topLocation !== 'Unknown') {
    persona.name = `${topAge} ${topLocation} Audience`.trim();
  }

  if (data.genderSplit) {
    const topGender = topKey(data.genderSplit);
    persona.demographics.gender = topGender;
  }

  if (data.interests && data.interests.length > 0) {
    persona.interests = [...new Set([...data.interests, ...persona.interests])].slice(0, 10);
  }

  const insights = generateInsights(data, persona);
  const contentRecommendations = generateContentRecommendations(persona);

  return {
    persona,
    insights,
    contentRecommendations,
    bestPlatforms: persona.engagementPatterns.preferredPlatforms,
  };
}

/**
 * Match content to the best-fitting default persona.
 */
export function matchPersona(contentTopics: string[]): PersonaProfile {
  const personas = getDefaultPersonas();
  const topicSet = new Set(contentTopics.map(t => t.toLowerCase()));

  let bestMatch = personas[0];
  let bestScore = 0;

  for (const p of personas) {
    let score = 0;
    for (const interest of p.interests) {
      const words = interest.toLowerCase().split(/\s+/);
      for (const w of words) {
        if (topicSet.has(w) || [...topicSet].some(t => t.includes(w))) score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = p;
    }
  }

  return bestMatch;
}

/**
 * Merge multiple engagement snapshots into one.
 */
export function mergeSnapshots(snapshots: EngagementSnapshot[]): EngagementSnapshot {
  const merged: EngagementSnapshot = {};

  for (const snap of snapshots) {
    merged.ageGroups = mergeRecords(merged.ageGroups, snap.ageGroups);
    merged.locations = mergeRecords(merged.locations, snap.locations);
    merged.activeHourCounts = mergeNumericRecords(merged.activeHourCounts, snap.activeHourCounts);
    merged.contentTypeEngagement = mergeRecords(merged.contentTypeEngagement, snap.contentTypeEngagement);
    merged.platformEngagement = mergeRecords(merged.platformEngagement, snap.platformEngagement);
    merged.dayEngagement = mergeRecords(merged.dayEngagement, snap.dayEngagement);
    merged.interests = [...(merged.interests || []), ...(snap.interests || [])];
  }

  if (merged.interests) {
    merged.interests = [...new Set(merged.interests)];
  }

  return merged;
}

// --- Helpers ---

function topKey(map?: Record<string, number>): string {
  if (!map) return 'Unknown';
  return Object.entries(map).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown';
}

function mergeRecords(a?: Record<string, number>, b?: Record<string, number>): Record<string, number> | undefined {
  if (!a && !b) return undefined;
  const result = { ...(a || {}) };
  for (const [k, v] of Object.entries(b || {})) {
    result[k] = (result[k] || 0) + v;
  }
  return result;
}

function mergeNumericRecords(a?: Record<number, number>, b?: Record<number, number>): Record<number, number> | undefined {
  if (!a && !b) return undefined;
  const result = { ...(a || {}) } as Record<number, number>;
  for (const [k, v] of Object.entries(b || {})) {
    const key = Number(k);
    result[key] = (result[key] || 0) + v;
  }
  return result;
}

function generateInsights(data: EngagementSnapshot, persona: PersonaProfile): string[] {
  const insights: string[] = [];
  if (persona.demographics.ageRange !== 'Unknown') {
    insights.push(`Primary audience is ${persona.demographics.ageRange} age group`);
  }
  if (persona.engagementPatterns.peakDays.length > 0) {
    insights.push(`Most active on ${persona.engagementPatterns.peakDays.join(', ')}`);
  }
  if (persona.engagementPatterns.preferredPlatforms.length > 0) {
    insights.push(`Prefers ${persona.engagementPatterns.preferredPlatforms.join(', ')}`);
  }
  if (persona.activeHours.length > 0) {
    insights.push(`Peak activity around ${persona.activeHours[0].start}:00 UTC`);
  }
  return insights;
}

function generateContentRecommendations(persona: PersonaProfile): string[] {
  const recs: string[] = [];
  if (persona.preferredContentTypes.length > 0) {
    recs.push(`Focus on ${persona.preferredContentTypes.slice(0, 3).join(', ')} content`);
  }
  if (persona.engagementPatterns.contentInteractionRate > 0.04) {
    recs.push('High interaction rate — use more CTAs and engagement hooks');
  } else {
    recs.push('Moderate interaction rate — experiment with different content formats');
  }
  if (persona.interests.length > 0) {
    recs.push(`Cover topics: ${persona.interests.slice(0, 4).join(', ')}`);
  }
  return recs;
}

// Re-export
export { getDefaultPersonas, buildPersona } from './audiencePersona';
export type { PersonaProfile } from './audiencePersona';
