/**
 * Thin AsyncStorage cache for API responses.
 *
 * Strategy: cache-first, refresh-on-demand.
 *   - On mount  → return cached data instantly (no spinner if cached).
 *   - On pull-to-refresh → fetch fresh, update cache.
 *   - On mutation (session complete, plan generated …) → invalidate affected keys.
 *
 * No TTL — staleness is controlled by explicit invalidation, not time.
 * All errors are swallowed; a cache miss is treated as "not cached".
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const PREFIX = "atcache:";

/** Read a cached value. Returns null on miss or parse error. */
export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return null;
    return (JSON.parse(raw) as { v: T }).v;
  } catch {
    return null;
  }
}

/** Write a value to cache. Errors are silently ignored. */
export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ v: data }));
  } catch {}
}

/** Delete a single cache entry. */
export async function cacheDel(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + key);
  } catch {}
}

/**
 * Delete all cache entries whose key starts with `prefix`.
 * Use this for cache groups, e.g. cacheDelPrefix("curriculum:abc123")
 * wipes curriculum:abc123, curriculum:abc123:weeks, curriculum:abc123:progress …
 */
export async function cacheDelPrefix(prefix: string): Promise<void> {
  try {
    const all = await AsyncStorage.getAllKeys();
    const targets = all.filter((k) => k.startsWith(PREFIX + prefix));
    if (targets.length) await AsyncStorage.multiRemove(targets);
  } catch {}
}
