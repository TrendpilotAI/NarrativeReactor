import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { signJwt, verifyJwt } from '../../lib/jwt';

describe('jwt', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-for-jwt';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('signs and verifies a token round-trip', () => {
    const token = signJwt('dashboard-user');
    const payload = verifyJwt(token);
    expect(payload.sub).toBe('dashboard-user');
    expect(payload.iat).toBeTypeOf('number');
    expect(payload.exp).toBeGreaterThan(payload.iat);
  });

  it('rejects tampered tokens', () => {
    const token = signJwt('user');
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => verifyJwt(tampered)).toThrow();
  });

  it('rejects expired tokens', () => {
    const token = signJwt('user', -1); // already expired
    expect(() => verifyJwt(token)).toThrow('Token expired');
  });

  it('rejects malformed tokens', () => {
    expect(() => verifyJwt('not.a.valid.token.at.all')).toThrow();
    expect(() => verifyJwt('nope')).toThrow('Invalid token format');
  });

  it('falls back to API_KEY if JWT_SECRET not set', () => {
    delete process.env.JWT_SECRET;
    process.env.API_KEY = 'fallback-api-key';
    const token = signJwt('user');
    const payload = verifyJwt(token);
    expect(payload.sub).toBe('user');
  });

  it('throws if neither JWT_SECRET nor API_KEY is set', () => {
    delete process.env.JWT_SECRET;
    delete process.env.API_KEY;
    expect(() => signJwt('user')).toThrow('JWT_SECRET or API_KEY must be set');
  });

  it('respects custom expiry', () => {
    const token = signJwt('user', 3600); // 1 hour
    const payload = verifyJwt(token);
    expect(payload.exp - payload.iat).toBe(3600);
  });
});
