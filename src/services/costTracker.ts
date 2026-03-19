import fs from 'fs';
import path from 'path';

export interface CostEntry {
  type: 'image' | 'video' | 'claude' | 'other';
  amount: number;
  model?: string;
  timestamp: string;
  description?: string;
}

export interface CostData {
  entries: CostEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const COSTS_FILE = path.join(DATA_DIR, 'costs.json');

// Default cost estimates
export const DEFAULT_COSTS: Record<string, number> = {
  'fal-image': parseFloat(process.env.COST_FAL_IMAGE || '0.01'),
  'fal-video': parseFloat(process.env.COST_FAL_VIDEO || '0.10'),
  'claude-call': parseFloat(process.env.COST_CLAUDE_CALL || '0.03'),
};

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadCosts(): CostData {
  ensureDataDir();
  if (!fs.existsSync(COSTS_FILE)) {
    return { entries: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(COSTS_FILE, 'utf-8'));
  } catch {
    return { entries: [] };
  }
}

export function saveCosts(data: CostData): void {
  ensureDataDir();
  fs.writeFileSync(COSTS_FILE, JSON.stringify(data, null, 2));
}

export function trackCost(entry: Omit<CostEntry, 'timestamp'>): CostEntry {
  const fullEntry: CostEntry = { ...entry, timestamp: new Date().toISOString() };
  const data = loadCosts();
  data.entries.push(fullEntry);
  saveCosts(data);
  return fullEntry;
}

export function getCostSummary(): {
  total: number;
  byType: Record<string, number>;
  byDay: Record<string, number>;
  recentEntries: CostEntry[];
} {
  const data = loadCosts();
  const byType: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  let total = 0;

  for (const entry of data.entries) {
    total += entry.amount;
    byType[entry.type] = (byType[entry.type] || 0) + entry.amount;
    const day = entry.timestamp.slice(0, 10);
    byDay[day] = (byDay[day] || 0) + entry.amount;
  }

  return {
    total: Math.round(total * 1000) / 1000,
    byType,
    byDay,
    recentEntries: data.entries.slice(-50),
  };
}
