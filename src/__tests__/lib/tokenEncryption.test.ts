import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { encryptToken, decryptToken, isEncrypted } from '../../lib/tokenEncryption';

// Valid 32-byte key (64 hex chars)
const TEST_KEY = 'a'.repeat(64);

describe('tokenEncryption', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('with TOKEN_ENCRYPTION_KEY set', () => {
    beforeEach(() => {
      process.env.TOKEN_ENCRYPTION_KEY = TEST_KEY;
    });

    it('encrypts and decrypts a token round-trip', () => {
      const token = 'oauth-access-token-12345';
      const encrypted = encryptToken(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted.startsWith('enc:v1:')).toBe(true);
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(token);
    });

    it('produces different ciphertext each time (random IV)', () => {
      const token = 'same-token';
      const e1 = encryptToken(token);
      const e2 = encryptToken(token);
      expect(e1).not.toBe(e2);
      // Both decrypt to same value
      expect(decryptToken(e1)).toBe(token);
      expect(decryptToken(e2)).toBe(token);
    });

    it('handles empty strings', () => {
      const encrypted = encryptToken('');
      expect(decryptToken(encrypted)).toBe('');
    });

    it('handles long tokens', () => {
      const token = 'x'.repeat(10000);
      const encrypted = encryptToken(token);
      expect(decryptToken(encrypted)).toBe(token);
    });

    it('detects tampering (fails with wrong authTag)', () => {
      const encrypted = encryptToken('secret-token');
      // Tamper with the ciphertext
      const tampered = encrypted.slice(0, -2) + 'ff';
      expect(() => decryptToken(tampered)).toThrow();
    });
  });

  describe('without TOKEN_ENCRYPTION_KEY (dev mode)', () => {
    beforeEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      process.env.NODE_ENV = 'development';
    });

    it('returns plaintext in dev mode', () => {
      const token = 'my-dev-token';
      const result = encryptToken(token);
      expect(result).toBe(token);
    });

    it('decrypts plaintext tokens as-is (legacy support)', () => {
      const token = 'legacy-plaintext-token';
      expect(decryptToken(token)).toBe(token);
    });
  });

  describe('without TOKEN_ENCRYPTION_KEY (production)', () => {
    beforeEach(() => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      process.env.NODE_ENV = 'production';
    });

    it('throws on encrypt in production', () => {
      expect(() => encryptToken('token')).toThrow('TOKEN_ENCRYPTION_KEY is required');
    });

    it('throws on decrypt of encrypted value in production', () => {
      expect(() => decryptToken('enc:v1:aabb:ccdd:eeff')).toThrow('TOKEN_ENCRYPTION_KEY is required');
    });

    it('allows legacy plaintext tokens to pass through', () => {
      // Legacy plaintext tokens can still be read (to allow migration)
      expect(decryptToken('old-plaintext-token')).toBe('old-plaintext-token');
    });
  });

  describe('isEncrypted', () => {
    it('returns true for encrypted format', () => {
      expect(isEncrypted('enc:v1:aabb:ccdd:eeff')).toBe(true);
    });

    it('returns false for plaintext', () => {
      expect(isEncrypted('plaintext-token')).toBe(false);
    });
  });

  describe('key validation', () => {
    it('rejects keys of wrong length', () => {
      process.env.TOKEN_ENCRYPTION_KEY = 'tooshort';
      expect(() => encryptToken('test')).toThrow('64 hex characters');
    });
  });
});
