'use client';

const LOCAL_PREFIX = 'wc1:';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

let inMemoryKey: CryptoKey | null = null;
let inMemoryUserId: string | null = null;
let lastActivityAt = Date.now();
let locked = false;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export function touchOfflineActivity() {
  lastActivityAt = Date.now();
}

export function isOfflineCacheLocked(): boolean {
  if (Date.now() - lastActivityAt > IDLE_TIMEOUT_MS && inMemoryKey) {
    inMemoryKey = null;
    locked = true;
  }
  return locked;
}

export function clearOfflineEncryptionKey() {
  inMemoryKey = null;
  inMemoryUserId = null;
  locked = false;
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem('smriti_wc_wrap');
    } catch {
      // Ignore storage access restriction
    }
  }
}

export async function ensureOfflineKey(userId: string): Promise<CryptoKey | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle || !userId) return null;

  if (Date.now() - lastActivityAt > IDLE_TIMEOUT_MS && inMemoryKey) {
    inMemoryKey = null;
    locked = true;
  }
  if (locked) return null;

  if (inMemoryKey && inMemoryUserId === userId) {
    lastActivityAt = Date.now();
    return inMemoryKey;
  }

  // Derive ephemeral WebCrypto AES-GCM key per user session stored only in sessionStorage JWK (wiped on tab close/sign-out/idle)
  try {
    const existingRaw = window.sessionStorage.getItem('smriti_wc_wrap');
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw) as { userId?: string; rawB64?: string };
      if (parsed.userId === userId && parsed.rawB64) {
        const imported = await window.crypto.subtle.importKey(
          'raw',
          fromBase64(parsed.rawB64) as BufferSource,
          { name: 'AES-GCM', length: 256 },
          false,
          ['encrypt', 'decrypt']
        );
        inMemoryKey = imported;
        inMemoryUserId = userId;
        lastActivityAt = Date.now();
        return imported;
      }
    }

    const randomKeyBytes = window.crypto.getRandomValues(new Uint8Array(32));
    window.sessionStorage.setItem(
      'smriti_wc_wrap',
      JSON.stringify({ userId, rawB64: toBase64(randomKeyBytes) })
    );
    const key = await window.crypto.subtle.importKey(
      'raw',
      randomKeyBytes as BufferSource,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    inMemoryKey = key;
    inMemoryUserId = userId;
    lastActivityAt = Date.now();
    return key;
  } catch {
    return null;
  }
}

export async function encryptOfflineString(userId: string, value: string): Promise<string> {
  if (!value || value.startsWith(LOCAL_PREFIX)) return value;
  const key = await ensureOfflineKey(userId);
  if (!key) return value;

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(value);
  const cipherBuf = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  return `${LOCAL_PREFIX}${toBase64(iv)}:${toBase64(new Uint8Array(cipherBuf))}`;
}

export async function decryptOfflineString(userId: string, stored: string): Promise<string> {
  if (!stored || !stored.startsWith(LOCAL_PREFIX)) return stored;
  const key = await ensureOfflineKey(userId);
  if (!key) return '';

  const parts = stored.slice(LOCAL_PREFIX.length).split(':');
  if (parts.length !== 2) return '';
  try {
    const iv = fromBase64(parts[0]);
    const cipherBytes = fromBase64(parts[1]);
    const plainBuf = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      cipherBytes as BufferSource
    );
    return new TextDecoder().decode(plainBuf);
  } catch {
    return '';
  }
}
