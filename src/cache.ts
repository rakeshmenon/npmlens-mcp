/**
 * Lightweight in-memory cache used by the MCP server for hot paths
 * (search results, readme/info responses, downloads). Backed by LRU.
 */
import { LRUCache } from "lru-cache";

type CacheKey = string;

const defaultTtlMs = Number(process.env.CACHE_TTL_MS ?? "60000");
const maxSize = Number(process.env.CACHE_MAX ?? "500");

/** Value type stored in the cache. */
type CacheVal = object;
const cache: LRUCache<CacheKey, CacheVal> = new LRUCache<CacheKey, CacheVal>({ max: maxSize, ttl: defaultTtlMs });

/**
 * Get a value from the cache.
 *
 * @typeParam T - Expected value type for the given key.
 * @param key - Cache key produced by {@link key}.
 * @returns The cached value or undefined if missing/expired.
 */
export function cacheGet<T>(key: CacheKey): T | undefined {
  return cache.get(key) as T | undefined;
}

/**
 * Set a value in the cache.
 *
 * @typeParam T - Value type to store.
 * @param key - Cache key produced by {@link key}.
 * @param val - Value to store.
 * @param ttlMs - Optional time-to-live override in milliseconds.
 */
export function cacheSet<T>(key: CacheKey, val: T, ttlMs?: number): void {
  cache.set(key, val as CacheVal, { ttl: ttlMs });
}

/**
 * Build a stable cache key from parts by JSON-stringifying non-strings
 * and joining with a pipe. Order matters.
 *
 * @param parts - Components that uniquely identify a computation.
 * @returns A stable string key suitable for {@link cacheGet} and {@link cacheSet}.
 */
export function key(parts: unknown[]): string {
  return parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join("|");
}
