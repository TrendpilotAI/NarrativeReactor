import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import dayjs from 'dayjs';

export interface ScheduledPost {
  id: string;
  content: string;
  platform: string;
  scheduledAt: string;
  status: 'pending' | 'published' | 'failed';
  publishedAt?: string;
}

export interface Campaign {
  id: string;
  name: string;
  theme: string;
  posts: ScheduledPost[];
  status: 'draft' | 'active' | 'completed' | 'paused';
  createdAt: string;
  updatedAt: string;
}

interface CampaignStore {
  campaigns: Campaign[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const CAMPAIGNS_FILE = path.join(DATA_DIR, 'campaigns.json');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function load(): CampaignStore {
  ensureDataDir();
  if (!fs.existsSync(CAMPAIGNS_FILE)) return { campaigns: [] };
  try { return JSON.parse(fs.readFileSync(CAMPAIGNS_FILE, 'utf-8')); } catch { return { campaigns: [] }; }
}

function save(data: CampaignStore): void {
  ensureDataDir();
  fs.writeFileSync(CAMPAIGNS_FILE, JSON.stringify(data, null, 2));
}

// --- CRUD ---

export function createCampaign(theme: string, days: number, postsPerDay: number, name?: string): Campaign {
  const now = dayjs();
  const posts: ScheduledPost[] = [];

  for (let d = 0; d < days; d++) {
    for (let p = 0; p < postsPerDay; p++) {
      const hour = 9 + Math.floor((p * 8) / postsPerDay); // spread posts 9am-5pm
      const scheduledAt = now.add(d, 'day').hour(hour).minute(0).second(0).toISOString();
      posts.push({
        id: randomUUID(),
        content: `[Day ${d + 1}, Post ${p + 1}] ${theme} — content to be generated`,
        platform: 'twitter',
        scheduledAt,
        status: 'pending',
      });
    }
  }

  const campaign: Campaign = {
    id: randomUUID(),
    name: name || `${theme} Campaign`,
    theme,
    posts,
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const store = load();
  store.campaigns.push(campaign);
  save(store);
  return campaign;
}

export function getCampaign(id: string): Campaign | undefined {
  return load().campaigns.find(c => c.id === id);
}

export function listCampaigns(): Campaign[] {
  return load().campaigns;
}

export function advanceCampaign(id: string): { campaign: Campaign; published?: ScheduledPost } | undefined {
  const store = load();
  const campaign = store.campaigns.find(c => c.id === id);
  if (!campaign) return undefined;

  const nextPost = campaign.posts.find(p => p.status === 'pending');
  if (!nextPost) {
    campaign.status = 'completed';
    campaign.updatedAt = new Date().toISOString();
    save(store);
    return { campaign };
  }

  nextPost.status = 'published';
  nextPost.publishedAt = new Date().toISOString();
  campaign.updatedAt = new Date().toISOString();

  // Check if all done
  if (campaign.posts.every(p => p.status !== 'pending')) {
    campaign.status = 'completed';
  }

  save(store);
  return { campaign, published: nextPost };
}

export function deleteCampaign(id: string): boolean {
  const store = load();
  const idx = store.campaigns.findIndex(c => c.id === id);
  if (idx === -1) return false;
  store.campaigns.splice(idx, 1);
  save(store);
  return true;
}
