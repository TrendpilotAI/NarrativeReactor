/**
 * Persistent Database Layer — NarrativeReactor
 *
 * Uses Node.js built-in `node:sqlite` (available in Node 22+).
 * All state that was previously in-memory Maps/arrays is stored here,
 * surviving process restarts.
 *
 * Usage:
 *   import { draftsRepo, messageLogRepo, campaignsRepo, workflowsRepo } from './db';
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';

// ── Database location ──────────────────────────────────────────────────────────

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'narrative.db');

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

// ── Singleton DB connection ────────────────────────────────────────────────────

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  ensureDataDir();
  _db = new DatabaseSync(DB_PATH);
  // Enable WAL mode for better concurrent read performance
  _db.exec('PRAGMA journal_mode=WAL');
  _db.exec('PRAGMA foreign_keys=ON');
  runMigrations(_db);
  return _db;
}

/** Close and discard the singleton so the next getDb() creates a fresh instance. */
export function resetDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

// ── Migration system ──────────────────────────────────────────────────────────

const MIGRATIONS: Array<{ version: number; up: string }> = [
  {
    version: 1,
    up: `
      CREATE TABLE IF NOT EXISTS schema_versions (
        version  INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      -- Content drafts (was: in-memory Map in contentPipeline.ts)
      CREATE TABLE IF NOT EXISTS content_drafts (
        id          TEXT PRIMARY KEY,
        topic       TEXT NOT NULL,
        research    TEXT NOT NULL,  -- JSON
        formats     TEXT NOT NULL,  -- JSON {xThread, linkedinPost, blogArticle}
        status      TEXT NOT NULL DEFAULT 'draft',
        feedback    TEXT,
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      -- Agent message log (was: in-memory array in agentComm.ts)
      CREATE TABLE IF NOT EXISTS agent_messages (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        from_agent  TEXT NOT NULL,
        payload     TEXT NOT NULL,  -- full JSON of the message
        timestamp   TEXT NOT NULL
      );

      -- Campaigns (migrate from data/campaigns.json → SQLite)
      CREATE TABLE IF NOT EXISTS campaigns (
        id          TEXT PRIMARY KEY,
        name        TEXT NOT NULL,
        theme       TEXT NOT NULL,
        posts       TEXT NOT NULL,  -- JSON array of ScheduledPost
        status      TEXT NOT NULL DEFAULT 'draft',
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );

      -- Approval workflows (migrate from data/workflows.json → SQLite)
      CREATE TABLE IF NOT EXISTS workflows (
        id          TEXT PRIMARY KEY,
        content_id  TEXT NOT NULL UNIQUE,
        brand_id    TEXT NOT NULL,
        state       TEXT NOT NULL DEFAULT 'draft',
        history     TEXT NOT NULL,  -- JSON array of WorkflowHistoryEntry
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    up: `
      -- Performance indexes for frequently queried columns (NR-009)
      -- Note: idx_tenants_api_key_hash already created in tenants.ts initTenantsDb()

      -- Index on content_drafts.status for efficient status filtering
      CREATE INDEX IF NOT EXISTS idx_content_drafts_status ON content_drafts(status);

      -- Add tenant_id to content_drafts for multi-tenant scoping
      ALTER TABLE content_drafts ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_content_drafts_tenant_id ON content_drafts(tenant_id);

      -- Add tenant_id to campaigns for multi-tenant scoping
      ALTER TABLE campaigns ADD COLUMN tenant_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_campaigns_tenant_id ON campaigns(tenant_id);

      -- Scheduled posts table (platform-level post scheduling)
      CREATE TABLE IF NOT EXISTS scheduled_posts (
        id           TEXT PRIMARY KEY,
        tenant_id    TEXT,
        draft_id     TEXT,
        platform     TEXT NOT NULL,
        scheduled_at TEXT NOT NULL,
        status       TEXT NOT NULL DEFAULT 'pending',
        payload      TEXT,
        created_at   TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_at ON scheduled_posts(scheduled_at);
      CREATE INDEX IF NOT EXISTS idx_scheduled_posts_tenant_id    ON scheduled_posts(tenant_id);
    `,
  },
];

function runMigrations(db: DatabaseSync): void {
  // Ensure the versions table exists first so we can query it
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_versions (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const applied = new Set<number>(
    (db.prepare('SELECT version FROM schema_versions').all() as Array<{ version: number }>)
      .map(r => r.version),
  );

  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.exec(migration.up);
    db.prepare('INSERT OR IGNORE INTO schema_versions (version) VALUES (?)').run(migration.version);
    console.log(`[db] Migration ${migration.version} applied`);
  }
}

// ── Helper: import legacy JSON files ─────────────────────────────────────────

function importLegacyJson<T>(filePath: string, defaultValue: T): T {
  if (!fs.existsSync(filePath)) return defaultValue;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return defaultValue;
  }
}

// ── Drafts Repository ─────────────────────────────────────────────────────────

import type { ContentDraft } from '../services/contentPipeline';

export const draftsRepo = {
  get(id: string): ContentDraft | undefined {
    const db = getDb();
    const row = db.prepare('SELECT * FROM content_drafts WHERE id = ?').get(id) as any;
    return row ? rowToDraft(row) : undefined;
  },

  list(status?: string): ContentDraft[] {
    const db = getDb();
    const rows = status
      ? (db.prepare('SELECT * FROM content_drafts WHERE status = ? ORDER BY created_at DESC').all(status) as any[])
      : (db.prepare('SELECT * FROM content_drafts ORDER BY created_at DESC').all() as any[]);
    return rows.map(rowToDraft);
  },

  upsert(draft: ContentDraft): void {
    const db = getDb();
    db.prepare(`
      INSERT INTO content_drafts (id, topic, research, formats, status, feedback, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        topic = excluded.topic,
        research = excluded.research,
        formats = excluded.formats,
        status = excluded.status,
        feedback = excluded.feedback,
        updated_at = excluded.updated_at
    `).run(
      draft.id,
      draft.topic,
      JSON.stringify(draft.research),
      JSON.stringify(draft.formats),
      draft.status,
      draft.feedback ?? null,
      draft.createdAt,
      draft.updatedAt,
    );
  },

  delete(id: string): void {
    getDb().prepare('DELETE FROM content_drafts WHERE id = ?').run(id);
  },
};

function rowToDraft(row: any): ContentDraft {
  return {
    id: row.id,
    topic: row.topic,
    research: JSON.parse(row.research),
    formats: JSON.parse(row.formats),
    status: row.status,
    feedback: row.feedback ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Message Log Repository ────────────────────────────────────────────────────

import type { AgentMessage } from '../services/agentComm';

export const messageLogRepo = {
  append(message: AgentMessage): void {
    const db = getDb();
    // Keep only last 200 messages
    const count = (db.prepare('SELECT COUNT(*) as c FROM agent_messages').get() as any).c as number;
    if (count >= 200) {
      db.prepare(`
        DELETE FROM agent_messages WHERE id IN (
          SELECT id FROM agent_messages ORDER BY timestamp ASC LIMIT ?
        )
      `).run(count - 199);
    }
    db.prepare(`
      INSERT OR IGNORE INTO agent_messages (id, type, from_agent, payload, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run(message.id, message.type, message.from, JSON.stringify(message), message.timestamp);
  },

  list(): AgentMessage[] {
    const rows = getDb().prepare('SELECT payload FROM agent_messages ORDER BY timestamp ASC').all() as any[];
    return rows.map(r => JSON.parse(r.payload) as AgentMessage);
  },
};

// ── Campaigns Repository ──────────────────────────────────────────────────────

import type { Campaign } from '../services/campaigns';

export const campaignsRepo = {
  /** One-time import from legacy JSON file */
  importLegacy(): void {
    const db = getDb();
    const existing = (db.prepare('SELECT COUNT(*) as c FROM campaigns').get() as any).c as number;
    if (existing > 0) return; // already migrated

    const legacyPath = path.join(DATA_DIR, 'campaigns.json');
    const legacy = importLegacyJson<{ campaigns: Campaign[] }>(legacyPath, { campaigns: [] });
    for (const c of legacy.campaigns) {
      this.upsert(c);
    }
    if (legacy.campaigns.length > 0) {
      console.log(`[db] Imported ${legacy.campaigns.length} campaigns from legacy JSON`);
    }
  },

  get(id: string): Campaign | undefined {
    const row = getDb().prepare('SELECT * FROM campaigns WHERE id = ?').get(id) as any;
    return row ? rowToCampaign(row) : undefined;
  },

  list(): Campaign[] {
    return (getDb().prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all() as any[]).map(rowToCampaign);
  },

  upsert(campaign: Campaign): void {
    getDb().prepare(`
      INSERT INTO campaigns (id, name, theme, posts, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        theme = excluded.theme,
        posts = excluded.posts,
        status = excluded.status,
        updated_at = excluded.updated_at
    `).run(
      campaign.id,
      campaign.name,
      campaign.theme,
      JSON.stringify(campaign.posts),
      campaign.status,
      campaign.createdAt,
      campaign.updatedAt,
    );
  },

  delete(id: string): boolean {
    const result = getDb().prepare('DELETE FROM campaigns WHERE id = ?').run(id);
    return (result as any).changes > 0;
  },
};

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    theme: row.theme,
    posts: JSON.parse(row.posts),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Workflows Repository ──────────────────────────────────────────────────────

import type { ReviewRequest } from '../services/approvalWorkflow';

export const workflowsRepo = {
  /** One-time import from legacy JSON file */
  importLegacy(): void {
    const db = getDb();
    const existing = (db.prepare('SELECT COUNT(*) as c FROM workflows').get() as any).c as number;
    if (existing > 0) return;

    const legacyPath = path.join(DATA_DIR, 'workflows.json');
    const legacy = importLegacyJson<{ reviews: ReviewRequest[] }>(legacyPath, { reviews: [] });
    for (const r of legacy.reviews) {
      this.upsert(r);
    }
    if (legacy.reviews.length > 0) {
      console.log(`[db] Imported ${legacy.reviews.length} workflows from legacy JSON`);
    }
  },

  getByContentId(contentId: string): ReviewRequest | undefined {
    const row = getDb().prepare('SELECT * FROM workflows WHERE content_id = ?').get(contentId) as any;
    return row ? rowToWorkflow(row) : undefined;
  },

  getQueue(brandId?: string): ReviewRequest[] {
    const rows = brandId
      ? (getDb().prepare("SELECT * FROM workflows WHERE state = 'review' AND brand_id = ?").all(brandId) as any[])
      : (getDb().prepare("SELECT * FROM workflows WHERE state = 'review'").all() as any[]);
    return rows.map(rowToWorkflow);
  },

  upsert(review: ReviewRequest): void {
    getDb().prepare(`
      INSERT INTO workflows (id, content_id, brand_id, state, history, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(content_id) DO UPDATE SET
        brand_id = excluded.brand_id,
        state = excluded.state,
        history = excluded.history,
        updated_at = excluded.updated_at
    `).run(
      review.id,
      review.contentId,
      review.brandId,
      review.state,
      JSON.stringify(review.history),
      review.createdAt,
      review.updatedAt,
    );
  },
};

function rowToWorkflow(row: any): ReviewRequest {
  return {
    id: row.id,
    contentId: row.content_id,
    brandId: row.brand_id,
    state: row.state,
    history: JSON.parse(row.history),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
