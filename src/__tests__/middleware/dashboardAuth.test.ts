import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { loginPost, requireDashboardAuth } from '../../middleware/dashboardAuth';
import { signJwt } from '../../lib/jwt';

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    path: '/',
    headers: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.redirect = vi.fn().mockReturnValue(res);
  res.cookie = vi.fn().mockReturnValue(res);
  res.clearCookie = vi.fn().mockReturnValue(res);
  return res as Response & { [k: string]: ReturnType<typeof vi.fn> };
}

describe('dashboardAuth', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.DASHBOARD_PASSWORD = 'correct-password';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('loginPost', () => {
    it('sets cookie and redirects on correct password', () => {
      const req = makeReq({ body: { password: 'correct-password' } });
      const res = makeRes();
      loginPost(req, res);
      expect(res.cookie).toHaveBeenCalledWith('nr_session', expect.any(String), expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
      }));
      expect(res.redirect).toHaveBeenCalledWith('/');
    });

    it('rejects wrong password with 401', () => {
      const req = makeReq({ body: { password: 'wrong' } });
      const res = makeRes();
      loginPost(req, res);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.cookie).not.toHaveBeenCalled();
    });

    it('rejects missing password with 400', () => {
      const req = makeReq({ body: {} });
      const res = makeRes();
      loginPost(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('returns 503 in production without DASHBOARD_PASSWORD', () => {
      delete process.env.DASHBOARD_PASSWORD;
      process.env.NODE_ENV = 'production';
      const req = makeReq({ body: { password: 'anything' } });
      const res = makeRes();
      loginPost(req, res);
      expect(res.status).toHaveBeenCalledWith(503);
    });

    it('allows any password in dev when DASHBOARD_PASSWORD not set', () => {
      delete process.env.DASHBOARD_PASSWORD;
      process.env.NODE_ENV = 'development';
      const req = makeReq({ body: { password: 'anything' } });
      const res = makeRes();
      loginPost(req, res);
      expect(res.cookie).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/');
    });
  });

  describe('requireDashboardAuth', () => {
    it('allows /health without auth', () => {
      const next = vi.fn();
      const req = makeReq({ path: '/health' });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).toHaveBeenCalled();
    });

    it('allows /api/* without auth', () => {
      const next = vi.fn();
      const req = makeReq({ path: '/api/generate' });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).toHaveBeenCalled();
    });

    it('allows /login without auth', () => {
      const next = vi.fn();
      const req = makeReq({ path: '/login' });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).toHaveBeenCalled();
    });

    it('redirects to /login when no cookie present', () => {
      const next = vi.fn();
      const req = makeReq({ path: '/', headers: {} });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('allows access with valid session cookie', () => {
      const token = signJwt('dashboard-user');
      const next = vi.fn();
      const req = makeReq({ path: '/', headers: { cookie: `nr_session=${token}` } });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).toHaveBeenCalled();
    });

    it('redirects with invalid/expired cookie', () => {
      const next = vi.fn();
      const req = makeReq({ path: '/', headers: { cookie: 'nr_session=garbage.token.value' } });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalledWith('nr_session');
      expect(res.redirect).toHaveBeenCalledWith('/login');
    });

    it('skips auth in dev when no DASHBOARD_PASSWORD', () => {
      delete process.env.DASHBOARD_PASSWORD;
      process.env.NODE_ENV = 'development';
      const next = vi.fn();
      const req = makeReq({ path: '/', headers: {} });
      const res = makeRes();
      requireDashboardAuth(req, res, next as NextFunction);
      expect(next).toHaveBeenCalled();
    });
  });
});
