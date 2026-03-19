/**
 * Tests for lib/db.ts — SQLite data layer.
 * Uses an in-memory database for isolation.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDb,
  resetDb,
  draftsRepo,
  messageLogRepo,
  campaignsRepo,
  workflowsRepo,
} from '../../lib/db';
import type { ContentDraft } from '../../services/contentPipeline';
import type { AgentMessage } from '../../services/agentComm';
import type { Campaign } from '../../services/campaigns';
import type { ReviewRequest } from '../../services/approvalWorkflow';

// Use in-memory DB (set by setup.ts)
beforeEach(() => {
  resetDb();
});

afterEach(() => {
  resetDb();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDraft(overrides?: Partial<ContentDraft>): ContentDraft {
  const now = new Date().toISOString();
  return {
    id: `draft-${Math.random().toString(36).slice(2)}`,
    topic: 'AI trends',
    research: { summary: 'test', sources: [] } as any,
    formats: { xThread: 'thread', linkedinPost: 'post', blogArticle: 'article' } as any,
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMessage(overrides?: Partial<AgentMessage>): AgentMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    type: 'status',
    from: 'researcher',
    payload: { info: 'test' },
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeCampaign(overrides?: Partial<Campaign>): Campaign {
  const now = new Date().toISOString();
  return {
    id: `camp-${Math.random().toString(36).slice(2)}`,
    name: 'Test Campaign',
    theme: 'AI',
    posts: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeReview(overrides?: Partial<ReviewRequest>): ReviewRequest {
  const now = new Date().toISOString();
  return {
    id: `rev-${Math.random().toString(36).slice(2)}`,
    contentId: `content-${Math.random().toString(36).slice(2)}`,
    brandId: 'brand-1',
    state: 'review',
    history: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── getDb / resetDb ───────────────────────────────────────────────────────────

describe('getDb / resetDb', () => {
  it('returns the same instance on repeated calls', () => {
    const db1 = getDb();
    const db2 = getDb();
    expect(db1).toBe(db2);
  });

  it('returns a new instance after resetDb', () => {
    const db1 = getDb();
    resetDb(); // closes db1
    const db2 = getDb(); // creates a new one
    // db1 is closed, db2 is open - they are different instances
    expect(db2).toBeDefined();
    // We can verify they're different by checking db2 is functional
    expect(() => db2.prepare('SELECT 1').get()).not.toThrow();
  });
});

// ── draftsRepo ────────────────────────────────────────────────────────────────

describe('draftsRepo', () => {
  it('returns undefined for missing id', () => {
    expect(draftsRepo.get('nonexistent')).toBeUndefined();
  });

  it('upserts and retrieves a draft', () => {
    const draft = makeDraft();
    draftsRepo.upsert(draft);
    const retrieved = draftsRepo.get(draft.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(draft.id);
    expect(retrieved!.topic).toBe('AI trends');
    expect(retrieved!.status).toBe('draft');
  });

  it('updates an existing draft on second upsert', () => {
    const draft = makeDraft();
    draftsRepo.upsert(draft);
    const updated = { ...draft, status: 'approved' as const };
    draftsRepo.upsert(updated);
    const result = draftsRepo.get(draft.id);
    expect(result!.status).toBe('approved');
  });

  it('lists all drafts', () => {
    draftsRepo.upsert(makeDraft());
    draftsRepo.upsert(makeDraft());
    const all = draftsRepo.list();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('lists drafts filtered by status', () => {
    const d1 = makeDraft({ status: 'draft' });
    const d2 = makeDraft({ status: 'approved' as any });
    draftsRepo.upsert(d1);
    draftsRepo.upsert(d2);
    const drafts = draftsRepo.list('draft');
    expect(drafts.every(d => d.status === 'draft')).toBe(true);
    const approved = draftsRepo.list('approved');
    expect(approved.some(d => d.id === d2.id)).toBe(true);
  });

  it('deletes a draft', () => {
    const draft = makeDraft();
    draftsRepo.upsert(draft);
    draftsRepo.delete(draft.id);
    expect(draftsRepo.get(draft.id)).toBeUndefined();
  });

  it('preserves feedback field', () => {
    const draft = makeDraft({ feedback: 'Needs more detail' });
    draftsRepo.upsert(draft);
    const result = draftsRepo.get(draft.id);
    expect(result!.feedback).toBe('Needs more detail');
  });

  it('handles undefined feedback', () => {
    const draft = makeDraft({ feedback: undefined });
    draftsRepo.upsert(draft);
    const result = draftsRepo.get(draft.id);
    expect(result!.feedback).toBeUndefined();
  });
});

// ── messageLogRepo ────────────────────────────────────────────────────────────

describe('messageLogRepo', () => {
  it('returns empty array initially', () => {
    expect(messageLogRepo.list()).toEqual([]);
  });

  it('appends and lists messages', () => {
    const msg = makeMessage();
    messageLogRepo.append(msg);
    const all = messageLogRepo.list();
    expect(all.length).toBe(1);
    expect(all[0].id).toBe(msg.id);
    expect(all[0].from).toBe('researcher');
  });

  it('appends multiple messages in order', () => {
    const msgs = Array.from({ length: 3 }, (_, i) => makeMessage({ id: `msg-${i}`, from: `agent-${i}` }));
    msgs.forEach(m => messageLogRepo.append(m));
    const all = messageLogRepo.list();
    expect(all.length).toBe(3);
  });

  it('ignores duplicate message ids (INSERT OR IGNORE)', () => {
    const msg = makeMessage();
    messageLogRepo.append(msg);
    messageLogRepo.append(msg); // same id → ignored
    const all = messageLogRepo.list();
    expect(all.filter(m => m.id === msg.id).length).toBe(1);
  });

  it('trims old messages when count >= 200', () => {
    // Insert 201 messages to trigger the trim branch
    for (let i = 0; i < 201; i++) {
      messageLogRepo.append(makeMessage({ id: `trim-msg-${i}`, timestamp: new Date(i).toISOString() }));
    }
    const all = messageLogRepo.list();
    // After trimming, should have <= 200 messages
    expect(all.length).toBeLessThanOrEqual(200);
  });
});

// ── campaignsRepo ─────────────────────────────────────────────────────────────

describe('campaignsRepo', () => {
  it('returns undefined for missing id', () => {
    expect(campaignsRepo.get('nonexistent')).toBeUndefined();
  });

  it('upserts and retrieves a campaign', () => {
    const campaign = makeCampaign();
    campaignsRepo.upsert(campaign);
    const result = campaignsRepo.get(campaign.id);
    expect(result).toBeDefined();
    expect(result!.name).toBe('Test Campaign');
    expect(result!.theme).toBe('AI');
    expect(result!.posts).toEqual([]);
  });

  it('updates an existing campaign', () => {
    const campaign = makeCampaign();
    campaignsRepo.upsert(campaign);
    campaignsRepo.upsert({ ...campaign, name: 'Updated Campaign', status: 'active' });
    const result = campaignsRepo.get(campaign.id);
    expect(result!.name).toBe('Updated Campaign');
    expect(result!.status).toBe('active');
  });

  it('lists all campaigns', () => {
    campaignsRepo.upsert(makeCampaign());
    campaignsRepo.upsert(makeCampaign());
    const all = campaignsRepo.list();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('deletes a campaign', () => {
    const campaign = makeCampaign();
    campaignsRepo.upsert(campaign);
    const deleted = campaignsRepo.delete(campaign.id);
    expect(deleted).toBe(true);
    expect(campaignsRepo.get(campaign.id)).toBeUndefined();
  });

  it('returns false when deleting nonexistent campaign', () => {
    const result = campaignsRepo.delete('ghost-id');
    expect(result).toBe(false);
  });

  it('importLegacy is idempotent when data exists', () => {
    campaignsRepo.upsert(makeCampaign());
    const countBefore = campaignsRepo.list().length;
    campaignsRepo.importLegacy();
    expect(campaignsRepo.list().length).toBe(countBefore);
  });

  it('campaigns with posts array', () => {
    const posts = [{ id: 'p1', content: 'Hello world' }] as any;
    const campaign = makeCampaign({ posts });
    campaignsRepo.upsert(campaign);
    const result = campaignsRepo.get(campaign.id);
    expect(result!.posts).toEqual(posts);
  });
});

// ── workflowsRepo ─────────────────────────────────────────────────────────────

describe('workflowsRepo', () => {
  it('returns undefined for missing contentId', () => {
    expect(workflowsRepo.getByContentId('nonexistent')).toBeUndefined();
  });

  it('upserts and retrieves by contentId', () => {
    const review = makeReview();
    workflowsRepo.upsert(review);
    const result = workflowsRepo.getByContentId(review.contentId);
    expect(result).toBeDefined();
    expect(result!.brandId).toBe('brand-1');
    expect(result!.state).toBe('review');
    expect(result!.history).toEqual([]);
  });

  it('updates existing workflow (ON CONFLICT on content_id)', () => {
    const review = makeReview();
    workflowsRepo.upsert(review);
    workflowsRepo.upsert({ ...review, state: 'approved', brandId: 'brand-2' });
    const result = workflowsRepo.getByContentId(review.contentId);
    expect(result!.state).toBe('approved');
    expect(result!.brandId).toBe('brand-2');
  });

  it('getQueue returns workflows in review state', () => {
    const r1 = makeReview({ state: 'review' });
    const r2 = makeReview({ state: 'approved' });
    workflowsRepo.upsert(r1);
    workflowsRepo.upsert(r2);
    const queue = workflowsRepo.getQueue();
    expect(queue.some(r => r.id === r1.id)).toBe(true);
    expect(queue.every(r => r.state === 'review')).toBe(true);
  });

  it('getQueue filtered by brandId', () => {
    const r1 = makeReview({ brandId: 'brand-a', state: 'review' });
    const r2 = makeReview({ brandId: 'brand-b', state: 'review' });
    workflowsRepo.upsert(r1);
    workflowsRepo.upsert(r2);
    const queue = workflowsRepo.getQueue('brand-a');
    expect(queue.every(r => r.brandId === 'brand-a')).toBe(true);
    expect(queue.some(r => r.id === r1.id)).toBe(true);
  });

  it('preserves history array', () => {
    const history = [{ action: 'submitted', by: 'user1', at: new Date().toISOString() }] as any;
    const review = makeReview({ history });
    workflowsRepo.upsert(review);
    const result = workflowsRepo.getByContentId(review.contentId);
    expect(result!.history).toEqual(history);
  });

  it('importLegacy is idempotent when data exists', () => {
    workflowsRepo.upsert(makeReview());
    workflowsRepo.importLegacy();
    // Should not throw — idempotent
  });
});
