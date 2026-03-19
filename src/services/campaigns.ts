import { randomUUID } from 'crypto';
import dayjs from 'dayjs';
import { campaignsRepo } from '../lib/db';

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

// Run one-time import of legacy JSON data on first load
campaignsRepo.importLegacy();

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

  campaignsRepo.upsert(campaign);
  return campaign;
}

export function getCampaign(id: string): Campaign | undefined {
  return campaignsRepo.get(id);
}

export function listCampaigns(): Campaign[] {
  return campaignsRepo.list();
}

export function advanceCampaign(id: string): { campaign: Campaign; published?: ScheduledPost } | undefined {
  const campaign = campaignsRepo.get(id);
  if (!campaign) return undefined;

  const nextPost = campaign.posts.find(p => p.status === 'pending');
  if (!nextPost) {
    campaign.status = 'completed';
    campaign.updatedAt = new Date().toISOString();
    campaignsRepo.upsert(campaign);
    return { campaign };
  }

  nextPost.status = 'published';
  nextPost.publishedAt = new Date().toISOString();
  campaign.updatedAt = new Date().toISOString();

  // Check if all done
  if (campaign.posts.every(p => p.status !== 'pending')) {
    campaign.status = 'completed';
  }

  campaignsRepo.upsert(campaign);
  return { campaign, published: nextPost };
}

export function deleteCampaign(id: string): boolean {
  return campaignsRepo.delete(id);
}
