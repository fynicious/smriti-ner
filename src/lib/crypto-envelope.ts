import crypto from 'crypto';
import { getEncryptionMasterKey } from '@/lib/env';

const CIPHER_PREFIX = 'enc:v1:';
const IV_BYTES = 12;

export function isEncryptedEnvelope(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(CIPHER_PREFIX);
}

/**
 * Encrypts a UTF-8 sensitive string with AES-256-GCM and optional AAD context (e.g., patientId).
 */
export function encryptSensitiveField(
  plaintext: string | null | undefined,
  aadContext?: string,
  explicitKey?: Buffer
): string | null {
  if (plaintext === null || plaintext === undefined) return null;
  const trimmed = String(plaintext);
  if (!trimmed) return '';
  if (isEncryptedEnvelope(trimmed)) return trimmed;

  const key = explicitKey || getEncryptionMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aadContext) {
    cipher.setAAD(Buffer.from(aadContext, 'utf8'));
  }

  const encrypted = Buffer.concat([cipher.update(trimmed, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${CIPHER_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
}

/**
 * Decrypts AES-256-GCM envelope ciphertext.
 * Transparently passes through legacy non-enveloped plaintext so pre-existing records stay readable.
 */
export function decryptSensitiveField(
  stored: string | null | undefined,
  aadContext?: string,
  explicitKey?: Buffer
): string | null {
  if (stored === null || stored === undefined) return null;
  if (!stored) return '';
  if (!isEncryptedEnvelope(stored)) {
    return stored;
  }

  const parts = stored.slice(CIPHER_PREFIX.length).split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted envelope format');
  }

  const [ivB64, tagB64, dataB64] = parts;
  const key = explicitKey || getEncryptionMasterKey();
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (aadContext) {
    decipher.setAAD(Buffer.from(aadContext, 'utf8'));
  }
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString('utf8');
}

export function encryptBinaryBuffer(buffer: Buffer, aadContext?: string, explicitKey?: Buffer): Buffer {
  const key = explicitKey || getEncryptionMasterKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  if (aadContext) {
    cipher.setAAD(Buffer.from(aadContext, 'utf8'));
  }
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from('SMRENC1', 'ascii'), iv, tag, encrypted]);
}

export function decryptBinaryBuffer(payload: Buffer, aadContext?: string, explicitKey?: Buffer): Buffer {
  const magic = payload.subarray(0, 7).toString('ascii');
  if (magic !== 'SMRENC1') {
    return payload;
  }
  const iv = payload.subarray(7, 7 + IV_BYTES);
  const tag = payload.subarray(7 + IV_BYTES, 7 + IV_BYTES + 16);
  const ciphertext = payload.subarray(7 + IV_BYTES + 16);

  const key = explicitKey || getEncryptionMasterKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  if (aadContext) {
    decipher.setAAD(Buffer.from(aadContext, 'utf8'));
  }
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

export function hashTokenSha256(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
