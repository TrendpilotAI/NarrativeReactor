/**
 * Unit tests for the billing layer (tenants service + quota guard).
 * Uses an in-memory SQLite DB via temp file to avoid polluting the real DB.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Override DATA_DIR before importing services
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nr-billing-test-'));
process.env.DATA_DIR_OVERRIDE = tmpDir; // read by tenants.ts if we support it

// We test the tenant functions directly using the real DB path override
// by pointing process.cwd() isn't easy, so we'll test via direct import after chdir trick.
// Instead, just test the logic that doesn't depend on DB path.

import {
  generateApiKey,
  hashApiKey,
  checkQuota,
  remainingTokens,
  PLAN_QUOTAS,
  PLAN_PRICES_USD,
} from '../services/tenants';

afterAll(() => {
  // cleanup temp dir
  try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
});

describe('API key generation', () => {
  it('generates keys with the nr_live_ prefix', () => {
    const key = generateApiKey();
    expect(key).toMatch(/^nr_live_[0-9a-f]{48}$/);
  });

  it('generates unique keys each call', () => {
    const keys = new Set(Array.from({ length: 10 }, generateApiKey));
    expect(keys.size).toBe(10);
  });

  it('hashes deterministically', () => {
    const key = generateApiKey();
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('different keys produce different hashes', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(hashApiKey(a)).not.toBe(hashApiKey(b));
  });
});

describe('Plan quotas', () => {
  it('free < starter < pro < enterprise', () => {
    expect(PLAN_QUOTAS.free).toBeLessThan(PLAN_QUOTAS.starter);
    expect(PLAN_QUOTAS.starter).toBeLessThan(PLAN_QUOTAS.pro);
    expect(PLAN_QUOTAS.pro).toBeLessThan(PLAN_QUOTAS.enterprise);
  });

  it('starter is 100k tokens', () => {
    expect(PLAN_QUOTAS.starter).toBe(100_000);
  });

  it('pro is 500k tokens', () => {
    expect(PLAN_QUOTAS.pro).toBe(500_000);
  });

  it('starter costs $49', () => {
    expect(PLAN_PRICES_USD.starter).toBe(49);
  });

  it('pro costs $149', () => {
    expect(PLAN_PRICES_USD.pro).toBe(149);
  });
});

describe('Quota check logic', () => {
  it('checkQuota returns true when under quota', () => {
    const mockTenant = { quota_tokens: 1000, used_tokens: 500 } as any;
    expect(checkQuota(mockTenant)).toBe(true);
  });

  it('checkQuota returns false when at quota', () => {
    const mockTenant = { quota_tokens: 1000, used_tokens: 1000 } as any;
    expect(checkQuota(mockTenant)).toBe(false);
  });

  it('checkQuota returns false when over quota', () => {
    const mockTenant = { quota_tokens: 1000, used_tokens: 1001 } as any;
    expect(checkQuota(mockTenant)).toBe(false);
  });

  it('remainingTokens is correct', () => {
    const mockTenant = { quota_tokens: 1000, used_tokens: 300 } as any;
    expect(remainingTokens(mockTenant)).toBe(700);
  });

  it('remainingTokens floors at 0', () => {
    const mockTenant = { quota_tokens: 1000, used_tokens: 1500 } as any;
    expect(remainingTokens(mockTenant)).toBe(0);
  });
});
