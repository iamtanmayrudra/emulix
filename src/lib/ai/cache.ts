import { createHash } from "node:crypto";

/**
 * Remembers recent results by a hash of the input, so asking about the same evidence twice costs one credit, not two.
 * Keys include the user, so one account can never be served another's result. Entries expire and the cache is bounded.
 */

const MAX_ENTRIES = 200;
const TTL_MS = 60 * 60_000;

type Entry = { value: unknown; expiresAt: number };

const globalForCache = globalThis as typeof globalThis & { __emulixAiCache?: Map<string, Entry> };

function entries(): Map<string, Entry> {
  globalForCache.__emulixAiCache ??= new Map();
  return globalForCache.__emulixAiCache;
}

export function cacheKey(userId: string, feature: string, promptVersion: string, input: unknown): string {
  return createHash("sha256").update(JSON.stringify([userId, feature, promptVersion, input])).digest("hex");
}

export function cacheGet<T>(key: string, now = Date.now()): T | undefined {
  const entry = entries().get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= now) {
    entries().delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, now = Date.now()): void {
  const map = entries();
  map.delete(key);
  map.set(key, { value, expiresAt: now + TTL_MS });
  // Maps keep insertion order, so the first key is the oldest.
  while (map.size > MAX_ENTRIES) {
    const oldest = map.keys().next().value;
    if (oldest === undefined) break;
    map.delete(oldest);
  }
}
