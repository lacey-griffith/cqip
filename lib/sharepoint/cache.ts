// Per-Worker-instance in-memory cache. Spec §5: 60s TTL on /folder
// and /xlsx; /image bypasses entirely. Multiple cache copies across
// instances is acceptable — the 60s TTL bounds drift. Lazy expiry on
// read (no background timer).

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

const store = new Map<string, CacheEntry>();

export const DEFAULT_TTL_MS = 60_000;

export function cacheGet<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    store.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function cacheSet(key: string, value: unknown, ttlMs: number = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

// Test-only. Not exported through any production path.
export function _resetCache(): void {
  store.clear();
}
