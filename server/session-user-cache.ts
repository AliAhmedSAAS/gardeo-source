/**
 * Short-lived in-memory cache for passport.deserializeUser.
 * Avoids a DB round-trip on every authenticated API request (critical when
 * DATABASE_URL points at a remote host).
 */

type CacheEntry = { user: unknown; expiresAt: number };

const TTL_MS = 60_000;
const MAX_ENTRIES = 5_000;
const cache = new Map<string, CacheEntry>();

export function getCachedSessionUser(id: string): unknown | undefined {
  const entry = cache.get(id);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(id);
    return undefined;
  }
  return entry.user;
}

export function setCachedSessionUser(id: string, user: unknown): void {
  if (cache.size >= MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey !== undefined) cache.delete(firstKey);
  }
  cache.set(id, { user, expiresAt: Date.now() + TTL_MS });
}

export function invalidateSessionUser(id: string): void {
  cache.delete(id);
}

export function clearSessionUserCache(): void {
  cache.clear();
}
