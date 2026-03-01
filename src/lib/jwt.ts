/**
 * Minimal JWT implementation using Node.js built-in crypto.
 *
 * We avoid adding jsonwebtoken as a dependency — the token format is simple:
 * HMAC-SHA256 signed, with expiry. Good enough for a single-user dashboard.
 */

import crypto from 'crypto';

interface JwtPayload {
  sub: string;
  iat: number;
  exp: number;
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

/**
 * Sign a JWT token.
 */
export function signJwt(subject: string, expiresInSeconds: number = 86400): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      sub: subject,
      iat: now,
      exp: now + expiresInSeconds,
    })
  );
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(`${header}.${payload}`)
    .digest('base64url');

  return `${header}.${payload}.${signature}`;
}

/**
 * Verify and decode a JWT token. Throws on invalid/expired tokens.
 */
export function verifyJwt(token: string): JwtPayload {
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
