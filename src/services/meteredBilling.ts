/**
 * Stripe Metered Billing Reporting — NR-002
 *
 * Handles:
 *   - Reporting token usage to Stripe (via subscriptionItems.createUsageRecord)
 *   - Processing invoice.upcoming webhooks to finalize usage before invoicing
 *   - Daily sync of usage records to Stripe (called from cron endpoint)
 */

import Stripe from 'stripe';
import { getDb } from '../lib/db';
import { getTenantByStripeSubscription, Tenant } from './tenants';

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

// ---------------------------------------------------------------------------
// Schema: metered_billing_sync log
// ---------------------------------------------------------------------------

export function initMeteredBillingSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS metered_billing_sync (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id       TEXT NOT NULL,
      subscription_item_id TEXT NOT NULL,
      tokens_reported INTEGER NOT NULL,
      stripe_usage_record_id TEXT,
      sync_type       TEXT NOT NULL DEFAULT 'daily',  -- 'daily' | 'invoice_upcoming'
      period_start    TEXT,
      period_end      TEXT,
      synced_at       TEXT NOT NULL DEFAULT (datetime('now')),
      error           TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_metered_billing_tenant   ON metered_billing_sync(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_metered_billing_synced_at ON metered_billing_sync(synced_at);
  `);
}

// Run schema init immediately on module load
initMeteredBillingSchema();

// ---------------------------------------------------------------------------
// Core: report usage to Stripe for a specific tenant + subscription item
// ---------------------------------------------------------------------------

export interface UsageReportResult {
  tenantId: string;
  subscriptionItemId: string;
  tokensReported: number;
  stripeRecordId?: string;
  error?: string;
  skipped?: boolean;
}

/**
 * Report token usage for a tenant to Stripe metered billing.
 *
 * Uses `action: 'set'` so we can idempotently overwrite with current cumulative usage.
 * Alternatively, set action to 'increment' for delta reporting.
 */
export async function reportTenantUsageToStripe(
  tenant: Tenant,
  subscriptionItemId: string,
  syncType: 'daily' | 'invoice_upcoming' = 'daily',
  periodStart?: Date,
  periodEnd?: Date,
): Promise<UsageReportResult> {
  const stripe = getStripe();
  const tokensUsed = tenant.used_tokens;

  if (tokensUsed === 0) {
    logSync(tenant.id, subscriptionItemId, 0, undefined, syncType, periodStart, periodEnd);
    return {
      tenantId: tenant.id,
      subscriptionItemId,
      tokensReported: 0,
      skipped: true,
    };
  }

  try {
    // Use Stripe Usage Records API: report cumulative tokens for billing period
    const usageRecord = await (stripe.subscriptionItems as any).createUsageRecord(
      subscriptionItemId,
      {
        quantity: tokensUsed,
        timestamp: Math.floor(Date.now() / 1000),
        action: 'set', // Set (not increment) to avoid double-counting on re-runs
      },
    );

    logSync(tenant.id, subscriptionItemId, tokensUsed, usageRecord.id, syncType, periodStart, periodEnd);
    console.log(`[metered-billing] Reported ${tokensUsed} tokens for tenant ${tenant.id} → record ${usageRecord.id}`);

    return {
      tenantId: tenant.id,
      subscriptionItemId,
      tokensReported: tokensUsed,
      stripeRecordId: usageRecord.id,
    };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logSync(tenant.id, subscriptionItemId, tokensUsed, undefined, syncType, periodStart, periodEnd, errMsg);
    console.error(`[metered-billing] Failed to report usage for tenant ${tenant.id}: ${errMsg}`);
    return {
      tenantId: tenant.id,
      subscriptionItemId,
      tokensReported: tokensUsed,
      error: errMsg,
    };
  }
}

// ---------------------------------------------------------------------------
// Get the first metered subscription item for a subscription
// ---------------------------------------------------------------------------

async function getMeteredSubscriptionItemId(subscriptionId: string): Promise<string | null> {
  const stripe = getStripe();
  try {
    const sub = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price'],
    });

    for (const item of sub.items.data) {
      const price = item.price as Stripe.Price;
      // Check if this is a metered/usage-based price
      if (price.recurring?.usage_type === 'metered') {
        return item.id;
      }
    }

    // If no metered price found, return the first item (flat-rate plans may still want tracking)
    if (sub.items.data.length > 0) {
      return sub.items.data[0].id;
    }

    return null;
  } catch (err) {
    console.error(`[metered-billing] Cannot retrieve subscription ${subscriptionId}: ${err}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// invoice.upcoming webhook handler — finalize usage before Stripe invoices
// ---------------------------------------------------------------------------

export interface InvoiceUpcomingResult {
  handled: boolean;
  tenantId?: string;
  tokensReported?: number;
  error?: string;
}

/**
 * Called when Stripe sends `invoice.upcoming` — finalize usage before invoicing.
 * This gives us a chance to tally token usage and submit the final usage record.
 */
export async function handleInvoiceUpcoming(invoice: Stripe.UpcomingInvoice): Promise<InvoiceUpcomingResult> {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : (invoice.customer as Stripe.Customer)?.id;
  const subscriptionId = typeof (invoice as any).subscription === 'string' ? (invoice as any).subscription : ((invoice as any).subscription as Stripe.Subscription)?.id;

  if (!subscriptionId) {
    console.warn('[metered-billing] invoice.upcoming has no subscription_id — skipping');
    return { handled: false, error: 'no subscription_id' };
  }

  // Find tenant by subscription ID
  const tenant = getTenantByStripeSubscription(subscriptionId);
  if (!tenant) {
    console.warn(`[metered-billing] invoice.upcoming: no tenant for subscription ${subscriptionId} (customer=${customerId})`);
    return { handled: false, error: `no tenant for subscription ${subscriptionId}` };
  }

  // Get the subscription item ID for metered billing
  const subscriptionItemId = await getMeteredSubscriptionItemId(subscriptionId);
  if (!subscriptionItemId) {
    console.warn(`[metered-billing] No subscription item found for sub ${subscriptionId}`);
    return { handled: false, tenantId: tenant.id, error: 'no subscription item found' };
  }

  // Tally the period usage from the usage log
  const periodTokens = getTenantPeriodTokens(tenant.id, invoice.period_start, invoice.period_end);
  console.log(
    `[metered-billing] invoice.upcoming for tenant ${tenant.id}: ${periodTokens} tokens this period` +
    ` (period: ${new Date(invoice.period_start * 1000).toISOString()} → ${new Date(invoice.period_end * 1000).toISOString()})`,
  );

  // Override with period-specific count for accuracy
  const result = await reportPeriodUsageToStripe(
    tenant,
    subscriptionItemId,
    periodTokens,
    'invoice_upcoming',
    new Date(invoice.period_start * 1000),
    new Date(invoice.period_end * 1000),
  );

  return {
    handled: true,
    tenantId: tenant.id,
    tokensReported: result.tokensReported,
    error: result.error,
  };
}

/**
 * Sum token usage from tenant_usage_log for a specific billing period.
 */
function getTenantPeriodTokens(tenantId: string, periodStartUnix: number, periodEndUnix: number): number {
  const db = getDb();
  const periodStart = new Date(periodStartUnix * 1000).toISOString();
  const periodEnd = new Date(periodEndUnix * 1000).toISOString();

  const row = db.prepare(`
    SELECT COALESCE(SUM(tokens_used), 0) as total
    FROM tenant_usage_log
    WHERE tenant_id = ?
      AND logged_at >= ?
      AND logged_at <= ?
  `).get(tenantId, periodStart, periodEnd) as { total: number };

  return row?.total ?? 0;
}

/**
 * Report a specific token count (period-specific) to Stripe.
 */
async function reportPeriodUsageToStripe(
  tenant: Tenant,
  subscriptionItemId: string,
  tokens: number,
  syncType: 'daily' | 'invoice_upcoming',
  periodStart?: Date,
  periodEnd?: Date,
): Promise<UsageReportResult> {
  if (tokens === 0) {
    logSync(tenant.id, subscriptionItemId, 0, undefined, syncType, periodStart, periodEnd);
    return { tenantId: tenant.id, subscriptionItemId, tokensReported: 0, skipped: true };
  }

  const stripe = getStripe();
  try {
    const timestamp = periodEnd ? Math.floor(periodEnd.getTime() / 1000) : Math.floor(Date.now() / 1000);
    const usageRecord = await (stripe.subscriptionItems as any).createUsageRecord(subscriptionItemId, {
      quantity: tokens,
      timestamp,
      action: 'set',
    });

    logSync(tenant.id, subscriptionItemId, tokens, usageRecord.id, syncType, periodStart, periodEnd);
    console.log(`[metered-billing] Period usage: ${tokens} tokens for tenant ${tenant.id} → record ${usageRecord.id}`);
    return { tenantId: tenant.id, subscriptionItemId, tokensReported: tokens, stripeRecordId: usageRecord.id };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    logSync(tenant.id, subscriptionItemId, tokens, undefined, syncType, periodStart, periodEnd, errMsg);
    return { tenantId: tenant.id, subscriptionItemId, tokensReported: tokens, error: errMsg };
  }
}

// ---------------------------------------------------------------------------
// Daily sync — sync all active paid tenants' usage to Stripe
// ---------------------------------------------------------------------------

export interface DailySyncResult {
  synced: number;
  skipped: number;
  errors: number;
  results: UsageReportResult[];
}

/**
 * Sync usage records to Stripe for all active paid tenants.
 * Called by the daily cron endpoint: POST /api/billing/sync-usage
 */
export async function syncAllTenantUsageToStripe(): Promise<DailySyncResult> {
  const db = getDb();

  // Get all active tenants with a Stripe subscription (paid plans)
  const tenants = db.prepare(`
    SELECT * FROM tenants
    WHERE active = 1
      AND stripe_subscription_id IS NOT NULL
      AND plan IN ('starter', 'pro', 'enterprise')
  `).all() as unknown as Tenant[];

  const results: UsageReportResult[] = [];
  let skipped = 0;
  let errors = 0;

  for (const tenant of tenants) {
    const subscriptionItemId = await getMeteredSubscriptionItemId(tenant.stripe_subscription_id!);
    if (!subscriptionItemId) {
      console.warn(`[metered-billing] No subscription item for tenant ${tenant.id} (sub: ${tenant.stripe_subscription_id})`);
      skipped++;
      continue;
    }

    const result = await reportTenantUsageToStripe(tenant, subscriptionItemId, 'daily');
    results.push(result);
    if (result.error) errors++;
    if (result.skipped) skipped++;
  }

  console.log(`[metered-billing] Daily sync complete: ${results.length - skipped - errors} synced, ${skipped} skipped, ${errors} errors`);

  return {
    synced: results.filter(r => !r.skipped && !r.error).length,
    skipped,
    errors,
    results,
  };
}

// ---------------------------------------------------------------------------
// Sync log helper
// ---------------------------------------------------------------------------

function logSync(
  tenantId: string,
  subscriptionItemId: string,
  tokensReported: number,
  stripeUsageRecordId: string | undefined,
  syncType: string,
  periodStart?: Date,
  periodEnd?: Date,
  error?: string,
): void {
  try {
    getDb().prepare(`
      INSERT INTO metered_billing_sync
        (tenant_id, subscription_item_id, tokens_reported, stripe_usage_record_id, sync_type, period_start, period_end, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      tenantId,
      subscriptionItemId,
      tokensReported,
      stripeUsageRecordId ?? null,
      syncType,
      periodStart?.toISOString() ?? null,
      periodEnd?.toISOString() ?? null,
      error ?? null,
    );
  } catch (e) {
    console.error('[metered-billing] Failed to log sync:', e);
  }
}
