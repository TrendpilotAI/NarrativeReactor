/**
 * Billing service tests — Stripe integration layer.
 *
 * Tests:
 *   1. Checkout session creation (mocked Stripe)
 *   2. Webhook signature verification
 *   3. Subscription status / plan upgrades
 *
 * Stripe is mocked via vi.mock — no real network calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// ── Isolate SQLite DB and set env vars BEFORE modules are imported ────────────
// vi.hoisted runs before vi.mock which runs before ESM imports

const { mockCheckoutSessionCreate, mockPortalSessionCreate, mockConstructEvent, tmpDir } = vi.hoisted(() => {
  // Use require inside vi.hoisted since ESM imports aren't available yet
  const _fs = require('fs') as typeof import('fs');
  const _os = require('os') as typeof import('os');
  const _path = require('path') as typeof import('path');
  const dir = _fs.mkdtempSync(_path.join(_os.tmpdir(), 'nr-billing-stripe-test-'));
  const dbPath = _path.join(dir, 'test.db');
  // Set env vars here so they're captured at module-load time by billing.ts
  process.env.DATABASE_PATH = dbPath;
  process.env.STRIPE_SECRET_KEY = 'sk_test_mock';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_mock';
  process.env.STRIPE_PRICE_STARTER = 'price_starter_mock';
  process.env.STRIPE_PRICE_PRO = 'price_pro_mock';
  process.env.SCRYPT_SALT = 'test_salt_billing_stripe';
  return {
    mockCheckoutSessionCreate: vi.fn(),
    mockPortalSessionCreate: vi.fn(),
    mockConstructEvent: vi.fn(),
    tmpDir: dir,
  };
});

// ── Mock Stripe SDK ───────────────────────────────────────────────────────────

vi.mock('stripe', () => {
  class MockStripe {
    checkout = { sessions: { create: mockCheckoutSessionCreate } };
    billingPortal = { sessions: { create: mockPortalSessionCreate } };
    webhooks = { constructEvent: mockConstructEvent };
  }
  return { default: MockStripe };
});

// Import after mocking
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  PLAN_CONFIG,
} from '../services/billing';
import {
  createTenant,
  getTenantById,
  getTenantByStripeCustomer,
  upgradeTenantPlan,
  PLAN_QUOTAS,
} from '../services/tenants';
import { resetDb } from '../lib/db';

// Clear mocks between tests but keep DB open (initSchema only runs at module load)
afterEach(() => {
  vi.clearAllMocks();
});

// Cleanup DB and temp dir after all tests complete
afterAll(() => {
  resetDb();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

// ── 1. Checkout session creation ──────────────────────────────────────────────

describe('createCheckoutSession', () => {
  it('creates a starter checkout session with correct params', async () => {
    const mockSession = {
      id: 'cs_test_abc123',
      url: 'https://checkout.stripe.com/pay/cs_test_abc123',
    };
    mockCheckoutSessionCreate.mockResolvedValue(mockSession);

    const { tenant } = createTenant({ name: 'Test Corp', email: 'test@corp.com', plan: 'free' });

    const session = await createCheckoutSession({
      tenantId: tenant.id,
      plan: 'starter',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
      tenantEmail: tenant.email,
    });

    expect(session.id).toBe('cs_test_abc123');
    expect(session.url).toBe('https://checkout.stripe.com/pay/cs_test_abc123');

    expect(mockCheckoutSessionCreate).toHaveBeenCalledOnce();
    const callArgs = mockCheckoutSessionCreate.mock.calls[0][0];
    expect(callArgs.mode).toBe('subscription');
    expect(callArgs.line_items[0].price).toBe('price_starter_mock');
    expect(callArgs.metadata.tenant_id).toBe(tenant.id);
    expect(callArgs.metadata.plan).toBe('starter');
    expect(callArgs.customer_email).toBe(tenant.email);
    expect(callArgs.success_url).toBe('https://example.com/success');
    expect(callArgs.cancel_url).toBe('https://example.com/cancel');
  });

  it('creates a pro checkout session', async () => {
    mockCheckoutSessionCreate.mockResolvedValue({ id: 'cs_pro', url: 'https://checkout.stripe.com/pro' });
    const { tenant } = createTenant({ name: 'Pro Corp', email: 'pro@corp.com' });

    await createCheckoutSession({
      tenantId: tenant.id,
      plan: 'pro',
      successUrl: 'https://example.com/success',
      cancelUrl: 'https://example.com/cancel',
    });

    const callArgs = mockCheckoutSessionCreate.mock.calls[0][0];
    expect(callArgs.line_items[0].price).toBe('price_pro_mock');
    expect(callArgs.metadata.plan).toBe('pro');
  });

  it('throws when price ID is not configured', async () => {
    // PLAN_CONFIG.priceId is captured at module load time, so we manipulate it directly
    const savedPriceId = PLAN_CONFIG.starter.priceId;
    (PLAN_CONFIG.starter as any).priceId = undefined;

    try {
      await expect(
        createCheckoutSession({
          tenantId: 'some-id',
          plan: 'starter',
          successUrl: 'https://example.com/success',
          cancelUrl: 'https://example.com/cancel',
        })
      ).rejects.toThrow('STRIPE_PRICE_STARTER env var not set');
    } finally {
      (PLAN_CONFIG.starter as any).priceId = savedPriceId;
    }
  });

  it('PLAN_CONFIG has correct token counts', () => {
    expect(PLAN_CONFIG.starter.tokens).toBe(PLAN_QUOTAS.starter);
    expect(PLAN_CONFIG.pro.tokens).toBe(PLAN_QUOTAS.pro);
    expect(PLAN_CONFIG.starter.usdPerMonth).toBe(49);
    expect(PLAN_CONFIG.pro.usdPerMonth).toBe(149);
  });
});

// ── 2. Webhook signature verification ────────────────────────────────────────

describe('handleWebhook — signature verification', () => {
  it('rejects missing stripe-signature header', async () => {
    // handleWebhook calls getStripe() → constructEvent
    // If sig is empty, we detect it before constructEvent
    await expect(
      // Empty string simulates missing header, route layer catches this but let's test service
      handleWebhook(Buffer.from('{}'), '')
    ).rejects.toThrow();
  });

  it('rejects invalid signature (constructEvent throws)', async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    await expect(
      handleWebhook(Buffer.from('{}'), 'bad_sig')
    ).rejects.toThrow('Webhook signature verification failed');
  });

  it('handles unknown events gracefully (returns handled: false)', async () => {
    mockConstructEvent.mockReturnValue({
      type: 'payment_intent.created',
      id: 'evt_test',
      data: { object: {} },
    });

    const result = await handleWebhook(Buffer.from('{}'), 'valid_sig');
    expect(result.handled).toBe(false);
    expect(result.event).toBe('payment_intent.created');
  });

  it('passes raw body + signature to constructEvent', async () => {
    const body = Buffer.from('{"type":"customer.subscription.deleted"}');
    const sig = 't=1234,v1=abcdef';
    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      id: 'evt_del',
      data: {
        object: {
          id: 'sub_xxx',
          customer: 'cus_unknown',
          metadata: {},
          items: { data: [] },
        },
      },
    });

    await handleWebhook(body, sig);

    expect(mockConstructEvent).toHaveBeenCalledWith(body, sig, 'whsec_test_mock');
  });
});

// ── 3. Webhook event handling — subscription status ───────────────────────────

describe('handleWebhook — checkout.session.completed', () => {
  it('upgrades tenant plan on successful checkout', async () => {
    const { tenant } = createTenant({ name: 'Checkout Co', email: 'checkout@co.com', plan: 'free' });
    expect(getTenantById(tenant.id)?.plan).toBe('free');

    mockConstructEvent.mockReturnValue({
      type: 'checkout.session.completed',
      id: 'evt_checkout',
      data: {
        object: {
          id: 'cs_completed',
          customer: 'cus_checkout_001',
          subscription: 'sub_checkout_001',
          metadata: { tenant_id: tenant.id, plan: 'starter' },
        },
      },
    });

    const result = await handleWebhook(Buffer.from('{}'), 'valid_sig');

    expect(result.handled).toBe(true);
    expect(result.event).toBe('checkout.session.completed');

    const upgraded = getTenantById(tenant.id);
    expect(upgraded?.plan).toBe('starter');
    expect(upgraded?.stripe_customer_id).toBe('cus_checkout_001');
    expect(upgraded?.stripe_subscription_id).toBe('sub_checkout_001');
    expect(upgraded?.quota_tokens).toBe(PLAN_QUOTAS.starter);
  });
});

describe('handleWebhook — customer.subscription.updated', () => {
  it('updates tenant plan when subscription is updated', async () => {
    const { tenant } = createTenant({ name: 'Update Co', email: 'update@co.com', plan: 'starter' });
    upgradeTenantPlan(tenant.id, 'starter', 'cus_update_001', 'sub_update_001');

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      id: 'evt_sub_updated',
      data: {
        object: {
          id: 'sub_update_001',
          customer: 'cus_update_001',
          metadata: { tenant_id: tenant.id },
          items: {
            data: [{ price: { id: 'price_pro_mock', nickname: 'pro' } }],
          },
        },
      },
    });

    const result = await handleWebhook(Buffer.from('{}'), 'valid_sig');
    expect(result.handled).toBe(true);

    const upgraded = getTenantById(tenant.id);
    expect(upgraded?.plan).toBe('pro');
    expect(upgraded?.quota_tokens).toBe(PLAN_QUOTAS.pro);
  });
});

describe('handleWebhook — customer.subscription.deleted', () => {
  it('downgrades tenant to free on subscription cancellation', async () => {
    const { tenant } = createTenant({ name: 'Cancel Co', email: 'cancel@co.com', plan: 'pro' });
    upgradeTenantPlan(tenant.id, 'pro', 'cus_cancel_001', 'sub_cancel_001');

    mockConstructEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      id: 'evt_sub_deleted',
      data: {
        object: {
          id: 'sub_cancel_001',
          customer: 'cus_cancel_001',
          metadata: {},
          items: { data: [] },
        },
      },
    });

    const result = await handleWebhook(Buffer.from('{}'), 'valid_sig');
    expect(result.handled).toBe(true);

    const downgraded = getTenantById(tenant.id);
    expect(downgraded?.plan).toBe('free');
    expect(downgraded?.quota_tokens).toBe(PLAN_QUOTAS.free);
  });
});

// ── 4. Customer portal ─────────────────────────────────────────────────────────

describe('createPortalSession', () => {
  it('creates a portal session for a valid Stripe customer', async () => {
    mockPortalSessionCreate.mockResolvedValue({
      url: 'https://billing.stripe.com/session/portal_test',
    });

    const session = await createPortalSession('cus_portal_001', 'https://example.com/billing');

    expect(session.url).toBe('https://billing.stripe.com/session/portal_test');
    expect(mockPortalSessionCreate).toHaveBeenCalledWith({
      customer: 'cus_portal_001',
      return_url: 'https://example.com/billing',
    });
  });
});
