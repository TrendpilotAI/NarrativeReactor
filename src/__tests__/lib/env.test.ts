/**
 * Tests for lib/env.ts — environment variable validation.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('validateEnv', () => {
  it('returns without error when API_KEY is set', async () => {
    vi.resetModules();
    process.env.API_KEY = 'test-api-key';
    const { validateEnv } = await import('../../lib/env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws in production when API_KEY is missing', async () => {
    vi.resetModules();
    const savedKey = process.env.API_KEY;
    const savedEnv = process.env.NODE_ENV;
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'production';
    try {
      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).toThrow('FATAL');
      expect(() => validateEnv()).toThrow('API_KEY');
    } finally {
      if (savedKey) process.env.API_KEY = savedKey;
      else delete process.env.API_KEY;
      process.env.NODE_ENV = savedEnv;
    }
  });

  it('warns (not throws) in development when API_KEY is missing', async () => {
    vi.resetModules();
    const savedKey = process.env.API_KEY;
    const savedEnv = process.env.NODE_ENV;
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      if (savedKey) process.env.API_KEY = savedKey;
      else delete process.env.API_KEY;
      process.env.NODE_ENV = savedEnv;
    }
  });

  it('warns when NODE_ENV is not production and API_KEY is missing', async () => {
    vi.resetModules();
    const savedKey = process.env.API_KEY;
    const savedEnv = process.env.NODE_ENV;
    delete process.env.API_KEY;
    delete process.env.NODE_ENV;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { validateEnv } = await import('../../lib/env');
      expect(() => validateEnv()).not.toThrow();
      expect(warnSpy).toHaveBeenCalled();
    } finally {
      if (savedKey) process.env.API_KEY = savedKey;
      else delete process.env.API_KEY;
      if (savedEnv) process.env.NODE_ENV = savedEnv;
      else delete process.env.NODE_ENV;
    }
  });
});

describe('validateBillingEnv', () => {
  it('warns when Stripe env vars are missing', async () => {
    vi.resetModules();
    const savedVars: Record<string, string | undefined> = {};
    ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_PRICE_STARTER', 'STRIPE_PRICE_PRO'].forEach(v => {
      savedVars[v] = process.env[v];
      delete process.env[v];
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { validateBillingEnv } = await import('../../lib/env');
      validateBillingEnv();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('STRIPE'));
    } finally {
      Object.entries(savedVars).forEach(([k, v]) => {
        if (v !== undefined) process.env[k] = v;
        else delete process.env[k];
      });
    }
  });

  it('does not warn when all Stripe vars are set', async () => {
    vi.resetModules();
    process.env.STRIPE_SECRET_KEY = 'sk_test';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test';
    process.env.STRIPE_PRICE_STARTER = 'price_starter';
    process.env.STRIPE_PRICE_PRO = 'price_pro';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const { validateBillingEnv } = await import('../../lib/env');
      validateBillingEnv();
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      delete process.env.STRIPE_SECRET_KEY;
      delete process.env.STRIPE_WEBHOOK_SECRET;
      delete process.env.STRIPE_PRICE_STARTER;
      delete process.env.STRIPE_PRICE_PRO;
    }
  });
});
