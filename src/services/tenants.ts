/**
 * Tenant management service — SQLite-backed multi-tenant API key & quota tracking.
 * Tables: tenants, tenant_usage_log
 *
 * Uses the shared node:sqlite singleton from src/lib/db.ts (NOT better-sqlite3).
 */

import crypto from 'crypto';
import { getDb } from '../lib/db';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Plan = 'starter' | 'pro' | 'enterprise' | 'free';

export interface Tenant {
  id: string;
  name: string;
  email: string;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  api_key_hash: string;
  quota_tokens: number;
  used_tokens: number;
  reset_at: string; // ISO date string — next monthly reset
  active: 1 | 0;
  created_at: string;
  updated_at: string;
}

export interface TenantPublic extends Omit<Tenant, 'api_key_hash'> {
  /** Partial key for display only, e.g. "nr_live_abc...xyz" */
  api_key_preview: string;
}

export interface CreateTenantInput {
  name: string;
  email: string;
  plan?: Plan;
}

// ---------------------------------------------------------------------------
// Plan quotas (tokens per billing period)
// ---------------------------------------------------------------------------

export const PLAN_QUOTAS: Record<Plan, number> = {
  free: 10_000,
  starter: 100_000,
  pro: 500_000,
  enterprise: 10_000_000, // effectively unlimited for most
};

export const PLAN_PRICES_USD: Record<Plan, number> = {
  free: 0,
  starter: 49,
  pro: 149,
  enterprise: 0, // custom / contact sales
};

// ---------------------------------------------------------------------------
// Scrypt configuration
// ---------------------------------------------------------------------------

/** Salt for scrypt key hashing — stable across process restarts via env var */
const SCRYPT_SALT = Buffer.from(process.env.SCRYPT_SALT ?? 'narrativereactor_v2_salt');

// ---------------------------------------------------------------------------
// Schema initialisation (runs once at module load via the shared db singleton)
// ---------------------------------------------------------------------------

function initSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS tenants (
      id                     TEXT PRIMARY KEY,
      name                   TEXT NOT NULL,
      email                  TEXT NOT NULL UNIQUE,
      plan                   TEXT NOT NULL DEFAULT 'free',
      stripe_customer_id     TEXT,
      stripe_subscription_id TEXT,
      api_key_hash           TEXT NOT NULL UNIQUE,
      quota_tokens           INTEGER NOT NULL DEFAULT 10000,
      used_tokens            INTEGER NOT NULL DEFAULT 0,
      reset_at               TEXT NOT NULL,
      active                 INTEGER NOT NULL DEFAULT 1,
      created_at             TEXT NOT NULL,
      updated_at             TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tenants_api_key_hash    ON tenants(api_key_hash);
    CREATE INDEX IF NOT EXISTS idx_tenants_stripe_customer ON tenants(stripe_customer_id);
    CREATE INDEX IF NOT EXISTS idx_tenants_email           ON tenants(email);

    CREATE TABLE IF NOT EXISTS tenant_usage_log (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id   TEXT NOT NULL REFERENCES tenants(id),
      tokens_used INTEGER NOT NULL,
      endpoint    TEXT,
      model       TEXT,
      logged_at   TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_usage_tenant_id ON tenant_usage_log(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logged_at ON tenant_usage_log(logged_at);
  `);
}

// Initialise schema on module load (idempotent — uses CREATE IF NOT EXISTS)
initSchema();

// ---------------------------------------------------------------------------
// Key generation & hashing
// ---------------------------------------------------------------------------

/** Generate a raw API key, e.g. "nr_live_<32 hex chars>" */
export function generateApiKey(): string {
  const raw = crypto.randomBytes(24).toString('hex');
  return `nr_live_${raw}`;
}

/**
 * Hash an API key using scrypt (64-byte output → 128 hex chars).
 * This is the canonical hash used for new keys and post-migration keys.
 */
export function hashApiKey(rawKey: string): string {
  return crypto.scryptSync(rawKey, SCRYPT_SALT, 64).toString('hex');
}

/**
 * Legacy SHA-256 hash (64 hex chars).
 * Used only during the migration window to detect and upgrade old hashes.
 */
function hashApiKeySha256(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

/** Next monthly reset (1st of next month, midnight UTC) */
function nextResetAt(): string {
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return nextMonth.toISOString();
}

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

/**
 * Create a new tenant. Returns the tenant row + the raw API key (shown once).
 */
export function createTenant(input: CreateTenantInput): { tenant: Tenant; rawApiKey: string } {
  const db = getDb();
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const plan: Plan = input.plan ?? 'free';
  const now = new Date().toISOString();

  const tenant: Tenant = {
    id: crypto.randomUUID(),
    name: input.name,
    email: input.email,
    plan,
    stripe_customer_id: null,
    stripe_subscription_id: null,
    api_key_hash: keyHash,
    quota_tokens: PLAN_QUOTAS[plan],
    used_tokens: 0,
    reset_at: nextResetAt(),
    active: 1,
    created_at: now,
    updated_at: now,
  };

  db.prepare(`
    INSERT INTO tenants
      (id, name, email, plan, stripe_customer_id, stripe_subscription_id,
       api_key_hash, quota_tokens, used_tokens, reset_at, active, created_at, updated_at)
    VALUES
      (@id, @name, @email, @plan, @stripe_customer_id, @stripe_subscription_id,
       @api_key_hash, @quota_tokens, @used_tokens, @reset_at, @active, @created_at, @updated_at)
  `).run(tenant as any);

  return { tenant, rawApiKey: rawKey };
}

/**
 * Validate a raw API key. Returns the tenant if valid and active, else null.
 *
 * Migration window behaviour:
 *   - Tries scrypt hash first (128 hex chars)
 *   - If not found, falls back to SHA-256 (64 hex chars) for legacy tenants
 *   - On SHA-256 match: transparently re-hashes to scrypt and updates the DB
 *
 * Also auto-resets used_tokens if past reset_at.
 */
export function validateApiKey(rawKey: string): Tenant | null {
  const db = getDb();

  // 1. Try the new scrypt hash first
  const scryptHash = hashApiKey(rawKey);
  let tenant = db.prepare(
    `SELECT * FROM tenants WHERE api_key_hash = ? AND active = 1`
  ).get(scryptHash) as Tenant | undefined;

  // 2. Legacy fallback: try SHA-256 (migration window)
  if (!tenant) {
    const sha256Hash = hashApiKeySha256(rawKey);
    tenant = db.prepare(
      `SELECT * FROM tenants WHERE api_key_hash = ? AND active = 1`
    ).get(sha256Hash) as Tenant | undefined;

    // Re-hash to scrypt on first auth (transparent migration)
    if (tenant) {
      const now = new Date().toISOString();
      db.prepare(`UPDATE tenants SET api_key_hash = ?, updated_at = ? WHERE id = ?`)
        .run(scryptHash, now, tenant.id);
      tenant.api_key_hash = scryptHash;
    }
  }

  if (!tenant) return null;

  // Auto-reset monthly quota if past reset_at
  if (new Date() > new Date(tenant.reset_at)) {
    const now = new Date().toISOString();
    db.prepare(`UPDATE tenants SET used_tokens = 0, reset_at = ?, updated_at = ? WHERE id = ?`)
      .run(nextResetAt(), now, tenant.id);
    tenant.used_tokens = 0;
    tenant.reset_at = nextResetAt();
  }

  return tenant;
}

/**
 * Check quota: returns true if tenant has remaining quota.
 */
export function checkQuota(tenant: Tenant): boolean {
  return tenant.used_tokens < tenant.quota_tokens;
}

/**
 * Get remaining tokens for a tenant.
 */
export function remainingTokens(tenant: Tenant): number {
  return Math.max(0, tenant.quota_tokens - tenant.used_tokens);
}

/**
 * Increment usage for a tenant. Logs the usage event.
 */
export function incrementUsage(tenantId: string, tokens: number, endpoint?: string, model?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`UPDATE tenants SET used_tokens = used_tokens + ?, updated_at = ? WHERE id = ?`)
    .run(tokens, now, tenantId);
  db.prepare(`INSERT INTO tenant_usage_log (tenant_id, tokens_used, endpoint, model, logged_at) VALUES (?, ?, ?, ?, ?)`)
    .run(tenantId, tokens, endpoint ?? null, model ?? null, now);
}

/**
 * Get tenant by Stripe customer ID.
 */
export function getTenantByStripeCustomer(stripeCustomerId: string): Tenant | null {
  const db = getDb();
  return (db.prepare(`SELECT * FROM tenants WHERE stripe_customer_id = ?`).get(stripeCustomerId) as Tenant | undefined) ?? null;
}

/**
 * Get tenant by Stripe subscription ID.
 */
export function getTenantByStripeSubscription(subscriptionId: string): Tenant | null {
  const db = getDb();
  return (db.prepare(`SELECT * FROM tenants WHERE stripe_subscription_id = ?`).get(subscriptionId) as Tenant | undefined) ?? null;
}

/**
 * Update tenant plan + quota after Stripe payment events.
 */
export function upgradeTenantPlan(tenantId: string, plan: Plan, stripeCustomerId?: string, stripeSubscriptionId?: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE tenants SET
      plan = ?,
      quota_tokens = ?,
      stripe_customer_id = COALESCE(?, stripe_customer_id),
      stripe_subscription_id = COALESCE(?, stripe_subscription_id),
      active = 1,
      updated_at = ?
    WHERE id = ?
  `).run(plan, PLAN_QUOTAS[plan], stripeCustomerId ?? null, stripeSubscriptionId ?? null, now, tenantId);
}

/**
 * Deactivate tenant (e.g., on subscription cancellation).
 */
export function deactivateTenant(tenantId: string): void {
  const db = getDb();
  db.prepare(`UPDATE tenants SET active = 0, updated_at = ? WHERE id = ?`)
    .run(new Date().toISOString(), tenantId);
}

/**
 * Get tenant by ID.
 */
export function getTenantById(id: string): Tenant | null {
  const db = getDb();
  return (db.prepare(`SELECT * FROM tenants WHERE id = ?`).get(id) as Tenant | undefined) ?? null;
}

/**
 * Get all tenants (admin use).
 */
export function listTenants(): Tenant[] {
  const db = getDb();
  return db.prepare(`SELECT * FROM tenants ORDER BY created_at DESC`).all() as unknown as Tenant[];
}

/**
 * Rotate API key for a tenant. Returns the new raw key.
 */
export function rotateApiKey(tenantId: string): string {
  const db = getDb();
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  db.prepare(`UPDATE tenants SET api_key_hash = ?, updated_at = ? WHERE id = ?`)
    .run(keyHash, new Date().toISOString(), tenantId);
  return rawKey;
}

/**
 * Get usage summary for a tenant.
 */
export function getTenantUsageSummary(tenantId: string): { tenant: Tenant | null; usageLog: unknown[] } {
  const db = getDb();
  const tenant = getTenantById(tenantId);
  const usageLog = db.prepare(`SELECT * FROM tenant_usage_log WHERE tenant_id = ? ORDER BY logged_at DESC LIMIT 100`).all(tenantId);
  return { tenant, usageLog };
}
