interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();

/**
 * Lightweight in-memory sliding-window rate limiter for auth, AI chat, and alert protection.
 */
export function isWithinRateLimit(key: string, maxAttempts: number): boolean {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    return true;
  }
  return entry.count < maxAttempts;
}

export function recordRateLimitAttempt(key: string, windowMs = 15 * 60 * 1000): number {
  const now = Date.now();
  const entry = buckets.get(key);
  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 1;
  }
  entry.count += 1;
  return entry.count;
}

export function clearRateLimit(key: string): void {
  buckets.delete(key);
}
