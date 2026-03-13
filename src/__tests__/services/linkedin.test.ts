/**
 * Tests for NR-006: LinkedIn OAuth2 PKCE Flow
 *
 * Tests:
 *   - generateCodeVerifier / generateCodeChallenge correctness
 *   - generateAuthorizationUrl stores PKCE state in DB
 *   - handleLinkedInCallback — token exchange + storage
 *   - getLinkedInCredentials — encrypted storage/retrieval
 *   - hasValidLinkedInCredentials — expiry check
 *   - revokeLinkedInCredentials
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import { resetDb, getDb } from '../../lib/db';
import { initTenantsSchema } from '../../services/tenants';
import {
  generateCodeVerifier,
  generateCodeChallenge,
  generateAuthorizationUrl,
  handleLinkedInCallback,
  getLinkedInCredentials,
  hasValidLinkedInCredentials,
  revokeLinkedInCredentials,
  initLinkedInSchema,
} from '../../services/linkedin';

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  resetDb();
  initTenantsSchema();
  initLinkedInSchema();
  vi.clearAllMocks();
  // Set required env vars
  process.env.LINKEDIN_CLIENT_ID = 'test_linkedin_client_id';
  process.env.LINKEDIN_CLIENT_SECRET = 'test_linkedin_client_secret';
  process.env.APP_URL = 'http://localhost:3401';
  process.env.TOKEN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
});

afterEach(() => {
  resetDb();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// PKCE helpers
// ---------------------------------------------------------------------------

describe('generateCodeVerifier', () => {
  it('returns a string of length >= 43 and <= 128', () => {
    const verifier = generateCodeVerifier();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(verifier.length).toBeLessThanOrEqual(128);
  });

  it('generates unique verifiers', () => {
    const v1 = generateCodeVerifier();
    const v2 = generateCodeVerifier();
    expect(v1).not.toBe(v2);
  });

  it('contains only URL-safe base64 characters', () => {
    const verifier = generateCodeVerifier();
    expect(verifier).toMatch(/^[A-Za-z0-9\-_]+$/);
  });
});

describe('generateCodeChallenge', () => {
  it('returns a base64url-encoded SHA-256 hash', () => {
    const verifier = generateCodeVerifier();
    const challenge = generateCodeChallenge(verifier);
    expect(challenge).toMatch(/^[A-Za-z0-9\-_]+$/);
  });

  it('is deterministic — same verifier yields same challenge', () => {
    const verifier = generateCodeVerifier();
    expect(generateCodeChallenge(verifier)).toBe(generateCodeChallenge(verifier));
  });

  it('different verifiers yield different challenges', () => {
    const c1 = generateCodeChallenge(generateCodeVerifier());
    const c2 = generateCodeChallenge(generateCodeVerifier());
    expect(c1).not.toBe(c2);
  });

  it('implements S256 correctly (verifiable)', () => {
    // Known-value test
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const expected = crypto
      .createHash('sha256')
      .update(verifier, 'ascii')
      .digest()
      .toString('base64url');
    expect(generateCodeChallenge(verifier)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// generateAuthorizationUrl
// ---------------------------------------------------------------------------

describe('generateAuthorizationUrl', () => {
  it('returns a valid LinkedIn authorization URL', () => {
    const { authorizationUrl, state } = generateAuthorizationUrl('tenant_test_1');

    expect(authorizationUrl).toContain('https://www.linkedin.com/oauth/v2/authorization');
    expect(authorizationUrl).toContain('response_type=code');
    expect(authorizationUrl).toContain(`client_id=${process.env.LINKEDIN_CLIENT_ID}`);
    expect(authorizationUrl).toContain('code_challenge_method=S256');
    expect(authorizationUrl).toContain(`state=${state}`);
    expect(authorizationUrl).toContain('scope=');
  });

  it('includes w_member_social in scopes', () => {
    const { authorizationUrl } = generateAuthorizationUrl('tenant_test_2');
    expect(decodeURIComponent(authorizationUrl)).toContain('w_member_social');
  });

  it('stores PKCE state in linkedin_pkce_state table', () => {
    const { state } = generateAuthorizationUrl('tenant_test_3');

    const db = getDb();
    const row = db.prepare('SELECT * FROM linkedin_pkce_state WHERE state = ?').get(state) as any;

    expect(row).toBeDefined();
    expect(row.tenant_id).toBe('tenant_test_3');
    expect(row.code_verifier).toBeDefined();
    expect(row.code_verifier.length).toBeGreaterThanOrEqual(43);
  });

  it('generates a unique state for each call', () => {
    const { state: s1 } = generateAuthorizationUrl('t1');
    const { state: s2 } = generateAuthorizationUrl('t2');
    expect(s1).not.toBe(s2);
  });

  it('sets expiry to approximately 10 minutes from now', () => {
    const before = new Date();
    const { state } = generateAuthorizationUrl('tenant_expiry_test');
    const after = new Date();

    const db = getDb();
    const row = db.prepare('SELECT expires_at FROM linkedin_pkce_state WHERE state = ?').get(state) as any;
    const expiresAt = new Date(row.expires_at);

    // Should expire in ~10 minutes
    const tenMinutesFromBefore = new Date(before.getTime() + 9.5 * 60 * 1000);
    const tenMinutesFromAfter = new Date(after.getTime() + 10.5 * 60 * 1000);

    expect(expiresAt >= tenMinutesFromBefore).toBe(true);
    expect(expiresAt <= tenMinutesFromAfter).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// handleLinkedInCallback
// ---------------------------------------------------------------------------

describe('handleLinkedInCallback', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns error when state is invalid', async () => {
    const result = await handleLinkedInCallback('code_xyz', 'invalid_state_xyz');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid or expired');
  });

  it('exchanges code for tokens and stores them encrypted', async () => {
    const tenantId = 'tenant_callback_test';
    const { state } = generateAuthorizationUrl(tenantId);

    // Mock LinkedIn token endpoint
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test_access_token_abc123',
          refresh_token: 'test_refresh_token_xyz789',
          expires_in: 3600,
          token_type: 'Bearer',
        }),
      })
      // Mock userinfo endpoint
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sub: 'urn:li:person:test123',
          name: 'Test User',
          email: 'testuser@linkedin.com',
        }),
      });

    const result = await handleLinkedInCallback('auth_code_test', state);

    expect(result.success).toBe(true);
    expect(result.tenantId).toBe(tenantId);
    expect(result.memberInfo?.id).toBe('urn:li:person:test123');
    expect(result.memberInfo?.name).toBe('Test User');

    // Verify tokens stored in DB
    const creds = getLinkedInCredentials(tenantId);
    expect(creds).not.toBeNull();
    expect(creds!.accessToken).toBe('test_access_token_abc123');
    expect(creds!.refreshToken).toBe('test_refresh_token_xyz789');
    expect(creds!.expiresAt).toBeInstanceOf(Date);

    // State should be consumed (one-time use)
    const db = getDb();
    const stateRow = db.prepare('SELECT * FROM linkedin_pkce_state WHERE state = ?').get(state);
    expect(stateRow).toBeUndefined();
  });

  it('returns error when LinkedIn token endpoint fails', async () => {
    const { state } = generateAuthorizationUrl('tenant_fail_test');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error": "invalid_grant", "error_description": "Code expired"}',
    });

    const result = await handleLinkedInCallback('bad_code', state);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Token exchange failed');
  });

  it('does not allow state reuse after successful callback', async () => {
    const tenantId = 'tenant_reuse_test';
    const { state } = generateAuthorizationUrl(tenantId);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'tok_reuse',
          expires_in: 3600,
        }),
      })
      .mockResolvedValueOnce({ ok: false }); // userinfo

    await handleLinkedInCallback('code_first', state);

    // Second attempt with same state should fail
    const result2 = await handleLinkedInCallback('code_second', state);
    expect(result2.success).toBe(false);
    expect(result2.error).toContain('Invalid or expired');
  });
});

// ---------------------------------------------------------------------------
// getLinkedInCredentials + encryption
// ---------------------------------------------------------------------------

describe('getLinkedInCredentials', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  it('returns null for tenant with no credentials', () => {
    const creds = getLinkedInCredentials('no_creds_tenant');
    expect(creds).toBeNull();
  });

  it('stores and retrieves tokens with encryption', async () => {
    const tenantId = 'encryption_test_tenant';
    const { state } = generateAuthorizationUrl(tenantId);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'secret_access_token_!@#$%',
          refresh_token: 'secret_refresh_token_&*(',
          expires_in: 7200,
        }),
      })
      .mockResolvedValueOnce({ ok: false }); // userinfo fails — that's OK

    await handleLinkedInCallback('code_enc', state);

    // Verify DB stores ENCRYPTED data (not plaintext)
    const db = getDb();
    const rawRow = db.prepare('SELECT * FROM linkedin_credentials WHERE tenant_id = ?').get(tenantId) as any;
    expect(rawRow.access_token_enc).not.toBe('secret_access_token_!@#$%');
    expect(rawRow.refresh_token_enc).not.toBe('secret_refresh_token_&*(');

    // But decrypted retrieval should return plaintext
    const creds = getLinkedInCredentials(tenantId);
    expect(creds!.accessToken).toBe('secret_access_token_!@#$%');
    expect(creds!.refreshToken).toBe('secret_refresh_token_&*(');
  });
});

// ---------------------------------------------------------------------------
// hasValidLinkedInCredentials
// ---------------------------------------------------------------------------

describe('hasValidLinkedInCredentials', () => {
  it('returns false when no credentials exist', () => {
    expect(hasValidLinkedInCredentials('ghost_tenant')).toBe(false);
  });

  it('returns true when credentials are not expired', async () => {
    const tenantId = 'valid_creds_tenant';
    const db = getDb();
    const futureExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    const encKey = process.env.TOKEN_ENCRYPTION_KEY!;
    const key = Buffer.from(encKey, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update('tok_valid', 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encAccessToken = Buffer.concat([iv, tag, enc]).toString('base64');

    db.prepare(`
      INSERT INTO linkedin_credentials (tenant_id, access_token_enc, expires_at)
      VALUES (?, ?, ?)
    `).run(tenantId, encAccessToken, futureExpiry);

    expect(hasValidLinkedInCredentials(tenantId)).toBe(true);
  });

  it('returns false when credentials are expired', async () => {
    const tenantId = 'expired_creds_tenant';
    const db = getDb();
    const pastExpiry = new Date(Date.now() - 3600 * 1000).toISOString();
    const encKey = process.env.TOKEN_ENCRYPTION_KEY!;
    const key = Buffer.from(encKey, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update('tok_expired', 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encAccessToken = Buffer.concat([iv, tag, enc]).toString('base64');

    db.prepare(`
      INSERT INTO linkedin_credentials (tenant_id, access_token_enc, expires_at)
      VALUES (?, ?, ?)
    `).run(tenantId, encAccessToken, pastExpiry);

    expect(hasValidLinkedInCredentials(tenantId)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// revokeLinkedInCredentials
// ---------------------------------------------------------------------------

describe('revokeLinkedInCredentials', () => {
  it('removes credentials from DB', async () => {
    const tenantId = 'revoke_test_tenant';
    const db = getDb();
    const futureExpiry = new Date(Date.now() + 3600 * 1000).toISOString();
    const encKey = process.env.TOKEN_ENCRYPTION_KEY!;
    const key = Buffer.from(encKey, 'hex');
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update('tok_revoke', 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encAccessToken = Buffer.concat([iv, tag, enc]).toString('base64');

    db.prepare(`
      INSERT INTO linkedin_credentials (tenant_id, access_token_enc, expires_at)
      VALUES (?, ?, ?)
    `).run(tenantId, encAccessToken, futureExpiry);

    expect(getLinkedInCredentials(tenantId)).not.toBeNull();

    revokeLinkedInCredentials(tenantId);

    expect(getLinkedInCredentials(tenantId)).toBeNull();
    expect(hasValidLinkedInCredentials(tenantId)).toBe(false);
  });

  it('silently succeeds when no credentials exist', () => {
    expect(() => revokeLinkedInCredentials('nobody')).not.toThrow();
  });
});
