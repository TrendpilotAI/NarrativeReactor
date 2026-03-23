/**
 * LinkedIn OAuth2 PKCE Routes — NR-006
 *
 * GET  /api/linkedin/auth         — Returns authorization URL for OAuth2 PKCE flow
 * GET  /api/linkedin/callback     — Exchanges authorization code for tokens
 * GET  /api/linkedin/status       — Check current LinkedIn connection status
 * DELETE /api/linkedin/disconnect — Revoke LinkedIn credentials
 */

import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler';
import { tenantAuth } from '../middleware/tenantAuth';
import {
  generateAuthorizationUrl,
  handleLinkedInCallback,
  getLinkedInCredentials,
  hasValidLinkedInCredentials,
  revokeLinkedInCredentials,
} from '../services/linkedin';

export const linkedInRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/linkedin/auth
// Initiates the LinkedIn OAuth2 PKCE flow for the authenticated tenant.
// Returns the authorization URL to redirect the user to.
// ---------------------------------------------------------------------------

linkedInRouter.get(
  '/auth',
  tenantAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const tenant = req.tenant!;
    const { authorizationUrl, state } = generateAuthorizationUrl(tenant.id);

    res.json({
      authorization_url: authorizationUrl,
      state,
      message: 'Redirect the user to authorization_url to grant LinkedIn publishing access.',
    });
  }),
);

// ---------------------------------------------------------------------------
// GET /api/linkedin/callback
// Handles the redirect back from LinkedIn with the authorization code.
// Exchanges code for tokens and stores them encrypted in SQLite.
// ---------------------------------------------------------------------------

linkedInRouter.get(
  '/callback',
  asyncHandler(async (req: Request, res: Response) => {
    const { code, state, error, error_description } = req.query as Record<string, string>;

    // Handle LinkedIn OAuth error
    if (error) {
      console.error(`[linkedin] OAuth error: ${error} — ${error_description}`);
      const appUrl = process.env.APP_URL ?? 'http://localhost:3401';
      res.redirect(`${appUrl}/settings/integrations?linkedin_error=${encodeURIComponent(error_description ?? error)}`);
      return;
    }

    if (!code || !state) {
      res.status(400).json({ error: 'Missing code or state parameter' });
      return;
    }

    const result = await handleLinkedInCallback(code, state);

    if (!result.success) {
      res.status(400).json({ error: result.error ?? 'OAuth callback failed' });
      return;
    }

    // Redirect to the integrations settings page on success
    const appUrl = process.env.APP_URL ?? 'http://localhost:3401';
    const redirectUrl = `${appUrl}/settings/integrations?linkedin_connected=true`;

    if (req.headers.accept?.includes('application/json')) {
      // API client — return JSON
      res.json({
        success: true,
        tenant_id: result.tenantId,
        member: result.memberInfo ?? {},
        message: 'LinkedIn account connected successfully.',
      });
    } else {
      // Browser redirect flow
      res.redirect(redirectUrl);
    }
  }),
);

// ---------------------------------------------------------------------------
// GET /api/linkedin/status
// Returns the current LinkedIn connection status for the tenant.
// ---------------------------------------------------------------------------

linkedInRouter.get(
  '/status',
  tenantAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const tenant = req.tenant!;
    const creds = getLinkedInCredentials(tenant.id);

    if (!creds) {
      res.json({ connected: false });
      return;
    }

    const isValid = hasValidLinkedInCredentials(tenant.id);

    res.json({
      connected: true,
      valid: isValid,
      expires_at: creds.expiresAt.toISOString(),
      member: creds.memberInfo ?? {},
      expired: !isValid,
    });
  }),
);

// ---------------------------------------------------------------------------
// DELETE /api/linkedin/disconnect
// Revokes and removes LinkedIn credentials for the tenant.
// ---------------------------------------------------------------------------

linkedInRouter.delete(
  '/disconnect',
  tenantAuth,
  asyncHandler(async (req: Request, res: Response) => {
    const tenant = req.tenant!;
    revokeLinkedInCredentials(tenant.id);
    res.json({ success: true, message: 'LinkedIn account disconnected.' });
  }),
);
