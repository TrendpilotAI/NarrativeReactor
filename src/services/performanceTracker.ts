import fs from 'fs';
import path from 'path';

export interface PostMetrics {
  likes?: number;
  shares?: number;
  comments?: number;
  impressions?: number;
  clicks?: number;
  engagement?: number;
  [key: string]: number | undefined;
}

export interface PerformanceEntry {
  postId: string;
  platform: string;
  metrics: PostMetrics;
  timestamp: string;
}

export interface PerformanceData {
  entries: PerformanceEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const PERF_FILE = path.join(DATA_DIR, 'performance.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): PerformanceData {
  ensureDataDir();
  if (!fs.existsSync(PERF_FILE)) return { entries: [] };
  try { return JSON.parse(fs.readFileSync(PERF_FILE, 'utf-8')); } catch { return { entries: [] }; }
}

function save(data: PerformanceData): void {
  ensureDataDir();
  fs.writeFileSync(PERF_FILE, JSON.stringify(data, null, 2));
}

export function trackPost(postId: string, platform: string, metrics: PostMetrics): PerformanceEntry {
  const entry: PerformanceEntry = { postId, platform, metrics, timestamp: new Date().toISOString() };
  const data = load();
  data.entries.push(entry);
  save(data);
  return entry;
}

export function getPostPerformance(postId: string): PerformanceEntry[] {
  return load().entries.filter(e => e.postId === postId);
}

function engagementScore(m: PostMetrics): number {
  return (m.likes || 0) + (m.shares || 0) * 2 + (m.comments || 0) * 3 + (m.clicks || 0);
}

export function getBestPerformingContent(days: number): PerformanceEntry[] {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  const recent = load().entries.filter(e => e.timestamp >= cutoff);
  // Group by postId, take latest metrics per post
  const byPost = new Map<string, PerformanceEntry>();
  for (const e of recent) {
    const existing = byPost.get(e.postId);
    if (!existing || e.timestamp > existing.timestamp) byPost.set(e.postId, e);
  }
  return [...byPost.values()].sort((a, b) => engagementScore(b.metrics) - engagementScore(a.metrics));
}

export function getOptimalPostingTimes(platform: string): { hour: number; avgEngagement: number }[] {
  const entries = load().entries.filter(e => e.platform === platform);
  const byHour = new Map<number, { total: number; count: number }>();
  for (const e of entries) {
    const hour = new Date(e.timestamp).getUTCHours();
    const existing = byHour.get(hour) || { total: 0, count: 0 };
    existing.total += engagementScore(e.metrics);
    existing.count++;
    byHour.set(hour, existing);
  }
  return [...byHour.entries()]
    .map(([hour, { total, count }]) => ({ hour, avgEngagement: Math.round((total / count) * 100) / 100 }))
    .sort((a, b) => b.avgEngagement - a.avgEngagement);
}
