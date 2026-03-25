/**
 * Tests: Dashboard Auth middleware
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { loginGet, loginPost, logout, requireDashboardAuth } from '../../middleware/dashboardAuth';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    body: {},
    path: '/',
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const send = vi.fn().mockReturnThis();
  const type = vi.fn().mockReturnThis();
  const redirect = vi.fn();
  const cookie = vi.fn();
  const clearCookie = vi.fn();
  const status = vi.fn().mockReturnThis();
  const res = { json, send, type, redirect, cookie, clearCookie, status } as unknown as Response;
  return { res, json, send, type, redirect, cookie, clearCookie, status };
}

const makeNext = () => vi.fn() as unknown as NextFunction;

describe('Dashboard Auth Middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.API_KEY = 'test-api-key';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('loginGet', () => {
    it('returns HTML login page', () => {
      const req = makeReq();
      const { res, send, type } = makeRes();
      loginGet(req, res);
      expect(type).toHaveBeenCalledWith('html');
      expect(send).toHaveBeenCalled();
      const html = (send as any).mock.calls[0][0] as string;
      expect(html).toContain('NarrativeReactor');
    });
  });

  describe('loginPost', () => {
    it('redirects in dev when no password set', () => {
      delete process.env.DASHBOARD_PASSWORD;
      process.env.NODE_ENV = 'development';
      const req = makeReq({ body: { password: 'anything' } });
      const { res, redirect, cookie } = makeRes();
      loginPost(req, res);
      expect(cookie).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith('/');
    });

    it('returns 503 in production when no DASHBOARD_PASSWORD', () => {
      delete process.env.DASHBOARD_PASSWORD;
      process.env.NODE_ENV = 'production';
      const req = makeReq({ body: {} });
      const { res, status, send } = makeRes();
      loginPost(req, res);
      expect(status).toHaveBeenCalledWith(503);
    });

    it('returns 400 when password field is missing', () => {
      process.env.DASHBOARD_PASSWORD = 'secret123';
      const req = makeReq({ body: {} });
      const { res, status } = makeRes();
      loginPost(req, res);
      expect(status).toHaveBeenCalledWith(400);
    });

    it('returns 401 for wrong password', () => {
      process.env.DASHBOARD_PASSWORD = 'correct-password';
      const req = makeReq({ body: { password: 'wrong-password' } });
      const { res, status } = makeRes();
      loginPost(req, res);
      expect(status).toHaveBeenCalledWith(401);
    });

    it('sets cookie and redirects for correct password', () => {
      process.env.DASHBOARD_PASSWORD = 'good-password';
      const req = makeReq({ body: { password: 'good-password' } });
      const { res, cookie, redirect } = makeRes();
      loginPost(req, res);
      expect(cookie).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('logout', () => {
    it('clears cookie and redirects to /login', () => {
      const req = makeReq();
      const { res, clearCookie, redirect } = makeRes();
      logout(req, res);
      expect(clearCookie).toHaveBeenCalled();
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });

  describe('requireDashboardAuth', () => {
    it('allows /login path through', () => {
      process.env.DASHBOARD_PASSWORD = 'secret';
      const req = makeReq({ path: '/login', headers: {} });
      const { res } = makeRes();
      const next = makeNext();
      requireDashboardAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows /api/ paths through', () => {
      process.env.DASHBOARD_PASSWORD = 'secret';
      const req = makeReq({ path: '/api/pipeline', headers: {} });
      const { res } = makeRes();
      const next = makeNext();
      requireDashboardAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows /health through', () => {
      process.env.DASHBOARD_PASSWORD = 'secret';
      const req = makeReq({ path: '/health', headers: {} });
      const { res } = makeRes();
      const next = makeNext();
      requireDashboardAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('redirects to /login when no cookie and password is set', () => {
      process.env.DASHBOARD_PASSWORD = 'secret';
      const req = makeReq({ path: '/dashboard', headers: {} });
      const { res, redirect } = makeRes();
      requireDashboardAuth(req, res, makeNext());
      expect(redirect).toHaveBeenCalledWith('/login');
    });

    it('allows through in dev when no DASHBOARD_PASSWORD', () => {
      delete process.env.DASHBOARD_PASSWORD;
      process.env.NODE_ENV = 'development';
      const req = makeReq({ path: '/dashboard', headers: {} });
      const { res } = makeRes();
      const next = makeNext();
      requireDashboardAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('allows request with valid JWT cookie', async () => {
      process.env.DASHBOARD_PASSWORD = 'secret';
      const { signJwt } = await import('../../lib/jwt');
      const token = signJwt('dashboard-user');
      const req = makeReq({
        path: '/dashboard',
        headers: { cookie: `nr_session=${token}` },
      });
      const { res } = makeRes();
      const next = makeNext();
      requireDashboardAuth(req, res, next);
      expect(next).toHaveBeenCalled();
    });

    it('redirects with invalid JWT cookie', () => {
      process.env.DASHBOARD_PASSWORD = 'secret';
      const req = makeReq({
        path: '/dashboard',
        headers: { cookie: 'nr_session=invalid-token-here' },
      });
      const { res, redirect } = makeRes();
      requireDashboardAuth(req, res, makeNext());
      expect(redirect).toHaveBeenCalledWith('/login');
    });
  });
});
