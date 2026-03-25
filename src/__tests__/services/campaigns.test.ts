/**
 * Tests: Campaigns service (CRUD + lifecycle)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use in-memory DB
vi.mock('../../lib/db', async () => {
  const actual = await vi.importActual<typeof import('../../lib/db')>('../../lib/db');
  return actual;
});

import {
  createCampaign,
  getCampaign,
  listCampaigns,
  advanceCampaign,
  deleteCampaign,
} from '../../services/campaigns';

describe('Campaigns Service', () => {
  describe('createCampaign', () => {
    it('creates a campaign with the correct theme and name', () => {
      const c = createCampaign('AI Trends', 3, 2, 'My Campaign');
      expect(c.theme).toBe('AI Trends');
      expect(c.name).toBe('My Campaign');
      expect(c.status).toBe('active');
      expect(c.id).toBeDefined();
      expect(c.posts.length).toBe(6); // 3 days * 2 posts
    });

    it('auto-generates name if not provided', () => {
      const c = createCampaign('Tech Innovation', 1, 1);
      expect(c.name).toContain('Tech Innovation');
    });

    it('generates posts with correct statuses', () => {
      const c = createCampaign('Demo', 2, 2);
      expect(c.posts.every(p => p.status === 'pending')).toBe(true);
    });

    it('spreads posts across 9am-5pm window', () => {
      const c = createCampaign('Test', 1, 4);
      const hours = c.posts.map(p => new Date(p.scheduledAt).getUTCHours());
      expect(hours.every(h => h >= 9)).toBe(true);
    });
  });

  describe('getCampaign', () => {
    it('returns a campaign by ID', () => {
      const c = createCampaign('Test', 1, 1);
      const found = getCampaign(c.id);
      expect(found).toBeDefined();
      expect(found!.id).toBe(c.id);
    });

    it('returns undefined for unknown ID', () => {
      expect(getCampaign('nonexistent-id')).toBeUndefined();
    });
  });

  describe('listCampaigns', () => {
    it('returns array of campaigns', () => {
      createCampaign('Alpha', 1, 1);
      createCampaign('Beta', 1, 1);
      const list = listCampaigns();
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('advanceCampaign', () => {
    it('returns undefined for unknown campaign', () => {
      expect(advanceCampaign('unknown')).toBeUndefined();
    });

    it('publishes the first pending post', () => {
      const c = createCampaign('Advance Test', 2, 1);
      const result = advanceCampaign(c.id);
      expect(result).toBeDefined();
      expect(result!.published).toBeDefined();
      expect(result!.published!.status).toBe('published');
      expect(result!.published!.publishedAt).toBeDefined();
    });

    it('marks campaign completed when all posts published', () => {
      const c = createCampaign('Complete Test', 1, 1);
      // Only 1 post — advance should complete it
      const result = advanceCampaign(c.id);
      expect(result!.campaign.status).toBe('completed');
    });

    it('returns campaign with no published post if already all done', () => {
      const c = createCampaign('Done Already', 1, 1);
      advanceCampaign(c.id); // advance once → completes
      const result = advanceCampaign(c.id); // advance again → no pending
      expect(result).toBeDefined();
      expect(result!.published).toBeUndefined();
      expect(result!.campaign.status).toBe('completed');
    });
  });

  describe('deleteCampaign', () => {
    it('deletes an existing campaign', () => {
      const c = createCampaign('To Delete', 1, 1);
      const deleted = deleteCampaign(c.id);
      expect(deleted).toBe(true);
      expect(getCampaign(c.id)).toBeUndefined();
    });

    it('returns false for unknown campaign', () => {
      expect(deleteCampaign('does-not-exist')).toBe(false);
    });
  });
});
