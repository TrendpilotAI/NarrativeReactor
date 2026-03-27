/**
 * Tests: Billing routes
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response } from 'express';
import { createServer } from 'http';

// Mock all service dependencies
const mockCreateCheckoutSession = vi.fn();
const mockCreatePortalSession = vi.fn();
const mockHandleWebhook = vi.fn();
const mockSubmitEnterpriseContact = vi.fn();
const mockSyncAllTenantUsageToStripe = vi.fn();
const mockCreateTenant = vi.fn();
const mockListTenants = vi.fn();
const mockGetTenantUsageSummary = vi.fn();
const mockRotateApiKey = vi.fn();

vi.mock('../../services/billing', () => ({
  createCheckoutSession: mockCreateCheckoutSession,
  createPortalSession: mockCreatePortalSession,
  handleWebhook: mockHandleWebhook,
  submitEnterpriseContact: mockSubmitEnterpriseContact,
  PLAN_CONFIG: {
    starter: { name: 'Starter', priceId: 'price_starter', tokens: 100000, usdPerMonth: 49 },
    pro: { name: 'Pro', priceId: 'price_pro', tokens: 500000, usdPerMonth: 149 },
  },
}));

vi.mock('../../services/meteredBilling', () => ({
  syncAllTenantUsageToStripe: mockSyncAllTenantUsageToStripe,
}));

vi.mock('../../services/tenants', () => ({
  createTenant: mockCreateTenant,
  listTenants: mockListTenants,
  getTenantUsageSummary: mockGetTenantUsageSummary,
  rotateApiKey: mockRotateApiKey,
  PLAN_QUOTAS: { free: 10000, starter: 100000, pro: 500000, enterprise: 10000000 },
  PLAN_PRICES_USD: { free: 0, starter: 49, pro: 149, enterprise: 0 },
}));

// Mock middleware
vi.mock('../../middleware/tenantAuth', () => ({
  tenantAuth: vi.fn((req: Request, _res: Response, next: Function) => {
    // Attach mock tenant
    (req as any).tenant = {
      id: 'tenant-1',
      plan: 'starter',
      quota_tokens: 100000,
      used_tokens: 25000,
      reset_at: '2025-02-01T00:00:00Z',
    };
    next();
  }),
  quotaGuard: vi.fn((_req: Request, _res: Response, next: Function) => next()),
}));

vi.mock('../../middleware/auth', () => ({
  apiKeyAuth: vi.fn((_req: Request, _res: Response, next: Function) => next()),
}));

async function buildTestApp() {
  const app = express();
  app.use(express.json());
  vi.resetModules();
  const { billingRouter, stripeWebhookRouter } = await import('../../routes/billing');
  app.use('/api/billing', billingRouter);
  app.use('/webhooks', stripeWebhookRouter);
  return app;
}

async function makeRequest(
  app: express.Express,
  method: string,
  path: string,
  body?: any,
  headers?: Record<string, string>,
): Promise<{ status: number; body: any }> {
  const server = createServer(app);
  await new Promise<void>(resolve => server.listen(0, resolve));
  const port = (server.address() as any).port;
  const response = await fetch(`http://localhost:${port}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await response.json().catch(() => ({}));
  await new Promise<void>((resolve, reject) =>
    server.close(err => (err ? reject(err) : resolve())),
  );
  return { status: response.status, body: json };
}

describe('Billing Routes', () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildTestApp();
  });

  describe('GET /api/billing/plans', () => {
    it('returns plan list', async () => {
      const { status, body } = await makeRequest(app, 'GET', '/api/billing/plans');
      expect(status).toBe(200);
      expect(body.plans).toBeDefined();
      expect(Array.isArray(body.plans)).toBe(true);
      expect(body.plans.length).toBeGreaterThan(0);
      const free = body.plans.find((p: any) => p.id === 'free');
      expect(free).toBeDefined();
      expect(free.price_usd).toBe(0);
    });
  });

  describe('POST /api/billing/checkout', () => {
    it('creates checkout session successfully', async () => {
      mockCreateCheckoutSession.mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com' });
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/checkout', {
        plan: 'starter',
      });
      expect(status).toBe(200);
      expect(body.session_id).toBe('cs_test');
      expect(body.url).toBeDefined();
    });

    it('creates checkout session for pro plan', async () => {
      mockCreateCheckoutSession.mockResolvedValue({ id: 'cs_pro_test', url: 'https://checkout.stripe.com/pro' });
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/checkout', {
        plan: 'pro',
      });
      expect(status).toBe(200);
      expect(body.session_id).toBe('cs_pro_test');
    });

    it('returns 400 if plan missing', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/checkout', {});
      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('returns 400 for invalid plan', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/checkout', {
        plan: 'invalid-plan',
      });
      expect(status).toBe(400);
      expect(body.error).toBeDefined();
    });

    it('returns 400 for free plan', async () => {
      const { status } = await makeRequest(app, 'POST', '/api/billing/checkout', {
        plan: 'free',
      });
      expect(status).toBe(400);
    });
  });

  describe('POST /api/billing/portal', () => {
    it('returns 400 if no stripe customer (mock tenant has no stripe_customer_id)', async () => {
      // Our mock tenant doesn't have stripe_customer_id, so this returns 400
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/portal', {});
      expect(status).toBe(400);
      expect(body.error).toContain('No Stripe customer');
    });
  });

  describe('POST /api/billing/enterprise', () => {
    it('submits enterprise contact', async () => {
      mockSubmitEnterpriseContact.mockResolvedValue({ submitted: true, message: 'Thank you!' });
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/enterprise', {
        message: 'We need enterprise pricing',
      });
      expect(status).toBe(200);
      expect(body.submitted).toBe(true);
    });

    it('returns 400 if message missing', async () => {
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/enterprise', {});
      expect(status).toBe(400);
    });
  });

  describe('GET /api/billing/usage', () => {
    it('returns current tenant usage', async () => {
      const { status, body } = await makeRequest(app, 'GET', '/api/billing/usage');
      expect(status).toBe(200);
      expect(body.tenant_id).toBe('tenant-1');
      expect(body.plan).toBe('starter');
      expect(body.quota_tokens).toBe(100000);
      expect(body.used_tokens).toBe(25000);
      expect(body.remaining_tokens).toBe(75000);
      expect(body.percent_used).toBe(25);
    });
  });

  describe('POST /api/billing/tenants', () => {
    it('creates a new tenant', async () => {
      mockCreateTenant.mockReturnValue({
        tenant: { id: 'new-tenant', name: 'Test', email: 'test@example.com' },
        rawApiKey: 'nr_live_testkey123',
      });
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/tenants', {
        name: 'Test Tenant',
        email: 'test@example.com',
      });
      expect(status).toBe(201);
      expect(body.api_key).toBeDefined();
      expect(body.warning).toBeDefined();
    });

    it('returns 400 if name missing', async () => {
      const { status } = await makeRequest(app, 'POST', '/api/billing/tenants', {
        email: 'test@example.com',
      });
      expect(status).toBe(400);
    });

    it('returns 400 if email missing', async () => {
      const { status } = await makeRequest(app, 'POST', '/api/billing/tenants', {
        name: 'Test',
      });
      expect(status).toBe(400);
    });
  });

  describe('GET /api/billing/tenants', () => {
    it('returns tenant list', async () => {
      mockListTenants.mockReturnValue([{ id: 't1' }, { id: 't2' }]);
      const { status, body } = await makeRequest(app, 'GET', '/api/billing/tenants');
      expect(status).toBe(200);
      expect(body.tenants).toHaveLength(2);
    });
  });

  describe('GET /api/billing/tenants/:id/usage', () => {
    it('returns tenant usage', async () => {
      mockGetTenantUsageSummary.mockReturnValue({
        tenant: { id: 'tenant-1', plan: 'starter' },
        usageLog: [],
      });
      const { status, body } = await makeRequest(app, 'GET', '/api/billing/tenants/tenant-1/usage');
      expect(status).toBe(200);
      expect(body.tenant).toBeDefined();
    });

    it('returns 404 if tenant not found', async () => {
      mockGetTenantUsageSummary.mockReturnValue({ tenant: null, usageLog: [] });
      const { status } = await makeRequest(app, 'GET', '/api/billing/tenants/notfound/usage');
      expect(status).toBe(404);
    });
  });

  describe('POST /api/billing/tenants/:id/rotate-key', () => {
    it('rotates API key', async () => {
      mockRotateApiKey.mockReturnValue('nr_live_newkey456');
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/tenants/tenant-1/rotate-key');
      expect(status).toBe(200);
      expect(body.api_key).toBe('nr_live_newkey456');
      expect(body.warning).toBeDefined();
    });
  });

  describe('POST /api/billing/sync-usage', () => {
    it('syncs tenant usage', async () => {
      mockSyncAllTenantUsageToStripe.mockResolvedValue({
        synced: 3,
        skipped: 1,
        errors: 0,
        results: [],
      });
      const { status, body } = await makeRequest(app, 'POST', '/api/billing/sync-usage');
      expect(status).toBe(200);
      expect(body.synced).toBe(3);
    });
  });

  describe('Stripe Webhook', () => {
    it('returns 400 if missing stripe-signature', async () => {
      const server = createServer(app);
      await new Promise<void>(resolve => server.listen(0, resolve));
      const port = (server.address() as any).port;
      const response = await fetch(`http://localhost:${port}/webhooks/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test' }),
      });
      const json = await response.json();
      await new Promise<void>((resolve, reject) =>
        server.close(err => (err ? reject(err) : resolve())),
      );
      expect(response.status).toBe(400);
      expect(json.error).toContain('stripe-signature');
    });
  });
});
