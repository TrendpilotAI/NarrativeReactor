import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface ContentMetadata {
  type?: string;
  platform?: string;
  tags?: string[];
  title?: string;
  [key: string]: any;
}

export interface ContentEntry {
  id: string;
  content: string;
  metadata: ContentMetadata;
  createdAt: string;
}

export interface ContentLibraryData {
  entries: ContentEntry[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const LIB_FILE = path.join(DATA_DIR, 'content-library.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): ContentLibraryData {
  ensureDataDir();
  if (!fs.existsSync(LIB_FILE)) return { entries: [] };
  try { return JSON.parse(fs.readFileSync(LIB_FILE, 'utf-8')); } catch { return { entries: [] }; }
}

function save(data: ContentLibraryData): void {
  ensureDataDir();
  fs.writeFileSync(LIB_FILE, JSON.stringify(data, null, 2));
}

export function saveContent(content: string, metadata: ContentMetadata = {}): ContentEntry {
  const entry: ContentEntry = { id: randomUUID(), content, metadata, createdAt: new Date().toISOString() };
  const data = load();
  data.entries.push(entry);
  save(data);
  return entry;
}

export function searchContent(query: string): ContentEntry[] {
  const q = query.toLowerCase();
  return load().entries.filter(e =>
    e.content.toLowerCase().includes(q) ||
    (e.metadata.title || '').toLowerCase().includes(q) ||
    (e.metadata.tags || []).some(t => t.toLowerCase().includes(q))
  );
}

export function getContentByTag(tag: string): ContentEntry[] {
  const t = tag.toLowerCase();
  return load().entries.filter(e => (e.metadata.tags || []).some(et => et.toLowerCase() === t));
}

export function getContentStats(): { total: number; byType: Record<string, number>; byPlatform: Record<string, number> } {
  const entries = load().entries;
  const byType: Record<string, number> = {};
  const byPlatform: Record<string, number> = {};
  for (const e of entries) {
    const type = e.metadata.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
    const platform = e.metadata.platform || 'unknown';
    byPlatform[platform] = (byPlatform[platform] || 0) + 1;
  }
  return { total: entries.length, byType, byPlatform };
}

export function getContentById(id: string): ContentEntry | undefined {
  return load().entries.find(e => e.id === id);
}
