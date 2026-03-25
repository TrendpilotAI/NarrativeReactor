/**
 * Tests: Tenant Auth + Quota Guard middleware
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { tenantAuth, quotaGuard, smartAuth } from '../../middleware/tenantAuth';

// Mock tenants service
vi.mock('../../services/tenants', () => ({
  validateApiKey: vi.fn(),
  checkQuota: vi.fn(),
  remainingTokens: vi.fn(),
}));

import { validateApiKey, checkQuota, remainingTokens } from '../../services/tenants';

const mockTenant = {
  id: 'tenant-1',
  name: 'Test Tenant',
  email: 'test@example.com',
  plan: 'starter' as const,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  api_key_hash: 'hashed',
  quota_tokens: 100_000,
  used_tokens: 10_000,
  reset_at: '2026-12-01T00:00:00.000Z',
  active: 1 as const,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

function makeReq(headers: Record<string, string> = {}): Request {
  return {
    headers,
    tenant: undefined,
  } as unknown as Request;
}

function makeRes() {
  const json = vi.fn();
  const setHeader = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  const res = { status, json, setHeader } as unknown as Response;
  return { res, status, json, setHeader };
}

const makeNext = () => vi.fn() as unknown as NextFunction;

describe('tenantAuth middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with 401 when no API key', () => {
    const req = makeReq({});
    const { res, status } = makeRes();
    tenantAuth(req, res, makeNext());
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects with 401 when API key is invalid', () => {
    vi.mocked(validateApiKey).mockReturnValue(null);
    const req = makeReq({ 'x-api-key': 'bad-key' });
    const { res, status } = makeRes();
    tenantAuth(req, res, makeNext());
    expect(status).toHaveBeenCalledWith(401);
  });

  it('calls next and sets req.tenant when key is valid', () => {
    vi.mocked(validateApiKey).mockReturnValue(mockTenant);
    const req = makeReq({ 'x-api-key': 'valid-key' });
    const { res } = makeRes();
    const next = makeNext();
    tenantAuth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).tenant).toBe(mockTenant);
  });
});

describe('quotaGuard middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with 401 when no tenant on request', () => {
    const req = makeReq({});
    const { res, status } = makeRes();
    quotaGuard(req, res, makeNext());
    expect(status).toHaveBeenCalledWith(401);
  });

  it('rejects with 429 when quota is exceeded', () => {
    vi.mocked(checkQuota).mockReturnValue(false);
    vi.mocked(remainingTokens).mockReturnValue(0);
    const req = makeReq({});
    (req as any).tenant = mockTenant;
    const { res, status } = makeRes();
    quotaGuard(req, res, makeNext());
    expect(status).toHaveBeenCalledWith(429);
  });

  it('calls next and sets quota headers when quota is available', () => {
    vi.mocked(checkQuota).mockReturnValue(true);
    vi.mocked(remainingTokens).mockReturnValue(90_000);
    const req = makeReq({});
    (req as any).tenant = mockTenant;
    const { res, setHeader } = makeRes();
    const next = makeNext();
    quotaGuard(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(setHeader).toHaveBeenCalledWith('X-RateLimit-Quota', mockTenant.quota_tokens);
  });
});

describe('smartAuth middleware', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('rejects with 401 when no API key provided', () => {
    const req = makeReq({});
    const { res, status } = makeRes();
    smartAuth(req, res, makeNext());
    expect(status).toHaveBeenCalledWith(401);
  });

  it('allows admin key bypass', () => {
    process.env.API_KEY = 'admin-secret';
    vi.mocked(validateApiKey).mockReturnValue(null); // not a tenant key
    const req = makeReq({ 'x-api-key': 'admin-secret' });
    const { res } = makeRes();
    const next = makeNext();
    smartAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('allows valid tenant key with sufficient quota', () => {
    vi.mocked(validateApiKey).mockReturnValue(mockTenant);
    vi.mocked(checkQuota).mockReturnValue(true);
    vi.mocked(remainingTokens).mockReturnValue(80_000);
    const req = makeReq({ 'x-api-key': 'tenant-key' });
    const { res } = makeRes();
    const next = makeNext();
    smartAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('blocks valid tenant key with exceeded quota (429)', () => {
    vi.mocked(validateApiKey).mockReturnValue(mockTenant);
    vi.mocked(checkQuota).mockReturnValue(false);
    vi.mocked(remainingTokens).mockReturnValue(0);
    const req = makeReq({ 'x-api-key': 'tenant-key' });
    const { res, status } = makeRes();
    smartAuth(req, res, makeNext());
    expect(status).toHaveBeenCalledWith(429);
  });
});
