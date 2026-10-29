type Window = { count: number; resetAt: number };

/**
 * Fixed-window counter kept in process memory. Good enough for development and single-instance
 * deployments. Multi-instance deployments need a shared store (for example Redis).
 */
export class RateLimiter {
  private windows = new Map<string, Window>();

  /** Returns true if the action is allowed, and counts it. */
  consume(key: string, limit: number, windowMs: number, now: number = Date.now()): boolean {
    const current = this.windows.get(key);
    if (!current || current.resetAt <= now) {
      this.windows.set(key, { count: 1, resetAt: now + windowMs });
      return true;
    }
    if (current.count >= limit) return false;
    current.count += 1;
    return true;
  }
}

const globalForRateLimit = globalThis as typeof globalThis & { __emulixRateLimiter?: RateLimiter };

export function getRateLimiter(): RateLimiter {
  globalForRateLimit.__emulixRateLimiter ??= new RateLimiter();
  return globalForRateLimit.__emulixRateLimiter;
}
