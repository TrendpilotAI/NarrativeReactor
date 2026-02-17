export interface PostingWindow {
  day: string;
  hours: { start: number; end: number }[];
  score: number; // 0-100 effectiveness
}

export interface OptimalTimesResult {
  platform: string;
  timezone: string;
  windows: PostingWindow[];
  bestOverall: { day: string; hour: number };
}

const OPTIMAL_WINDOWS: Record<string, PostingWindow[]> = {
  twitter: [
    { day: 'Monday', hours: [{ start: 9, end: 10 }, { start: 12, end: 13 }], score: 85 },
    { day: 'Tuesday', hours: [{ start: 9, end: 10 }, { start: 12, end: 13 }], score: 90 },
    { day: 'Wednesday', hours: [{ start: 9, end: 10 }, { start: 12, end: 13 }], score: 92 },
    { day: 'Thursday', hours: [{ start: 9, end: 10 }, { start: 12, end: 13 }], score: 88 },
    { day: 'Friday', hours: [{ start: 9, end: 10 }, { start: 12, end: 13 }], score: 80 },
    { day: 'Saturday', hours: [{ start: 10, end: 12 }], score: 55 },
    { day: 'Sunday', hours: [{ start: 10, end: 12 }], score: 50 },
  ],
  linkedin: [
    { day: 'Monday', hours: [{ start: 7, end: 8 }, { start: 12, end: 13 }, { start: 17, end: 18 }], score: 70 },
    { day: 'Tuesday', hours: [{ start: 7, end: 8 }, { start: 12, end: 13 }, { start: 17, end: 18 }], score: 92 },
    { day: 'Wednesday', hours: [{ start: 7, end: 8 }, { start: 12, end: 13 }, { start: 17, end: 18 }], score: 95 },
    { day: 'Thursday', hours: [{ start: 7, end: 8 }, { start: 12, end: 13 }, { start: 17, end: 18 }], score: 90 },
    { day: 'Friday', hours: [{ start: 7, end: 8 }, { start: 12, end: 13 }], score: 65 },
    { day: 'Saturday', hours: [{ start: 10, end: 12 }], score: 30 },
    { day: 'Sunday', hours: [{ start: 10, end: 12 }], score: 25 },
  ],
  threads: [
    { day: 'Monday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 80 },
    { day: 'Tuesday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 82 },
    { day: 'Wednesday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 85 },
    { day: 'Thursday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 83 },
    { day: 'Friday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 78 },
    { day: 'Saturday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 75 },
    { day: 'Sunday', hours: [{ start: 11, end: 13 }, { start: 19, end: 21 }], score: 72 },
  ],
};

const DAY_ORDER = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getOptimalTimes(platform: string, timezone: string = 'UTC'): OptimalTimesResult {
  const key = platform.toLowerCase();
  const windows = OPTIMAL_WINDOWS[key] || OPTIMAL_WINDOWS.twitter!;
  const best = [...windows].sort((a, b) => b.score - a.score)[0];
  return {
    platform: key,
    timezone,
    windows,
    bestOverall: { day: best.day, hour: best.hours[0].start },
  };
}

export function personalizeSchedule(performanceData: { day: string; hour: number; engagement: number }[]): PostingWindow[] {
  if (!performanceData.length) return [];
  const dayMap: Record<string, { totalEngagement: number; hours: Record<number, number> }> = {};
  for (const d of performanceData) {
    if (!dayMap[d.day]) dayMap[d.day] = { totalEngagement: 0, hours: {} };
    dayMap[d.day].totalEngagement += d.engagement;
    dayMap[d.day].hours[d.hour] = (dayMap[d.day].hours[d.hour] || 0) + d.engagement;
  }
  const maxEng = Math.max(...Object.values(dayMap).map(d => d.totalEngagement));
  return Object.entries(dayMap).map(([day, data]) => {
    const sortedHours = Object.entries(data.hours).sort((a, b) => Number(b[1]) - Number(a[1]));
    const topHours = sortedHours.slice(0, 3).map(([h]) => Number(h));
    const hours = topHours.map(h => ({ start: h, end: h + 1 }));
    return { day, hours, score: Math.round((data.totalEngagement / maxEng) * 100) };
  }).sort((a, b) => b.score - a.score);
}

export function suggestNextPostTime(platform: string): { suggestedTime: string; day: string; hour: number } {
  const now = new Date();
  const key = platform.toLowerCase();
  const windows = OPTIMAL_WINDOWS[key] || OPTIMAL_WINDOWS.twitter!;

  const currentDay = now.getUTCDay();
  const currentHour = now.getUTCHours();

  // Check remaining windows today and upcoming days
  for (let offset = 0; offset < 7; offset++) {
    const dayIdx = (currentDay + offset) % 7;
    const dayName = DAY_ORDER[dayIdx];
    const window = windows.find(w => w.day === dayName);
    if (!window) continue;
    for (const h of window.hours) {
      if (offset === 0 && h.start <= currentHour) continue;
      const date = new Date(now);
      date.setUTCDate(date.getUTCDate() + offset);
      date.setUTCHours(h.start, 0, 0, 0);
      return { suggestedTime: date.toISOString(), day: dayName, hour: h.start };
    }
  }

  // Fallback: next Monday 9am
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + ((8 - currentDay) % 7 || 7));
  date.setUTCHours(9, 0, 0, 0);
  return { suggestedTime: date.toISOString(), day: 'Monday', hour: 9 };
}
