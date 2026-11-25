import crypto from 'crypto';

/**
 * Retrieves the NextAuth secret strictly from the environment.
 * Fails closed when missing at runtime so no hardcoded secret is ever used.
 */
export function getNextAuthSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET?.trim();
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
      throw new Error('CRITICAL SECURITY ERROR: NEXTAUTH_SECRET must be set (>= 32 characters) in production.');
    }
    if (!secret) {
      throw new Error('Configuration Error: NEXTAUTH_SECRET is missing from environment variables.');
    }
  }
  return secret;
}

/**
 * Retrieves a 32-byte server encryption master key strictly from ENCRYPTION_MASTER_KEY.
 * Accepts 64-char hex or base64 encoding of 32 bytes. Fails closed when missing.
 */
export function getEncryptionMasterKey(): Buffer {
  const raw = process.env.ENCRYPTION_MASTER_KEY?.trim();
  if (!raw) {
    throw new Error('Configuration Error: ENCRYPTION_MASTER_KEY is missing from environment variables.');
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, 'hex');
  }
  const b64 = Buffer.from(raw, 'base64');
  if (b64.length === 32) {
    return b64;
  }
  const rawUtf8 = Buffer.from(raw, 'utf8');
  if (rawUtf8.length >= 32) {
    return crypto.createHash('sha256').update(rawUtf8).digest();
  }
  throw new Error('Configuration Error: ENCRYPTION_MASTER_KEY must encode at least 32 bytes.');
}

/**
 * Constant-time string comparison for invite/verification codes.
 */
export function safeCompareSecrets(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
