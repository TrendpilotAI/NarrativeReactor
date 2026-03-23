/**
 * Minimal JWT implementation using Node.js built-in crypto.
 *
 * We avoid adding jsonwebtoken as a dependency — the token format is simple:
 * HMAC-SHA256 signed, with expiry. Good enough for a single-user dashboard.
 *
 * Token types:
 *   access  — short-lived (default 3600s / 1h), used for API auth
 *   refresh — long-lived (default 604800s / 7d), used only to obtain new access tokens
 */

import crypto from 'crypto';

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
  typ?: 'access' | 'refresh';
  [key: string]: unknown;
}

function getSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.API_KEY;
  if (!secret) {
    throw new Error('JWT_SECRET or API_KEY must be set for dashboard auth');
  }
  return secret;
}

function base64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf) : buf;
  return b.toString('base64url');
}

function base64urlDecode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

/** Shared sign implementation. */
function sign(subject: string, expiresInSeconds: number, extraClaims: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: subject,
      iat: now,
      exp: now + expiresInSeconds,
      ...extraClaims,
    })
  );
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/** Shared verify implementation. */
function verify(token: string): JwtPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');

  const [header, payload, signature] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(`${header}.${payload}`)
    .digest('base64url');

  // Constant-time comparison to prevent timing attacks
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    throw new Error('Invalid token signature');
  }

  const decoded: JwtPayload = JSON.parse(base64urlDecode(payload));

  if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }

  return decoded;
}

// ---------------------------------------------------------------------------
// Access tokens (short-lived — 1h default)
// ---------------------------------------------------------------------------

/**
 * Sign an access JWT token.
 * Default expiry: 3600s (1 hour). Increase via JWT_ACCESS_TTL env var.
 */
export function signJwt(subject: string, expiresInSeconds: number = parseInt(process.env.JWT_ACCESS_TTL ?? '3600', 10)): string {
  return sign(subject, expiresInSeconds, { typ: 'access' });
}

/**
 * Verify and decode a JWT access token. Throws on invalid/expired tokens.
 * Accepts tokens without a `typ` claim for backward-compat with old sessions.
 */
export function verifyJwt(token: string): JwtPayload {
  const decoded = verify(token);
  if (decoded.typ && decoded.typ !== 'access') {
    throw new Error('Expected an access token');
  }
  return decoded;
}

// ---------------------------------------------------------------------------
// Refresh tokens (long-lived — 7 days default)
// ---------------------------------------------------------------------------

/**
 * Sign a refresh token.
 * Default expiry: 604800s (7 days). Configurable via JWT_REFRESH_TTL env var.
 */
export function signRefreshToken(subject: string, expiresInSeconds: number = parseInt(process.env.JWT_REFRESH_TTL ?? '604800', 10)): string {
  return sign(subject, expiresInSeconds, { typ: 'refresh' });
}

/**
 * Verify and decode a refresh token.
 * Throws if the token is invalid, expired, or is not a refresh token.
 */
export function verifyRefreshToken(token: string): JwtPayload {
  const decoded = verify(token);
  if (decoded.typ !== 'refresh') {
    throw new Error('Expected a refresh token');
  }
  return decoded;
}
