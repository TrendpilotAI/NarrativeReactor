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
import { signJwt, verifyJwt } from '../lib/jwt';
import crypto from 'crypto';

const COOKIE_NAME = 'nr_session';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h

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
    const token = signJwt('dashboard-user');
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
    });
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

  const token = signJwt('dashboard-user');
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE_MS,
  });
  res.redirect('/');
}

/**
 * Handle GET /logout — clear cookie and redirect to login.
 */
export function logout(_req: Request, res: Response): void {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/login');
}

/**
 * Middleware to protect dashboard routes.
 * Allows: /login, /logout, /health, /api/*, /webhooks/*
 * Requires valid session cookie for everything else.
 */
export function requireDashboardAuth(req: Request, res: Response, next: NextFunction): void {
  // Paths that don't need dashboard auth
  const publicPaths = ['/login', '/logout', '/health', '/favicon.ico'];
  const publicPrefixes = ['/api/', '/webhooks/'];

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
