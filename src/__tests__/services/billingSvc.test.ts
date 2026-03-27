/**
 * Tests: billing.ts service — Stripe integration with mocked Stripe SDK
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Stripe
const mockCheckoutCreate = vi.fn();
const mockPortalCreate = vi.fn();
const mockWebhooksConstructEvent = vi.fn();

vi.mock('stripe', () => {
  function StripeClass() {
    return {
      checkout: {
        sessions: { create: mockCheckoutCreate },
      },
      billingPortal: {
        sessions: { create: mockPortalCreate },
      },
      webhooks: {
        constructEvent: mockWebhooksConstructEvent,
      },
    };
  }
  return { default: StripeClass };
});

// Mock tenants service
const mockGetTenantByStripeCustomer = vi.fn();
const mockGetTenantByStripeSubscription = vi.fn();
const mockGetTenantById = vi.fn();
const mockUpgradeTenantPlan = vi.fn();
const mockDeactivateTenant = vi.fn();

vi.mock('../../services/tenants', () => ({
  PLAN_QUOTAS: { free: 10000, starter: 100000, pro: 500000, enterprise: 10000000 },
  getTenantByStripeCustomer: mockGetTenantByStripeCustomer,
  getTenantByStripeSubscription: mockGetTenantByStripeSubscription,
  getTenantById: mockGetTenantById,
  upgradeTenantPlan: mockUpgradeTenantPlan,
  deactivateTenant: mockDeactivateTenant,
}));

// Mock meteredBilling
const mockHandleInvoiceUpcoming = vi.fn();
vi.mock('../../services/meteredBilling', () => ({
  handleInvoiceUpcoming: mockHandleInvoiceUpcoming,
}));

describe('Billing Service', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_PRICE_STARTER = 'price_starter_test';
    process.env.STRIPE_PRICE_PRO = 'price_pro_test';
  });

  describe('PLAN_CONFIG', () => {
    it('has starter and pro configs', async () => {
      const { PLAN_CONFIG } = await import('../../services/billing');
      expect(PLAN_CONFIG.starter).toBeDefined();
      expect(PLAN_CONFIG.pro).toBeDefined();
      expect(PLAN_CONFIG.starter.usdPerMonth).toBe(49);
      expect(PLAN_CONFIG.pro.usdPerMonth).toBe(149);
    });
  });

  describe('createCheckoutSession', () => {
    it('creates a checkout session for starter plan', async () => {
      mockCheckoutCreate.mockResolvedValue({ id: 'cs_test_123', url: 'https://checkout.stripe.com/...' });
      const { createCheckoutSession } = await import('../../services/billing');
      const session = await createCheckoutSession({
        tenantId: 'tenant-1',
        plan: 'starter',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
        tenantEmail: 'test@example.com',
      });
      expect(session.id).toBe('cs_test_123');
      expect(mockCheckoutCreate).toHaveBeenCalledWith(expect.objectContaining({
        mode: 'subscription',
        metadata: expect.objectContaining({ tenant_id: 'tenant-1', plan: 'starter' }),
      }));
    });

    it('throws if price env var not set', async () => {
      delete process.env.STRIPE_PRICE_STARTER;
      const { createCheckoutSession } = await import('../../services/billing');
      await expect(createCheckoutSession({
        tenantId: 'tenant-1',
        plan: 'starter',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })).rejects.toThrow('STRIPE_PRICE_STARTER env var not set');
    });

    it('throws if STRIPE_SECRET_KEY not configured', async () => {
      delete process.env.STRIPE_SECRET_KEY;
      const { createCheckoutSession } = await import('../../services/billing');
      await expect(createCheckoutSession({
        tenantId: 'tenant-1',
        plan: 'pro',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      })).rejects.toThrow('STRIPE_SECRET_KEY not configured');
    });
  });

  describe('createPortalSession', () => {
    it('creates a portal session', async () => {
      mockPortalCreate.mockResolvedValue({ id: 'bps_test', url: 'https://billing.stripe.com/...' });
      const { createPortalSession } = await import('../../services/billing');
      const session = await createPortalSession('cus_test_123', 'https://example.com/return');
      expect(session.id).toBe('bps_test');
      expect(mockPortalCreate).toHaveBeenCalledWith({
        customer: 'cus_test_123',
        return_url: 'https://example.com/return',
      });
    });
  });

  describe('handleWebhook', () => {
    it('throws on invalid webhook secret', async () => {
      mockWebhooksConstructEvent.mockImplementation(() => {
        throw new Error('Invalid signature');
      });
      const { handleWebhook } = await import('../../services/billing');
      await expect(handleWebhook(Buffer.from('raw'), 'bad-sig'))
        .rejects.toThrow('Webhook signature verification failed');
    });

    it('throws if STRIPE_WEBHOOK_SECRET not configured', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const { handleWebhook } = await import('../../services/billing');
      await expect(handleWebhook(Buffer.from('raw'), 'sig'))
        .rejects.toThrow('STRIPE_WEBHOOK_SECRET not configured');
    });

    it('returns not handled for unrecognized event type', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'some.unknown.event',
        id: 'evt_test',
        data: { object: {} },
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(false);
      expect(result.event).toBe('some.unknown.event');
    });

    it('handles checkout.session.completed', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        id: 'evt_test',
        data: {
          object: {
            metadata: { tenant_id: 'tenant-1', plan: 'starter' },
            customer: 'cus_123',
            subscription: 'sub_123',
          },
        },
      });
      mockGetTenantById.mockReturnValue({ id: 'tenant-1', name: 'Test Tenant', plan: 'free' });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(result.event).toBe('checkout.session.completed');
      expect(mockUpgradeTenantPlan).toHaveBeenCalledWith('tenant-1', 'starter', 'cus_123', 'sub_123');
    });

    it('handles checkout.session.completed with missing tenant', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        id: 'evt_test',
        data: {
          object: {
            metadata: { tenant_id: 'nonexistent', plan: 'starter' },
            customer: 'cus_123',
            subscription: 'sub_123',
          },
        },
      });
      mockGetTenantById.mockReturnValue(null);
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).not.toHaveBeenCalled();
    });

    it('handles checkout.session.completed with no metadata', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        id: 'evt_test',
        data: { object: { metadata: null, customer: null, subscription: null } },
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).not.toHaveBeenCalled();
    });

    it('handles customer.subscription.updated with tenantId in metadata', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        id: 'evt_test',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            metadata: { tenant_id: 'tenant-1' },
            items: { data: [{ price: { id: 'price_starter_test', nickname: null } }] },
          },
        },
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).toHaveBeenCalledWith('tenant-1', 'starter', 'cus_123', 'sub_123');
    });

    it('handles customer.subscription.updated without tenantId (lookup by customer)', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        id: 'evt_test',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            metadata: {},
            items: { data: [{ price: { id: 'price_pro_test', nickname: null } }] },
          },
        },
      });
      mockGetTenantByStripeCustomer.mockReturnValue({ id: 'tenant-from-lookup', plan: 'free' });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).toHaveBeenCalledWith('tenant-from-lookup', 'pro', 'cus_123', 'sub_123');
    });

    it('handles customer.subscription.deleted and downgrades to free', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        id: 'evt_test',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
          },
        },
      });
      mockGetTenantByStripeCustomer.mockReturnValue({ id: 'tenant-1', plan: 'pro' });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).toHaveBeenCalledWith('tenant-1', 'free');
    });

    it('handles invoice.payment_succeeded', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'invoice.payment_succeeded',
        id: 'evt_test',
        data: { object: { id: 'inv_123', customer: 'cus_123' } },
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
    });

    it('handles invoice.payment_failed', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        id: 'evt_test',
        data: { object: { id: 'inv_456', customer: 'cus_123' } },
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
    });

    it('handles invoice.upcoming via meteredBilling', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'invoice.upcoming',
        id: 'evt_test',
        data: { object: { customer: 'cus_123' } },
      });
      mockHandleInvoiceUpcoming.mockResolvedValue({
        handled: true,
        tenantId: 'tenant-1',
        tokensReported: 5000,
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(result.details).toContain('tenant=tenant-1');
      expect(result.details).toContain('tokens=5000');
    });

    it('handles invoice.upcoming with error from meteredBilling', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'invoice.upcoming',
        id: 'evt_test',
        data: { object: { customer: 'cus_123' } },
      });
      mockHandleInvoiceUpcoming.mockResolvedValue({
        handled: false,
        error: 'Tenant not found',
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(false);
    });

    it('planFromSubscription uses nickname as fallback', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.updated',
        id: 'evt_test',
        data: {
          object: {
            id: 'sub_123',
            customer: 'cus_123',
            metadata: { tenant_id: 'tenant-1' },
            items: { data: [{ price: { id: 'price_unknown', nickname: 'Enterprise Plan' } }] },
          },
        },
      });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).toHaveBeenCalledWith('tenant-1', 'enterprise', 'cus_123', 'sub_123');
    });

    it('subscription.deleted looks up by subscription if customer not found', async () => {
      mockWebhooksConstructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        id: 'evt_test',
        data: {
          object: { id: 'sub_999', customer: 'cus_unknown' },
        },
      });
      mockGetTenantByStripeCustomer.mockReturnValue(null);
      mockGetTenantByStripeSubscription.mockReturnValue({ id: 'tenant-by-sub', plan: 'starter' });
      const { handleWebhook } = await import('../../services/billing');
      const result = await handleWebhook(Buffer.from('raw'), 'valid-sig');
      expect(result.handled).toBe(true);
      expect(mockUpgradeTenantPlan).toHaveBeenCalledWith('tenant-by-sub', 'free');
    });
  });

  describe('submitEnterpriseContact', () => {
    it('returns submitted=true with message', async () => {
      const { submitEnterpriseContact } = await import('../../services/billing');
      const result = await submitEnterpriseContact('tenant-1', 'We need enterprise pricing');
      expect(result.submitted).toBe(true);
      expect(result.message).toContain('Thank you');
    });
  });
});
