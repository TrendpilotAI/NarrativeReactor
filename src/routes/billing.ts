/**
 * Billing routes
 *
 * POST /api/billing/checkout       — Create Stripe Checkout session
 * POST /api/billing/portal         — Create Stripe Customer Portal session
 * POST /api/billing/enterprise     — Submit enterprise contact form
 * GET  /api/billing/plans          — List available plans
 * GET  /api/billing/usage          — Current tenant usage (requires tenant auth)
 * POST /api/tenants                — Create a new tenant (admin)
 * GET  /api/tenants                — List all tenants (admin)
 * GET  /api/tenants/:id/usage      — Tenant usage summary (admin)
 * POST /api/tenants/:id/rotate-key — Rotate tenant API key (admin)
 * POST /webhooks/stripe            — Stripe webhook endpoint
 */

import { Router, Request, Response } from 'express';
import express from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import {
  createCheckoutSession,
  createPortalSession,
  handleWebhook,
  submitEnterpriseContact,
} from '../services/billing';
import { syncAllTenantUsageToStripe } from '../services/meteredBilling';
import {
  createTenant,
  listTenants,
  getTenantUsageSummary,
  rotateApiKey,
  PLAN_QUOTAS,
  PLAN_PRICES_USD,
} from '../services/tenants';
import { tenantAuth } from '../middleware/tenantAuth';
import { apiKeyAuth } from '../middleware/auth';

export const billingRouter = Router();
export const stripeWebhookRouter = Router();

// ---------------------------------------------------------------------------
// Public: Plan listing
// ---------------------------------------------------------------------------

billingRouter.get('/plans', (_req: Request, res: Response) => {
  res.json({
    plans: [
      {
        id: 'free',
        name: 'Free',
        price_usd: PLAN_PRICES_USD.free,
        quota_tokens: PLAN_QUOTAS.free,
        description: 'Get started — 10K tokens/month, no credit card required.',
        features: ['10,000 tokens/month', 'API access', 'Community support'],
      },
      {
        id: 'starter',
        name: 'Starter',
        price_usd: PLAN_PRICES_USD.starter,
        quota_tokens: PLAN_QUOTAS.starter,
        description: 'For solo creators and small teams.',
        features: ['100,000 tokens/month', 'Priority API access', 'Email support', 'Usage dashboard'],
        stripe_checkout: true,
      },
      {
        id: 'pro',
        name: 'Pro',
        price_usd: PLAN_PRICES_USD.pro,
        quota_tokens: PLAN_QUOTAS.pro,
        description: 'For growing teams with higher volume needs.',
        features: ['500,000 tokens/month', 'Priority API access', 'Slack support', 'Usage analytics', 'Team seats'],
        stripe_checkout: true,
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        price_usd: null,
        quota_tokens: PLAN_QUOTAS.enterprise,
        description: 'Custom limits, SLAs, and dedicated support.',
        features: ['Custom token limits', 'SLA', 'Dedicated support', 'SSO', 'Custom contract'],
        contact_sales: true,
      },
    ],
  });
});

// ---------------------------------------------------------------------------
// Checkout — create Stripe Checkout session
// ---------------------------------------------------------------------------

billingRouter.post('/checkout', tenantAuth, asyncHandler(async (req: Request, res: Response) => {
  const { plan } = req.body as { plan?: string };
  if (!plan || !['starter', 'pro'].includes(plan)) {
    res.status(400).json({ error: 'Invalid plan. Valid options: starter, pro' });
    return;
  }

  const tenant = req.tenant!;
  const appUrl = process.env.APP_URL ?? 'https://narrativereactor.ai';

  const session = await createCheckoutSession({
    tenantId: tenant.id,
    plan: plan as 'starter' | 'pro',
    successUrl: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/billing/upgrade`,
    tenantEmail: tenant.email,
  });

  res.json({ url: session.url, session_id: session.id });
}));

// ---------------------------------------------------------------------------
// Customer Portal — manage existing subscription
// ---------------------------------------------------------------------------

billingRouter.post('/portal', tenantAuth, asyncHandler(async (req: Request, res: Response) => {
  const tenant = req.tenant!;

  if (!tenant.stripe_customer_id) {
    res.status(400).json({ error: 'No Stripe customer associated with this tenant. Subscribe first.' });
    return;
  }

  const appUrl = process.env.APP_URL ?? 'https://narrativereactor.ai';
  const portalSession = await createPortalSession(tenant.stripe_customer_id, `${appUrl}/billing`);
  res.json({ url: portalSession.url });
}));

// ---------------------------------------------------------------------------
// Enterprise contact
// ---------------------------------------------------------------------------

billingRouter.post('/enterprise', tenantAuth, async (req: Request, res: Response) => {
  const { message } = req.body as { message?: string };
  if (!message) {
    res.status(400).json({ error: 'message is required' });
    return;
  }
  const result = await submitEnterpriseContact(req.tenant!.id, message);
  res.json(result);
});

// ---------------------------------------------------------------------------
// Usage — current tenant's quota status (tenant auth only)
// ---------------------------------------------------------------------------

billingRouter.get('/usage', tenantAuth, (req: Request, res: Response) => {
  const t = req.tenant!;
  res.json({
    tenant_id: t.id,
    plan: t.plan,
    quota_tokens: t.quota_tokens,
    used_tokens: t.used_tokens,
    remaining_tokens: Math.max(0, t.quota_tokens - t.used_tokens),
    reset_at: t.reset_at,
    percent_used: Math.min(100, Math.round((t.used_tokens / t.quota_tokens) * 100)),
  });
});

// ---------------------------------------------------------------------------
// Admin: tenant management (behind existing API_KEY auth)
// ---------------------------------------------------------------------------

// Create tenant
billingRouter.post('/tenants', apiKeyAuth, asyncHandler(async (req: Request, res: Response) => {
  const { name, email, plan } = req.body;
  if (!name || !email) {
    res.status(400).json({ error: 'name and email are required' });
    return;
  }
  const { tenant, rawApiKey } = createTenant({ name, email, plan });
  res.status(201).json({
    tenant,
    api_key: rawApiKey,
    warning: 'Store this API key — it will not be shown again.',
  });
}));

// List all tenants
billingRouter.get('/tenants', apiKeyAuth, (_req: Request, res: Response) => {
  const tenants = listTenants();
  res.json({ tenants });
});

// Tenant usage summary
billingRouter.get('/tenants/:id/usage', apiKeyAuth, (req: Request, res: Response) => {
  const { tenant, usageLog } = getTenantUsageSummary((req.params.id as string));
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' });
    return;
  }
  res.json({ tenant, usage_log: usageLog });
});

// Rotate API key
billingRouter.post('/tenants/:id/rotate-key', apiKeyAuth, asyncHandler(async (req: Request, res: Response) => {
  const newKey = rotateApiKey((req.params.id as string));
  res.json({
    api_key: newKey,
    warning: 'Previous API key is now invalid. Store this new key — it will not be shown again.',
  });
}));

// ---------------------------------------------------------------------------
// NR-002: Daily usage sync to Stripe metered billing (admin cron endpoint)
// POST /api/billing/sync-usage
// ---------------------------------------------------------------------------

billingRouter.post('/sync-usage', apiKeyAuth, asyncHandler(async (_req: Request, res: Response) => {
  const result = await syncAllTenantUsageToStripe();
  res.json({
    message: 'Usage sync complete',
    synced: result.synced,
    skipped: result.skipped,
    errors: result.errors,
    results: result.results,
  });
}));

// ---------------------------------------------------------------------------
// Stripe webhook (raw body required — must be mounted separately)
// ---------------------------------------------------------------------------

stripeWebhookRouter.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  asyncHandler(async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    if (!sig) {
      res.status(400).json({ error: 'Missing stripe-signature header' });
      return;
    }

    const result = await handleWebhook(req.body as Buffer, sig);
    res.json({ received: true, ...result });
  }),
);
