/**
 * Optimal Posting Time Calculator
 * Analyzes engagement patterns and recommends best times per platform per audience.
 * Extends postingOptimizer with audience-aware scheduling.
 */

import { getOptimalTimes, personalizeSchedule, suggestNextPostTime, PostingWindow } from './postingOptimizer';
import { PersonaProfile } from './audiencePersona';

export interface AudienceSchedule {
  persona: string;
  platform: string;
  recommendedSlots: { day: string; hour: number; score: number; reason: string }[];
}

export interface WeeklySchedulePlan {
  platform: string;
  postsPerWeek: number;
  slots: { day: string; hour: number; priority: 'high' | 'medium' | 'low' }[];
}

/**
 * Get audience-aware optimal posting times by cross-referencing
 * platform optimal windows with persona active hours.
 */
export function getAudienceAwareSchedule(platform: string, persona: PersonaProfile): AudienceSchedule {
  const optimal = getOptimalTimes(platform);
  const personaHours = new Set(persona.activeHours.flatMap(ah => {
    const hours: number[] = [];
    for (let h = ah.start; h < ah.end; h++) hours.push(h);
    return hours;
  }));

  const slots: AudienceSchedule['recommendedSlots'] = [];

  for (const window of optimal.windows) {
    for (const hourRange of window.hours) {
      for (let h = hourRange.start; h < hourRange.end; h++) {
        const isPersonaActive = personaHours.has(h);
        const platformScore = window.score;
        const combinedScore = isPersonaActive
          ? Math.min(100, platformScore + 10)
          : Math.max(0, platformScore - 20);

        slots.push({
          day: window.day,
          hour: h,
          score: combinedScore,
          reason: isPersonaActive
            ? `${persona.name} is active and platform engagement is high`
            : `Platform engagement is good but ${persona.name} may not be active`,
        });
      }
    }
  }

  return {
    persona: persona.name,
    platform,
    recommendedSlots: slots.sort((a, b) => b.score - a.score),
  };
}

/**
 * Build a weekly posting plan for a platform given desired frequency.
 */
export function buildWeeklyPlan(platform: string, postsPerWeek: number, timezone: string = 'UTC'): WeeklySchedulePlan {
  const optimal = getOptimalTimes(platform, timezone);

  // Flatten all windows into candidate slots
  const candidates: { day: string; hour: number; score: number }[] = [];
  for (const w of optimal.windows) {
    for (const hr of w.hours) {
      candidates.push({ day: w.day, hour: hr.start, score: w.score });
    }
  }

  // Sort by score descending, pick top N
  candidates.sort((a, b) => b.score - a.score);
  const selected = candidates.slice(0, postsPerWeek);

  return {
    platform,
    postsPerWeek,
    slots: selected.map((s, i) => ({
      day: s.day,
      hour: s.hour,
      priority: i < Math.ceil(postsPerWeek / 3) ? 'high' as const
        : i < Math.ceil((postsPerWeek * 2) / 3) ? 'medium' as const
        : 'low' as const,
    })),
  };
}

/**
 * Analyze historical engagement data and return patterns.
 */
export function analyzeEngagementPatterns(data: { day: string; hour: number; engagement: number }[]): {
  bestDay: string;
  bestHour: number;
  worstDay: string;
  avgEngagement: number;
  personalizedWindows: PostingWindow[];
} {
  if (data.length === 0) {
    return { bestDay: 'N/A', bestHour: 0, worstDay: 'N/A', avgEngagement: 0, personalizedWindows: [] };
  }

  const dayTotals: Record<string, number> = {};
  const hourTotals: Record<number, number> = {};
  let totalEngagement = 0;

  for (const d of data) {
    dayTotals[d.day] = (dayTotals[d.day] || 0) + d.engagement;
    hourTotals[d.hour] = (hourTotals[d.hour] || 0) + d.engagement;
    totalEngagement += d.engagement;
  }

  const sortedDays = Object.entries(dayTotals).sort((a, b) => b[1] - a[1]);
  const sortedHours = Object.entries(hourTotals).sort((a, b) => b[1] - a[1]);

  return {
    bestDay: sortedDays[0]?.[0] || 'N/A',
    bestHour: Number(sortedHours[0]?.[0] || 0),
    worstDay: sortedDays[sortedDays.length - 1]?.[0] || 'N/A',
    avgEngagement: Math.round(totalEngagement / data.length),
    personalizedWindows: personalizeSchedule(data),
  };
}

// Re-export from postingOptimizer for convenience
export { getOptimalTimes, suggestNextPostTime, personalizeSchedule };
