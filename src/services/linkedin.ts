/**
 * LinkedIn OAuth2 PKCE Flow — NR-006
 *
 * Implements LinkedIn OAuth2 with PKCE (Proof Key for Code Exchange) for native
 * publishing authorization. Stores access/refresh tokens per tenant in SQLite,
 * encrypted with an environment-derived key.
 *
 * Flow:
 *   1. GET /api/linkedin/auth         → returns { authorizationUrl }
 *   2. User grants access on LinkedIn
 *   3. GET /api/linkedin/callback     → exchanges code + verifier for tokens
 *
 * PKCE: code_verifier generated in step 1, code_challenge derived from it,
 * stored server-side in `linkedin_pkce_state` table keyed by `state` param.
 */

import crypto from 'crypto';
import { getDb } from '../lib/db';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const LINKEDIN_AUTHORIZE_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';

// Scopes for publishing
const SCOPES = ['openid', 'profile', 'email', 'w_member_social'].join(' ');

function getLinkedInClientId(): string {
  const id = process.env.LINKEDIN_CLIENT_ID;
  if (!id) throw new Error('LINKEDIN_CLIENT_ID env var not set');
  return id;
}

function getLinkedInClientSecret(): string {
  const secret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!secret) throw new Error('LINKEDIN_CLIENT_SECRET env var not set');
  return secret;
}

function getRedirectUri(): string {
  const base = process.env.APP_URL ?? 'http://localhost:3401';
  return `${base}/api/linkedin/callback`;
}

// ---------------------------------------------------------------------------
// Token encryption — AES-256-GCM using an environment-derived key
// ---------------------------------------------------------------------------

/** Derive a 32-byte AES key from the environment — stable across restarts */
function getEncryptionKey(): Buffer {
  const keyHex = process.env.TOKEN_ENCRYPTION_KEY;
  if (keyHex && keyHex.length === 64) {
    return Buffer.from(keyHex, 'hex');
  }
  // Fall back to deriving from API_KEY or a fixed seed (dev only)
  const seed = process.env.API_KEY ?? 'narrativereactor-linkedin-dev-key';
  return crypto.scryptSync(seed, 'linkedin-token-salt-v1', 32);
}

function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12 bytes) || tag(16 bytes) || ciphertext — all base64-encoded together
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(encoded: string): string {
  const data = Buffer.from(encoded, 'base64');
  const key = getEncryptionKey();
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export function initLinkedInSchema(): void {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS linkedin_credentials (
      tenant_id          TEXT PRIMARY KEY,
      access_token_enc   TEXT NOT NULL,       -- encrypted
      refresh_token_enc  TEXT,                -- encrypted (may be null)
      expires_at         TEXT NOT NULL,       -- ISO timestamp
      linkedin_member_id TEXT,               -- LinkedIn member URN (from /userinfo)
      linkedin_name      TEXT,               -- Display name
      linkedin_email     TEXT,               -- Email from LinkedIn
      created_at         TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Ephemeral PKCE state table — cleared on callback or expiry
    CREATE TABLE IF NOT EXISTS linkedin_pkce_state (
      state          TEXT PRIMARY KEY,       -- random state param
      tenant_id      TEXT NOT NULL,
      code_verifier  TEXT NOT NULL,          -- PKCE verifier (server-side only)
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at     TEXT NOT NULL           -- 10 minutes from creation
    );

    CREATE INDEX IF NOT EXISTS idx_linkedin_pkce_expires ON linkedin_pkce_state(expires_at);
  `);
}

// Run schema init on module load
initLinkedInSchema();

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

/** Generate a cryptographically random code_verifier (43–128 chars, URL-safe) */
export function generateCodeVerifier(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/** Derive code_challenge = BASE64URL(SHA-256(code_verifier)) */
export function generateCodeChallenge(codeVerifier: string): string {
  return crypto
    .createHash('sha256')
    .update(codeVerifier, 'ascii')
    .digest()
    .toString('base64url');
}

/** Generate a random state parameter */
function generateState(): string {
  return crypto.randomBytes(24).toString('hex');
}

// ---------------------------------------------------------------------------
// Step 1: Generate authorization URL
// ---------------------------------------------------------------------------

export interface AuthUrlResult {
  authorizationUrl: string;
  state: string;
}

/**
 * Generate LinkedIn OAuth2 authorization URL with PKCE.
 * Stores code_verifier + state in DB (expires in 10 minutes).
 */
export function generateAuthorizationUrl(tenantId: string): AuthUrlResult {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const state = generateState();

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  // Store PKCE state server-side
  getDb().prepare(`
    INSERT OR REPLACE INTO linkedin_pkce_state (state, tenant_id, code_verifier, created_at, expires_at)
    VALUES (?, ?, ?, datetime('now'), ?)
  `).run(state, tenantId, codeVerifier, expiresAt);

  // Clean up expired states
  getDb().prepare(`DELETE FROM linkedin_pkce_state WHERE expires_at < datetime('now')`).run();

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: getLinkedInClientId(),
    redirect_uri: getRedirectUri(),
    state,
    scope: SCOPES,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });

  const authorizationUrl = `${LINKEDIN_AUTHORIZE_URL}?${params.toString()}`;

  return { authorizationUrl, state };
}

// ---------------------------------------------------------------------------
// Step 2: Exchange authorization code for tokens
// ---------------------------------------------------------------------------

export interface LinkedInTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  memberInfo?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export interface CallbackResult {
  success: boolean;
  tenantId: string;
  memberInfo?: LinkedInTokens['memberInfo'];
  error?: string;
}

/**
 * Handle the OAuth callback: validate state, exchange code, store tokens.
 */
export async function handleLinkedInCallback(
  code: string,
  state: string,
): Promise<CallbackResult> {
  const db = getDb();

  // Validate and consume the PKCE state
  const pkceRow = db.prepare(`
    SELECT * FROM linkedin_pkce_state
    WHERE state = ? AND expires_at > datetime('now')
  `).get(state) as { tenant_id: string; code_verifier: string } | undefined;

  if (!pkceRow) {
    return { success: false, tenantId: '', error: 'Invalid or expired OAuth state parameter' };
  }

  const { tenant_id: tenantId, code_verifier: codeVerifier } = pkceRow;

  // Delete the used state immediately (one-time use)
  db.prepare('DELETE FROM linkedin_pkce_state WHERE state = ?').run(state);

  // Exchange code for tokens
  let tokens: LinkedInTokens;
  try {
    tokens = await exchangeCodeForTokens(code, codeVerifier);
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[linkedin] Token exchange failed for tenant ${tenantId}: ${errMsg}`);
    return { success: false, tenantId, error: `Token exchange failed: ${errMsg}` };
  }

  // Persist tokens (encrypted)
  persistTokens(tenantId, tokens);

  console.log(`[linkedin] Credentials stored for tenant ${tenantId} (member: ${tokens.memberInfo?.id ?? 'unknown'})`);
  return { success: true, tenantId, memberInfo: tokens.memberInfo };
}

/**
 * Exchange authorization code for access/refresh tokens via LinkedIn API.
 */
async function exchangeCodeForTokens(code: string, codeVerifier: string): Promise<LinkedInTokens> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: getRedirectUri(),
    client_id: getLinkedInClientId(),
    client_secret: getLinkedInClientSecret(),
    code_verifier: codeVerifier,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LinkedIn token exchange HTTP ${response.status}: ${body}`);
  }

  const data = await response.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!data.access_token) {
    throw new Error('No access_token in LinkedIn response');
  }

  const expiresIn = data.expires_in ?? 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000);

  // Fetch member info from LinkedIn
  const memberInfo = await fetchLinkedInMemberInfo(data.access_token);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    memberInfo,
  };
}

/**
 * Fetch basic member info from LinkedIn OpenID Connect userinfo endpoint.
 */
async function fetchLinkedInMemberInfo(accessToken: string): Promise<LinkedInTokens['memberInfo']> {
  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return undefined;

    const data = await res.json() as {
      sub?: string;
      name?: string;
      email?: string;
      given_name?: string;
      family_name?: string;
    };

    return {
      id: data.sub ?? '',
      name: data.name ?? ([data.given_name, data.family_name].filter(Boolean).join(' ') || undefined),
      email: data.email,
    };
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Token persistence
// ---------------------------------------------------------------------------

function persistTokens(tenantId: string, tokens: LinkedInTokens): void {
  const encAccessToken = encrypt(tokens.accessToken);
  const encRefreshToken = tokens.refreshToken ? encrypt(tokens.refreshToken) : null;
  const now = new Date().toISOString();

  getDb().prepare(`
    INSERT OR REPLACE INTO linkedin_credentials
      (tenant_id, access_token_enc, refresh_token_enc, expires_at,
       linkedin_member_id, linkedin_name, linkedin_email, created_at, updated_at)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    tenantId,
    encAccessToken,
    encRefreshToken,
    tokens.expiresAt.toISOString(),
    tokens.memberInfo?.id ?? null,
    tokens.memberInfo?.name ?? null,
    tokens.memberInfo?.email ?? null,
    now,
    now,
  );
}

// ---------------------------------------------------------------------------
// Token retrieval (decrypted)
// ---------------------------------------------------------------------------

export interface LinkedInCredentials {
  tenantId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  memberInfo?: {
    id: string;
    name?: string;
    email?: string;
  };
}

export function getLinkedInCredentials(tenantId: string): LinkedInCredentials | null {
  const row = getDb().prepare(`
    SELECT * FROM linkedin_credentials WHERE tenant_id = ?
  `).get(tenantId) as {
    tenant_id: string;
    access_token_enc: string;
    refresh_token_enc: string | null;
    expires_at: string;
    linkedin_member_id: string | null;
    linkedin_name: string | null;
    linkedin_email: string | null;
  } | undefined;

  if (!row) return null;

  try {
    return {
      tenantId: row.tenant_id,
      accessToken: decrypt(row.access_token_enc),
      refreshToken: row.refresh_token_enc ? decrypt(row.refresh_token_enc) : undefined,
      expiresAt: new Date(row.expires_at),
      memberInfo: row.linkedin_member_id
        ? {
            id: row.linkedin_member_id,
            name: row.linkedin_name ?? undefined,
            email: row.linkedin_email ?? undefined,
          }
        : undefined,
    };
  } catch (err) {
    console.error(`[linkedin] Failed to decrypt credentials for tenant ${tenantId}:`, err);
    return null;
  }
}

/**
 * Check if a tenant has valid (non-expired) LinkedIn credentials.
 */
export function hasValidLinkedInCredentials(tenantId: string): boolean {
  const creds = getLinkedInCredentials(tenantId);
  if (!creds) return false;
  return creds.expiresAt > new Date();
}

/**
 * Revoke LinkedIn credentials for a tenant (disconnect).
 */
export function revokeLinkedInCredentials(tenantId: string): void {
  getDb().prepare('DELETE FROM linkedin_credentials WHERE tenant_id = ?').run(tenantId);
}
