/**
 * Token Encryption — AES-256-GCM at-rest encryption for OAuth tokens.
 *
 * Requires TOKEN_ENCRYPTION_KEY env var (64-char hex = 32 bytes).
 * In development without the key, tokens are stored as plaintext with a warning.
 * In production without the key, encrypt/decrypt will throw.
 *
 * Encrypted format: `enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // recommended for GCM
const PREFIX = 'enc:v1:';

function getKey(): Buffer | null {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) return null;
  if (hex.length !== 64) {
    throw new Error(
      'TOKEN_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes). ' +
      'Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string. Returns the encrypted envelope string.
 * If no encryption key is configured:
 *   - production: throws
 *   - development: returns plaintext with a console warning
 */
export function encryptToken(plaintext: string): string {
  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY is required in production to encrypt OAuth tokens');
    }
    console.warn('[tokenEncryption] TOKEN_ENCRYPTION_KEY not set — storing token as plaintext (dev only)');
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt an encrypted token string. Handles both encrypted and legacy plaintext tokens.
 * If the value doesn't start with the encryption prefix, it's returned as-is (legacy plaintext).
 * Returns empty string for null/undefined (missing optional tokens).
 */
export function decryptToken(value: string | undefined | null): string {
  if (!value) return '';
  // Legacy plaintext token — not encrypted
  if (!value.startsWith(PREFIX)) {
    return value;
  }

  const key = getKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('TOKEN_ENCRYPTION_KEY is required in production to decrypt OAuth tokens');
    }
    // In dev without key, we can't decrypt — this shouldn't happen normally
    throw new Error('Cannot decrypt token: TOKEN_ENCRYPTION_KEY not set');
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted token format');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const ciphertext = Buffer.from(ciphertextHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decrypted.toString('utf8');
}

/**
 * Check if a token value is already encrypted.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
