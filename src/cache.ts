import { LRUCache } from "lru-cache";

type CacheKey = string;

const defaultTtlMs = Number(process.env.CACHE_TTL_MS ?? "60000");
const maxSize = Number(process.env.CACHE_MAX ?? "500");

type CacheVal = object;
const cache: LRUCache<CacheKey, CacheVal> = new LRUCache<CacheKey, CacheVal>({ max: maxSize, ttl: defaultTtlMs });

export function cacheGet<T>(key: CacheKey): T | undefined {
  return cache.get(key) as T | undefined;
}

export function cacheSet<T>(key: CacheKey, val: T, ttlMs?: number): void {
  cache.set(key, val as CacheVal, { ttl: ttlMs });
}

export function key(parts: unknown[]): string {
  return parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join("|");
}
