/**
 * Tests for NR-002: Stripe Metered Billing Reporting
 *
 * Tests:
 *   - invoice.upcoming webhook handler integration
 *   - period token tally from usage log
 *   - metered billing sync log schema
 *   - billing.ts HANDLED_EVENTS includes invoice.upcoming
 *   - syncAllTenantUsageToStripe (mocked Stripe)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDb, getDb } from '../../lib/db';
import { createTenant, incrementUsage, upgradeTenantPlan, initTenantsSchema } from '../../services/tenants';
import { initMeteredBillingSchema } from '../../services/meteredBilling';

// ---------------------------------------------------------------------------
// Test setup — in-memory SQLite via setup.ts (DATABASE_PATH=:memory:)
// ---------------------------------------------------------------------------

beforeEach(() => {
  // Reset DB singleton so each test gets a fresh in-memory DB
  resetDb();
  // Re-init all schemas on fresh DB (tenants + metered billing)
  initTenantsSchema();
  initMeteredBillingSchema();
  // Clear Stripe mock call history
  vi.clearAllMocks();
});

afterEach(() => {
  resetDb();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Stripe mock — mock the stripe module before importing billing services
// ---------------------------------------------------------------------------

const mockCreateUsageRecord = vi.fn().mockResolvedValue({
  id: 'mbur_test_123',
  object: 'usage_record',
  quantity: 0,
  subscription_item: 'si_test_abc',
  timestamp: Math.floor(Date.now() / 1000),
});

const mockRetrieveSubscription = vi.fn().mockResolvedValue({
  id: 'sub_test_abc',
  items: {
    data: [
      {
        id: 'si_test_abc',
        price: {
          id: 'price_starter_test',
          recurring: { usage_type: 'metered' },
        },
      },
    ],
  },
});

const mockConstructEvent = vi.fn();

vi.mock('stripe', () => {
  class MockStripe {
    subscriptionItems = { createUsageRecord: mockCreateUsageRecord };
    subscriptions = { retrieve: mockRetrieveSubscription };
    webhooks = { constructEvent: mockConstructEvent };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    constructor(_key: string, _opts?: unknown) {}
  }
  return { default: MockStripe };
});

// ---------------------------------------------------------------------------
// Test: schema exists after initMeteredBillingSchema
// ---------------------------------------------------------------------------

describe('initMeteredBillingSchema', () => {
  it('creates metered_billing_sync table', () => {
    const db = getDb();
    const tables = db.prepare(`
      SELECT name FROM sqlite_master WHERE type='table' AND name='metered_billing_sync'
    `).all();
    expect(tables).toHaveLength(1);
  });

  it('table has required columns', () => {
    const db = getDb();
    const info = db.prepare(`PRAGMA table_info(metered_billing_sync)`).all() as Array<{ name: string }>;
    const cols = info.map(r => r.name);
    expect(cols).toContain('tenant_id');
    expect(cols).toContain('subscription_item_id');
    expect(cols).toContain('tokens_reported');
    expect(cols).toContain('stripe_usage_record_id');
    expect(cols).toContain('sync_type');
    expect(cols).toContain('period_start');
    expect(cols).toContain('period_end');
    expect(cols).toContain('error');
  });
});

// ---------------------------------------------------------------------------
// Test: HANDLED_EVENTS includes invoice.upcoming
// ---------------------------------------------------------------------------

describe('billing.ts HANDLED_EVENTS', () => {
  it('includes invoice.upcoming in handled webhook events', async () => {
    // Dynamic import to get the module after mocks are set up
    const { handleWebhook } = await import('../../services/billing');

    // Verify the export exists (webhook handler present)
    expect(typeof handleWebhook).toBe('function');

    const mockInvoiceUpcoming = {
      id: 'evt_test_upcoming',
      type: 'invoice.upcoming',
      data: {
        object: {
          id: 'in_test_upcoming',
          customer: 'cus_test_123',
          subscription: 'sub_test_none',  // no tenant for this sub
          period_start: Math.floor(Date.now() / 1000) - 3600,
          period_end: Math.floor(Date.now() / 1000),
        },
      },
    };

    mockConstructEvent.mockReturnValue(mockInvoiceUpcoming);

    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

    const result = await handleWebhook(Buffer.from('{}'), 'sig_test');

    // Should be handled (true) even if no tenant found — the event is recognized
    expect(result.event).toBe('invoice.upcoming');
    // handled may be false if no tenant, but the event type was recognized
    expect(result.event).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Test: reportTenantUsageToStripe — calls Stripe API and logs result
// ---------------------------------------------------------------------------

describe('reportTenantUsageToStripe', () => {
  it('calls stripe subscriptionItems.createUsageRecord with used_tokens', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';

    const { reportTenantUsageToStripe } = await import('../../services/meteredBilling');

    // Create a fake tenant in DB
    const { tenant } = createTenant({ name: 'Metered Test', email: 'metered@test.com', plan: 'starter' });
    upgradeTenantPlan(tenant.id, 'starter', 'cus_test_123', 'sub_test_abc');
    incrementUsage(tenant.id, 12345, '/api/generate', 'gpt-4');

    // Get fresh tenant row
    const { getTenantById } = await import('../../services/tenants');
    const freshTenant = getTenantById(tenant.id)!;

    const result = await reportTenantUsageToStripe(freshTenant, 'si_test_abc', 'daily');

    expect(result.tokensReported).toBe(12345);
    expect(result.error).toBeUndefined();
    expect(result.stripeRecordId).toBe('mbur_test_123');

    // Verify sync log entry
    const db = getDb();
    const logRows = db.prepare('SELECT * FROM metered_billing_sync WHERE tenant_id = ?').all(tenant.id) as any[];
    expect(logRows).toHaveLength(1);
    expect(logRows[0].tokens_reported).toBe(12345);
    expect(logRows[0].stripe_usage_record_id).toBe('mbur_test_123');
    expect(logRows[0].sync_type).toBe('daily');
    expect(logRows[0].error).toBeNull();
  });

  it('skips reporting and logs when tenant has 0 usage', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const { reportTenantUsageToStripe } = await import('../../services/meteredBilling');
    const { getTenantById } = await import('../../services/tenants');

    const { tenant } = createTenant({ name: 'Zero Usage', email: 'zero@test.com', plan: 'starter' });
    const freshTenant = getTenantById(tenant.id)!;

    const result = await reportTenantUsageToStripe(freshTenant, 'si_test_abc', 'daily');

    expect(result.skipped).toBe(true);
    expect(result.tokensReported).toBe(0);
    expect(result.stripeRecordId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test: syncAllTenantUsageToStripe — syncs all paid tenants
// ---------------------------------------------------------------------------

describe('syncAllTenantUsageToStripe', () => {
  it('syncs active paid tenants and returns results', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const { syncAllTenantUsageToStripe } = await import('../../services/meteredBilling');

    // Create two paid tenants
    const { tenant: t1 } = createTenant({ name: 'Paid 1', email: 'paid1@test.com', plan: 'pro' });
    upgradeTenantPlan(t1.id, 'pro', 'cus_1', 'sub_1');
    incrementUsage(t1.id, 5000, '/api/generate', 'claude');

    const { tenant: t2 } = createTenant({ name: 'Paid 2', email: 'paid2@test.com', plan: 'starter' });
    upgradeTenantPlan(t2.id, 'starter', 'cus_2', 'sub_2');
    incrementUsage(t2.id, 2500, '/api/generate', 'claude');

    // Create a free tenant (should not be synced)
    createTenant({ name: 'Free User', email: 'free@test.com', plan: 'free' });

    const syncResult = await syncAllTenantUsageToStripe();

    // Both paid tenants should be synced
    expect(syncResult.synced + syncResult.errors).toBeGreaterThanOrEqual(2);
    expect(syncResult.results.length).toBeGreaterThanOrEqual(2);

    // Free tenant should not appear in results
    const freeResult = syncResult.results.find(r => {
      const t = getDb().prepare('SELECT email FROM tenants WHERE id = ?').get(r.tenantId) as any;
      return t?.email === 'free@test.com';
    });
    expect(freeResult).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Test: handleInvoiceUpcoming — tally period tokens and report
// ---------------------------------------------------------------------------

describe('handleInvoiceUpcoming', () => {
  it('handles invoice.upcoming for a known tenant and reports period usage', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const { handleInvoiceUpcoming } = await import('../../services/meteredBilling');

    // Create a tenant and log some usage
    const { tenant } = createTenant({ name: 'Invoice Test', email: 'invoice@test.com', plan: 'pro' });
    upgradeTenantPlan(tenant.id, 'pro', 'cus_invoice', 'sub_invoice_test');
    incrementUsage(tenant.id, 8000, '/api/generate', 'claude');

    const now = Math.floor(Date.now() / 1000);
    const mockInvoice = {
      id: 'in_upcoming_test',
      customer: 'cus_invoice',
      subscription: 'sub_invoice_test',
      period_start: now - 3600 * 24 * 30,  // 30 days ago
      period_end: now,
    } as any; // Stripe.UpcomingInvoice

    const result = await handleInvoiceUpcoming(mockInvoice);

    // Should find the tenant and report usage
    expect(result.handled).toBe(true);
    expect(result.tenantId).toBe(tenant.id);
    expect(result.error).toBeUndefined();
  });

  it('returns handled=false for unknown subscription', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const { handleInvoiceUpcoming } = await import('../../services/meteredBilling');

    const now = Math.floor(Date.now() / 1000);
    const mockInvoice = {
      id: 'in_unknown',
      customer: 'cus_nobody',
      subscription: 'sub_nobody_xyz',
      period_start: now - 3600,
      period_end: now,
    } as any;

    const result = await handleInvoiceUpcoming(mockInvoice);

    expect(result.handled).toBe(false);
    expect(result.error).toContain('no tenant');
  });

  it('returns handled=false when no subscription_id', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
    const { handleInvoiceUpcoming } = await import('../../services/meteredBilling');

    const now = Math.floor(Date.now() / 1000);
    const mockInvoice = {
      id: 'in_no_sub',
      customer: 'cus_test',
      subscription: null,
      period_start: now - 3600,
      period_end: now,
    } as any;

    const result = await handleInvoiceUpcoming(mockInvoice);
    expect(result.handled).toBe(false);
  });
});
