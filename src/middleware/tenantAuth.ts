/**
 * Tenant API key authentication + quota enforcement middleware.
 *
 * Usage:
 *   app.use('/api/v2', tenantAuth, quotaGuard, ...routes);
 *
 * Sets req.tenant on successful auth.
 * Returns 401 on invalid key, 429 on quota exceeded.
 */

import { Request, Response, NextFunction } from 'express';
import { validateApiKey, checkQuota, remainingTokens, Tenant } from '../services/tenants';

// Extend Express Request to carry tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

// ---------------------------------------------------------------------------
// Smart Auth middleware — tenant key with quota OR admin API key fallback
// ---------------------------------------------------------------------------

/**
 * smartAuth — dual-mode auth for pipeline routes:
 *   1. If X-API-Key matches a tenant → enforce quota, set req.tenant
 *   2. If X-API-Key matches process.env.API_KEY → admin bypass (no quota)
 *   3. Otherwise → 401
 *
 * Usage:
 *   app.use('/api/pipeline', smartAuth, pipelineRoutes);
 */
export function smartAuth(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.headers['x-api-key'] as string | undefined;

  if (rawKey) {
    // Try tenant API key first
    const tenant = validateApiKey(rawKey);
    if (tenant) {
      req.tenant = tenant;

      // Enforce per-tenant quota
      if (!checkQuota(tenant)) {
        const remaining = remainingTokens(tenant);
        const resetDate = new Date(tenant.reset_at).toLocaleDateString('en-US', {
          year: 'numeric', month: 'long', day: 'numeric',
        });

        res.status(429).json({
          error: 'Quota exceeded',
          code: 'QUOTA_EXCEEDED',
          plan: tenant.plan,
          quota_tokens: tenant.quota_tokens,
          used_tokens: tenant.used_tokens,
          remaining_tokens: remaining,
          reset_at: tenant.reset_at,
          upgrade_url: `${process.env.APP_URL ?? 'https://narrativereactor.ai'}/billing/upgrade`,
          message: [
            `You've used all ${tenant.quota_tokens.toLocaleString()} tokens on the ${tenant.plan} plan.`,
            `Your quota resets on ${resetDate}.`,
            `Upgrade your plan to continue: ${process.env.APP_URL ?? 'https://narrativereactor.ai'}/billing/upgrade`,
          ].join(' '),
        });
        return;
      }

      // Expose quota headers to client for awareness
      res.setHeader('X-RateLimit-Quota', tenant.quota_tokens);
      res.setHeader('X-RateLimit-Remaining', remainingTokens(tenant));
      res.setHeader('X-RateLimit-Reset', tenant.reset_at);
      next();
      return;
    }

    // Fall back to admin API key (backward compatibility — no quota enforcement)
    const adminKey = process.env.API_KEY;
    if (adminKey && rawKey === adminKey) {
      next();
      return;
    }
  }

  res.status(401).json({
    error: 'Invalid or missing API key',
    hint: 'Provide a valid NarrativeReactor tenant API key or admin key in the X-API-Key header.',
  });
}

// ---------------------------------------------------------------------------
// Auth middleware — validates X-API-Key header against tenant DB
// ---------------------------------------------------------------------------

export function tenantAuth(req: Request, res: Response, next: NextFunction): void {
  const rawKey = req.headers['x-api-key'] as string | undefined;

  if (!rawKey) {
    res.status(401).json({
      error: 'Missing API key',
      hint: 'Provide your NarrativeReactor API key in the X-API-Key header.',
    });
    return;
  }

  const tenant = validateApiKey(rawKey);
  if (!tenant) {
    res.status(401).json({
      error: 'Invalid or inactive API key',
      hint: 'Check your API key or contact support.',
    });
    return;
  }

  req.tenant = tenant;
  next();
}

// ---------------------------------------------------------------------------
// Quota guard — must run after tenantAuth
// ---------------------------------------------------------------------------

export function quotaGuard(req: Request, res: Response, next: NextFunction): void {
  const tenant = req.tenant;
  if (!tenant) {
    // tenantAuth wasn't applied — fail closed
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (!checkQuota(tenant)) {
    const remaining = remainingTokens(tenant);
    const resetDate = new Date(tenant.reset_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    res.status(429).json({
      error: 'Quota exceeded',
      code: 'QUOTA_EXCEEDED',
      plan: tenant.plan,
      quota_tokens: tenant.quota_tokens,
      used_tokens: tenant.used_tokens,
      remaining_tokens: remaining,
      reset_at: tenant.reset_at,
      upgrade_url: `${process.env.APP_URL ?? 'https://narrativereactor.ai'}/billing/upgrade`,
      message: [
        `You've used all ${tenant.quota_tokens.toLocaleString()} tokens on the ${tenant.plan} plan.`,
        `Your quota resets on ${resetDate}.`,
        `Upgrade your plan to continue: ${process.env.APP_URL ?? 'https://narrativereactor.ai'}/billing/upgrade`,
      ].join(' '),
    });
    return;
  }

  // Attach quota info to response headers for client awareness
  res.setHeader('X-RateLimit-Quota', tenant.quota_tokens);
  res.setHeader('X-RateLimit-Remaining', remainingTokens(tenant));
  res.setHeader('X-RateLimit-Reset', tenant.reset_at);

  next();
}


