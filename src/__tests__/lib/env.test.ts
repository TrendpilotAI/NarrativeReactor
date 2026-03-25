/**
 * Tests: env validation
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateEnv', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('does not throw when API_KEY is set', async () => {
    process.env.API_KEY = 'test-api-key';
    const { validateEnv } = await import('../../lib/env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('throws in production when API_KEY is missing', async () => {
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'production';
    const { validateEnv } = await import('../../lib/env');
    expect(() => validateEnv()).toThrow('FATAL');
  });

  it('warns but does not throw in development when API_KEY is missing', async () => {
    delete process.env.API_KEY;
    process.env.NODE_ENV = 'development';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { validateEnv } = await import('../../lib/env');
    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('validateBillingEnv warns when Stripe vars are missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { validateBillingEnv } = await import('../../lib/env');
    validateBillingEnv();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('validateBillingEnv does not warn when all Stripe vars are set', async () => {
    process.env.STRIPE_SECRET_KEY = 'sk_test_xxx';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_xxx';
    process.env.STRIPE_PRICE_STARTER = 'price_xxx';
    process.env.STRIPE_PRICE_PRO = 'price_yyy';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { validateBillingEnv } = await import('../../lib/env');
    validateBillingEnv();
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
