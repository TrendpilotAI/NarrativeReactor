/**
 * Stripe billing service — Checkout sessions, webhook handling, plan management.
 */

import Stripe from 'stripe';
import {
  Plan,
  PLAN_QUOTAS,
  getTenantByStripeCustomer,
  getTenantByStripeSubscription,
  getTenantById,
  upgradeTenantPlan,
} from './tenants';
import { handleInvoiceUpcoming } from './meteredBilling';

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key, { apiVersion: '2026-02-25.clover' });
}

// ---------------------------------------------------------------------------
// Plan → Stripe Price ID mapping (set via env vars)
// ---------------------------------------------------------------------------

export interface PlanConfig {
  name: string;
  priceId: string | undefined;
  tokens: number;
  usdPerMonth: number;
}

export const PLAN_CONFIG: Record<Exclude<Plan, 'free' | 'enterprise'>, PlanConfig> = {
  starter: {
    name: 'NarrativeReactor Starter',
    priceId: process.env.STRIPE_PRICE_STARTER,
    tokens: PLAN_QUOTAS.starter,
    usdPerMonth: 49,
  },
  pro: {
    name: 'NarrativeReactor Pro',
    priceId: process.env.STRIPE_PRICE_PRO,
    tokens: PLAN_QUOTAS.pro,
    usdPerMonth: 149,
  },
};

// ---------------------------------------------------------------------------
// Checkout session
// ---------------------------------------------------------------------------

export interface CheckoutSessionOptions {
  tenantId: string;
  plan: 'starter' | 'pro';
  successUrl: string;
  cancelUrl: string;
  tenantEmail?: string;
}

export async function createCheckoutSession(opts: CheckoutSessionOptions): Promise<Stripe.Checkout.Session> {
  const stripe = getStripe();
  const config = PLAN_CONFIG[opts.plan];

  if (!config.priceId) {
    throw new Error(`STRIPE_PRICE_${opts.plan.toUpperCase()} env var not set — cannot create checkout session`);
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: config.priceId, quantity: 1 }],
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.tenantEmail,
    metadata: {
      tenant_id: opts.tenantId,
      plan: opts.plan,
    },
    subscription_data: {
      metadata: {
        tenant_id: opts.tenantId,
        plan: opts.plan,
      },
    },
    allow_promotion_codes: true,
  });

  return session;
}

// ---------------------------------------------------------------------------
// Customer portal (manage existing subscription)
// ---------------------------------------------------------------------------

export async function createPortalSession(stripeCustomerId: string, returnUrl: string): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripe();
  return stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: returnUrl,
  });
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

export interface WebhookResult {
  handled: boolean;
  event: string;
  details?: string;
}

const HANDLED_EVENTS: Stripe.Event.Type[] = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
  'invoice.upcoming',
];

export async function handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookResult> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Webhook signature verification failed: ${msg}`);
  }

  console.log(`[billing] Stripe webhook: ${event.type} (${event.id})`);

  if (!HANDLED_EVENTS.includes(event.type)) {
    return { handled: false, event: event.type, details: 'event not handled' };
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      await handleCheckoutCompleted(session);
      return { handled: true, event: event.type, details: `tenant=${session.metadata?.tenant_id}` };
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionUpdated(sub);
      return { handled: true, event: event.type, details: `sub=${sub.id}` };
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await handleSubscriptionDeleted(sub);
      return { handled: true, event: event.type, details: `sub=${sub.id}` };
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice;
      console.log(`[billing] Payment succeeded: invoice=${invoice.id} customer=${invoice.customer}`);
      return { handled: true, event: event.type };
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      console.warn(`[billing] Payment FAILED: invoice=${invoice.id} customer=${invoice.customer}`);
      // Optionally deactivate tenant on repeated failures — handled by subscription.deleted
      return { handled: true, event: event.type };
    }

    case 'invoice.upcoming': {
      // Finalize usage before Stripe invoices — report token usage via metered billing API
      const upcomingInvoice = event.data.object as Stripe.UpcomingInvoice;
      const upcomingResult = await handleInvoiceUpcoming(upcomingInvoice);
      return {
        handled: upcomingResult.handled,
        event: event.type,
        details: upcomingResult.tenantId
          ? `tenant=${upcomingResult.tenantId} tokens=${upcomingResult.tokensReported ?? 0}`
          : upcomingResult.error,
      };
    }

    default:
      return { handled: false, event: event.type };
  }
}

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  const tenantId = session.metadata?.tenant_id;
  const plan = session.metadata?.plan as Plan | undefined;

  if (!tenantId || !plan) {
    console.warn('[billing] checkout.session.completed: missing tenant_id or plan in metadata');
    return;
  }

  const tenant = getTenantById(tenantId);
  if (!tenant) {
    console.warn(`[billing] checkout.session.completed: tenant ${tenantId} not found`);
    return;
  }

  const stripeCustomerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? undefined;
  const stripeSubId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? undefined;

  upgradeTenantPlan(tenantId, plan, stripeCustomerId, stripeSubId);
  console.log(`[billing] Tenant ${tenantId} upgraded to ${plan} (customer=${stripeCustomerId})`);
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const tenantId = sub.metadata?.tenant_id;
  if (!tenantId) {
    // Try lookup by customer ID
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    const tenant = getTenantByStripeCustomer(customerId);
    if (!tenant) {
      console.warn(`[billing] subscription.updated: cannot find tenant for customer ${customerId}`);
      return;
    }
    // Determine plan from price ID
    const plan = planFromSubscription(sub);
    if (plan) upgradeTenantPlan(tenant.id, plan, customerId, sub.id);
    return;
  }

  const plan = planFromSubscription(sub);
  if (plan) {
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    upgradeTenantPlan(tenantId, plan, customerId, sub.id);
    console.log(`[billing] Tenant ${tenantId} plan updated to ${plan}`);
  }
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const tenant = getTenantByStripeCustomer(customerId) ?? getTenantByStripeSubscription(sub.id);
  if (!tenant) {
    console.warn(`[billing] subscription.deleted: cannot find tenant for customer ${customerId}`);
    return;
  }
  // Downgrade to free (not deactivate) — they lose premium quota but can still use free tier
  upgradeTenantPlan(tenant.id, 'free');
  console.log(`[billing] Tenant ${tenant.id} downgraded to free (subscription cancelled)`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function planFromSubscription(sub: Stripe.Subscription): Plan | null {
  const item = sub.items?.data?.[0];
  const priceId = item?.price?.id;
  if (!priceId) return null;

  if (priceId === process.env.STRIPE_PRICE_STARTER) return 'starter';
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'pro';

  // Check nickname/metadata as fallback
  const nickname = (item?.price?.nickname ?? '').toLowerCase();
  if (nickname.includes('starter')) return 'starter';
  if (nickname.includes('pro')) return 'pro';
  if (nickname.includes('enterprise')) return 'enterprise';

  return null;
}

// ---------------------------------------------------------------------------
// Enterprise contact flow (no Stripe — manual)
// ---------------------------------------------------------------------------

export interface EnterpriseContactResult {
  submitted: boolean;
  message: string;
}

export async function submitEnterpriseContact(tenantId: string, message: string): Promise<EnterpriseContactResult> {
  // In a real system this would send an email / create a CRM record
  console.log(`[billing] Enterprise inquiry from tenant ${tenantId}: ${message}`);
  return {
    submitted: true,
    message: 'Thank you! Our team will be in touch within 1 business day.',
  };
}
