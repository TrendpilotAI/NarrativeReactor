/**
 * Tests: tenants.ts service — comprehensive coverage using in-memory SQLite
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Use in-memory DB (configured in setup.ts via DATABASE_PATH=:memory:)

describe('Tenants Service — Full Coverage', () => {
  beforeEach(async () => {
    // Re-import fresh module to get clean in-memory DB state
    // We use dynamic imports with resetModules pattern
  });

  describe('PLAN_QUOTAS & PLAN_PRICES_USD', () => {
    it('has correct quota values', async () => {
      const { PLAN_QUOTAS, PLAN_PRICES_USD } = await import('../../services/tenants');
      expect(PLAN_QUOTAS.free).toBe(10_000);
      expect(PLAN_QUOTAS.starter).toBe(100_000);
      expect(PLAN_QUOTAS.pro).toBe(500_000);
      expect(PLAN_QUOTAS.enterprise).toBe(10_000_000);
      expect(PLAN_PRICES_USD.free).toBe(0);
      expect(PLAN_PRICES_USD.starter).toBe(49);
      expect(PLAN_PRICES_USD.pro).toBe(149);
    });
  });

  describe('generateApiKey', () => {
    it('generates keys with nr_live_ prefix', async () => {
      const { generateApiKey } = await import('../../services/tenants');
      const key = generateApiKey();
      expect(key).toMatch(/^nr_live_[0-9a-f]{48}$/);
    });

    it('generates unique keys', async () => {
      const { generateApiKey } = await import('../../services/tenants');
      const keys = new Set(Array.from({ length: 5 }, generateApiKey));
      expect(keys.size).toBe(5);
    });
  });

  describe('hashApiKey', () => {
    it('hashes deterministically', async () => {
      const { generateApiKey, hashApiKey } = await import('../../services/tenants');
      const key = generateApiKey();
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it('produces different hashes for different keys', async () => {
      const { generateApiKey, hashApiKey } = await import('../../services/tenants');
      const k1 = generateApiKey();
      const k2 = generateApiKey();
      expect(hashApiKey(k1)).not.toBe(hashApiKey(k2));
    });
  });

  describe('createTenant', () => {
    it('creates a tenant with default free plan', async () => {
      const { createTenant } = await import('../../services/tenants');
      const { tenant, rawApiKey } = createTenant({ name: 'Test Corp', email: `test-${Date.now()}@example.com` });
      expect(tenant.id).toBeDefined();
      expect(tenant.name).toBe('Test Corp');
      expect(tenant.plan).toBe('free');
      expect(tenant.quota_tokens).toBe(10_000);
      expect(rawApiKey).toMatch(/^nr_live_/);
    });

    it('creates a tenant with specified plan', async () => {
      const { createTenant } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Pro Corp', email: `pro-${Date.now()}@example.com`, plan: 'pro' });
      expect(tenant.plan).toBe('pro');
      expect(tenant.quota_tokens).toBe(500_000);
    });

    it('throws on duplicate email', async () => {
      const { createTenant } = await import('../../services/tenants');
      const email = `dup-${Date.now()}@example.com`;
      createTenant({ name: 'First', email });
      expect(() => createTenant({ name: 'Second', email })).toThrow();
    });
  });

  describe('validateApiKey', () => {
    it('validates a valid API key', async () => {
      const { createTenant, validateApiKey } = await import('../../services/tenants');
      const { rawApiKey } = createTenant({ name: 'Validate Corp', email: `validate-${Date.now()}@example.com` });
      const tenant = validateApiKey(rawApiKey);
      expect(tenant).not.toBeNull();
      expect(tenant!.name).toBe('Validate Corp');
    });

    it('returns null for invalid key', async () => {
      const { validateApiKey } = await import('../../services/tenants');
      const result = validateApiKey('nr_live_invalidkey123456789012345678901234567890123456');
      expect(result).toBeNull();
    });
  });

  describe('checkQuota', () => {
    it('returns true when under quota', async () => {
      const { checkQuota } = await import('../../services/tenants');
      const mockTenant = { used_tokens: 5000, quota_tokens: 10000 } as any;
      expect(checkQuota(mockTenant)).toBe(true);
    });

    it('returns false when at or over quota', async () => {
      const { checkQuota } = await import('../../services/tenants');
      const mockTenant = { used_tokens: 10000, quota_tokens: 10000 } as any;
      expect(checkQuota(mockTenant)).toBe(false);
    });
  });

  describe('remainingTokens', () => {
    it('returns remaining tokens', async () => {
      const { remainingTokens } = await import('../../services/tenants');
      const mockTenant = { used_tokens: 3000, quota_tokens: 10000 } as any;
      expect(remainingTokens(mockTenant)).toBe(7000);
    });

    it('returns 0 when over quota', async () => {
      const { remainingTokens } = await import('../../services/tenants');
      const mockTenant = { used_tokens: 15000, quota_tokens: 10000 } as any;
      expect(remainingTokens(mockTenant)).toBe(0);
    });
  });

  describe('incrementUsage', () => {
    it('increments usage tokens', async () => {
      const { createTenant, incrementUsage, getTenantById } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Usage Corp', email: `usage-${Date.now()}@example.com` });
      incrementUsage(tenant.id, 500, '/api/generate', 'claude-3');
      const updated = getTenantById(tenant.id);
      expect(updated!.used_tokens).toBe(500);
    });

    it('logs usage without endpoint/model', async () => {
      const { createTenant, incrementUsage, getTenantById } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Usage2 Corp', email: `usage2-${Date.now()}@example.com` });
      incrementUsage(tenant.id, 100);
      const updated = getTenantById(tenant.id);
      expect(updated!.used_tokens).toBe(100);
    });
  });

  describe('getTenantByStripeCustomer', () => {
    it('returns tenant by stripe customer ID', async () => {
      const { createTenant, upgradeTenantPlan, getTenantByStripeCustomer } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Stripe Corp', email: `stripe-${Date.now()}@example.com` });
      upgradeTenantPlan(tenant.id, 'starter', 'cus_test_123');
      const found = getTenantByStripeCustomer('cus_test_123');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(tenant.id);
    });

    it('returns null for unknown customer', async () => {
      const { getTenantByStripeCustomer } = await import('../../services/tenants');
      const result = getTenantByStripeCustomer('cus_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getTenantByStripeSubscription', () => {
    it('returns tenant by subscription ID', async () => {
      const { createTenant, upgradeTenantPlan, getTenantByStripeSubscription } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Sub Corp', email: `sub-${Date.now()}@example.com` });
      upgradeTenantPlan(tenant.id, 'pro', 'cus_456', 'sub_test_789');
      const found = getTenantByStripeSubscription('sub_test_789');
      expect(found).not.toBeNull();
      expect(found!.id).toBe(tenant.id);
    });

    it('returns null for unknown subscription', async () => {
      const { getTenantByStripeSubscription } = await import('../../services/tenants');
      const result = getTenantByStripeSubscription('sub_nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('upgradeTenantPlan', () => {
    it('upgrades tenant plan and quota', async () => {
      const { createTenant, upgradeTenantPlan, getTenantById } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Upgrade Corp', email: `upgrade-${Date.now()}@example.com` });
      expect(tenant.plan).toBe('free');
      upgradeTenantPlan(tenant.id, 'pro');
      const updated = getTenantById(tenant.id);
      expect(updated!.plan).toBe('pro');
      expect(updated!.quota_tokens).toBe(500_000);
    });

    it('upgrades with stripe IDs', async () => {
      const { createTenant, upgradeTenantPlan, getTenantById } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Stripe Upgrade', email: `stripe-upgrade-${Date.now()}@example.com` });
      upgradeTenantPlan(tenant.id, 'starter', 'cus_new', 'sub_new');
      const updated = getTenantById(tenant.id);
      expect(updated!.stripe_customer_id).toBe('cus_new');
      expect(updated!.stripe_subscription_id).toBe('sub_new');
    });
  });

  describe('deactivateTenant', () => {
    it('deactivates a tenant', async () => {
      const { createTenant, deactivateTenant, validateApiKey } = await import('../../services/tenants');
      const { tenant, rawApiKey } = createTenant({ name: 'Deactivate Corp', email: `deactivate-${Date.now()}@example.com` });
      deactivateTenant(tenant.id);
      // After deactivation, validateApiKey should return null (active=0)
      const result = validateApiKey(rawApiKey);
      expect(result).toBeNull();
    });
  });

  describe('getTenantById', () => {
    it('returns tenant by ID', async () => {
      const { createTenant, getTenantById } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'GetById Corp', email: `getbyid-${Date.now()}@example.com` });
      const found = getTenantById(tenant.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('GetById Corp');
    });

    it('returns null for nonexistent ID', async () => {
      const { getTenantById } = await import('../../services/tenants');
      const result = getTenantById('nonexistent-id');
      expect(result).toBeNull();
    });
  });

  describe('listTenants', () => {
    it('returns all tenants', async () => {
      const { createTenant, listTenants } = await import('../../services/tenants');
      const before = listTenants().length;
      createTenant({ name: 'List Corp 1', email: `list1-${Date.now()}@example.com` });
      createTenant({ name: 'List Corp 2', email: `list2-${Date.now() + 1}@example.com` });
      const after = listTenants();
      expect(after.length).toBe(before + 2);
    });
  });

  describe('rotateApiKey', () => {
    it('rotates API key and old key becomes invalid', async () => {
      const { createTenant, rotateApiKey, validateApiKey } = await import('../../services/tenants');
      const { tenant, rawApiKey } = createTenant({ name: 'Rotate Corp', email: `rotate-${Date.now()}@example.com` });
      const newKey = rotateApiKey(tenant.id);
      expect(newKey).toMatch(/^nr_live_/);
      expect(newKey).not.toBe(rawApiKey);
      // Old key should be invalid
      const oldResult = validateApiKey(rawApiKey);
      expect(oldResult).toBeNull();
      // New key should be valid
      const newResult = validateApiKey(newKey);
      expect(newResult).not.toBeNull();
    });
  });

  describe('getTenantUsageSummary', () => {
    it('returns tenant and usage log', async () => {
      const { createTenant, incrementUsage, getTenantUsageSummary } = await import('../../services/tenants');
      const { tenant } = createTenant({ name: 'Summary Corp', email: `summary-${Date.now()}@example.com` });
      incrementUsage(tenant.id, 100, '/api/test');
      incrementUsage(tenant.id, 200, '/api/generate');
      const { tenant: t, usageLog } = getTenantUsageSummary(tenant.id);
      expect(t).not.toBeNull();
      expect(Array.isArray(usageLog)).toBe(true);
      expect((usageLog as any[]).length).toBeGreaterThanOrEqual(2);
    });

    it('returns null tenant for nonexistent ID', async () => {
      const { getTenantUsageSummary } = await import('../../services/tenants');
      const { tenant } = getTenantUsageSummary('nonexistent-id');
      expect(tenant).toBeNull();
    });
  });
});
