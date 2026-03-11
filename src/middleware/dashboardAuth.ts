/**
 * Dashboard Authentication Middleware
 *
 * Protects the static dashboard behind a session cookie (JWT).
 * - /login renders the login form (GET) and handles login (POST)
 * - /logout clears the cookie
 * - All other non-API, non-health routes require a valid session
 *
 * Configuration:
 *   DASHBOARD_PASSWORD — required in production (fail-closed)
 *   JWT_SECRET — optional, falls back to API_KEY
 */

import { Request, Response, NextFunction } from 'express';
import { signJwt, verifyJwt, signRefreshToken, verifyRefreshToken } from '../lib/jwt';
import crypto from 'crypto';

const COOKIE_NAME = 'nr_session';
const REFRESH_COOKIE_NAME = 'nr_refresh';
const ACCESS_MAX_AGE_MS = 60 * 60 * 1000;      // 1h
const REFRESH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7d
/** @deprecated Use ACCESS_MAX_AGE_MS */
const COOKIE_MAX_AGE_MS = ACCESS_MAX_AGE_MS;

function getPassword(): string | null {
  return process.env.DASHBOARD_PASSWORD || null;
}

/**
 * Login page HTML — minimal, self-contained.
 */
function loginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login — NarrativeReactor</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #0f172a; color: #e2e8f0; font-family: 'Inter', system-ui, sans-serif;
           display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem;
            padding: 2rem; width: 100%; max-width: 400px; }
    h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #94a3b8; font-size: 0.875rem; margin-bottom: 1.5rem; }
    label { display: block; font-size: 0.875rem; color: #94a3b8; margin-bottom: 0.5rem; }
    input { width: 100%; padding: 0.625rem 0.75rem; background: #0f172a; border: 1px solid #475569;
            border-radius: 0.5rem; color: #e2e8f0; font-size: 0.9375rem; outline: none; }
    input:focus { border-color: #6366f1; }
    button { width: 100%; margin-top: 1rem; padding: 0.625rem; background: #6366f1; color: white;
             border: none; border-radius: 0.5rem; font-size: 0.9375rem; cursor: pointer; }
    button:hover { background: #4f46e5; }
    .error { background: #7f1d1d; color: #fca5a5; padding: 0.5rem 0.75rem; border-radius: 0.375rem;
             font-size: 0.8125rem; margin-bottom: 1rem; }
  </style>
</head>
<body>
  <form class="card" method="POST" action="/login">
    <h1>🎬 NarrativeReactor</h1>
    <p>Enter your dashboard password to continue.</p>
    ${error ? `<div class="error">${error}</div>` : ''}
    <label for="password">Password</label>
    <input type="password" id="password" name="password" placeholder="••••••••" autofocus required />
    <button type="submit">Sign in</button>
  </form>
</body>
</html>`;
}

/**
 * Handle GET /login — render login form.
 */
export function loginGet(_req: Request, res: Response): void {
  res.type('html').send(loginPage());
}

/**
 * Handle POST /login — validate password, set cookie.
 */
export function loginPost(req: Request, res: Response): void {
  const password = getPassword();

  if (!password) {
    if (process.env.NODE_ENV === 'production') {
      res.status(503).type('html').send(loginPage('Dashboard not configured — DASHBOARD_PASSWORD required'));
      return;
    }
    // Dev: allow any password
    setSessionCookies(res, 'dashboard-user');
    res.redirect('/');
    return;
  }

  const submitted = req.body?.password;
  if (!submitted || typeof submitted !== 'string') {
    res.status(400).type('html').send(loginPage('Password is required'));
    return;
  }

  // Constant-time comparison
  const valid = crypto.timingSafeEqual(
    Buffer.from(submitted.padEnd(256, '\0')),
    Buffer.from(password.padEnd(256, '\0'))
  );

  if (!valid) {
    res.status(401).type('html').send(loginPage('Invalid password'));
    return;
  }

  setSessionCookies(res, 'dashboard-user');
  res.redirect('/');
}

/** Helper — set both access and refresh cookies. */
function setSessionCookies(res: Response, subject: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  const accessToken = signJwt(subject);
  const refreshToken = signRefreshToken(subject);

  const cookieBase = { httpOnly: true, secure: isProd, sameSite: 'lax' as const };
  res.cookie(COOKIE_NAME, accessToken, { ...cookieBase, maxAge: ACCESS_MAX_AGE_MS });
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, { ...cookieBase, maxAge: REFRESH_MAX_AGE_MS });
}

/**
 * Handle POST /auth/refresh — exchange a valid refresh token for a new access token.
 *
 * Reads the refresh token from the `nr_refresh` cookie or the `Authorization: Bearer <token>` header.
 * Returns JSON `{ token }` with the new access token and sets a fresh `nr_session` cookie.
 */
export function refreshSession(req: Request, res: Response): void {
  // Accept from cookie OR Authorization header (for API clients)
  const cookieHeader = req.headers.cookie || '';
  const cookieMatch = cookieHeader.match(new RegExp(`${REFRESH_COOKIE_NAME}=([^;]+)`));
  const authHeader = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : undefined;
  const refreshToken = cookieMatch?.[1] ?? authHeader;

  if (!refreshToken) {
    res.status(401).json({ error: 'Refresh token missing' });
    return;
  }

  let payload: ReturnType<typeof verifyRefreshToken>;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid refresh token';
    res.status(401).json({ error: msg });
    return;
  }

  const newAccessToken = signJwt(payload.sub);
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, newAccessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: ACCESS_MAX_AGE_MS,
  });
  res.json({ token: newAccessToken });
}

/**
 * Handle GET /logout — clear cookie and redirect to login.
 */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME);
  res.clearCookie(REFRESH_COOKIE_NAME);
  res.redirect('/login');
}

/**
 * Middleware to protect dashboard routes.
 * Allows: /login, /logout, /health, /api/*, /webhooks/*
 * Requires valid session cookie for everything else.
 */
export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  // Paths that don't need dashboard auth
  const publicPaths = ['/login', '/logout', '/health', '/favicon.ico', '/auth/me'];
  const publicPrefixes = ['/api/', '/webhooks/', '/docs'];

  if (publicPaths.includes(req.path)) return next();
  if (publicPrefixes.some(p => req.path.startsWith(p))) return next();

  // No password configured in dev = no auth needed
  if (!getPassword() && process.env.NODE_ENV !== 'production') return next();

  // Check cookie
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];

  if (!token) {
    res.redirect('/login');
    return;
  }

  try {
    verifyJwt(token);
    next();
  } catch {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/login');
  }
}
