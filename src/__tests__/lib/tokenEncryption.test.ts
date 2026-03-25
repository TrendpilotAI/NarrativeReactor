/**
 * Tests: Token Encryption (AES-256-GCM)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken, isEncrypted } from '../../lib/tokenEncryption';

describe('Token Encryption', () => {
  const TEST_KEY = '0'.repeat(64); // 64 hex chars = 32 bytes
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('encryptToken', () => {
    it('encrypts a token and returns an enc:v1: prefix', () => {
      const encrypted = encryptToken('my-oauth-token');
      expect(encrypted).toMatch(/^enc:v1:/);
    });

    it('produces different output each time (random IV)', () => {
      const e1 = encryptToken('same-value');
      const e2 = encryptToken('same-value');
      expect(e1).not.toBe(e2);
    });

    it('stores plaintext in development when no key', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      process.env.NODE_ENV = 'development';
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = encryptToken('my-token');
      expect(result).toBe('my-token');
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('throws in production when no key', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      process.env.NODE_ENV = 'production';
      expect(() => encryptToken('token')).toThrow('TOKEN_ENCRYPTION_KEY is required');
    });

    it('throws for wrong-length key', () => {
      process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(32); // too short
      expect(() => encryptToken('token')).toThrow('64 hex characters');
    });
  });

  describe('decryptToken', () => {
    it('round-trips a token', () => {
      const original = 'secret-oauth-access-token';
      const encrypted = encryptToken(original);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(original);
    });

    it('returns empty string for null/undefined', () => {
      expect(decryptToken(null)).toBe('');
      expect(decryptToken(undefined)).toBe('');
    });

    it('returns plaintext token as-is (legacy support)', () => {
      const plaintext = 'legacy-token-not-encrypted';
      const result = decryptToken(plaintext);
      expect(result).toBe(plaintext);
    });

    it('throws for invalid encrypted format', () => {
      expect(() => decryptToken('enc:v1:bad-format')).toThrow('Invalid encrypted token format');
    });

    it('throws when key missing for encrypted token in dev', () => {
      const encrypted = encryptToken('token'); // encrypt with key
      delete process.env.TOKEN_ENCRYPTION_KEY;
      process.env.NODE_ENV = 'development';
      expect(() => decryptToken(encrypted)).toThrow('TOKEN_ENCRYPTION_KEY not set');
    });
  });

  describe('isEncrypted', () => {
    it('returns true for encrypted tokens', () => {
      const encrypted = encryptToken('some-value');
      expect(isEncrypted(encrypted)).toBe(true);
    });

    it('returns false for plaintext tokens', () => {
      expect(isEncrypted('plain-token')).toBe(false);
      expect(isEncrypted('Bearer abc123')).toBe(false);
    });
  });
});
