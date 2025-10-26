import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheGet, cacheSet, key } from "../src/cache.js";

describe("cache", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("stores and retrieves values", () => {
    const k = key(["a", 1, { x: true }]);
    cacheSet(k, { v: 42 }, 1000);
    expect(cacheGet<{ v: number }>(k)?.v).toBe(42);
  });

  it("expires with ttl", async () => {
    const k = key(["ttl", 1]);
    cacheSet(k, { v: 1 }, 10);
    expect(cacheGet<{ v: number }>(k)?.v).toBe(1);
    await new Promise((r) => setTimeout(r, 20));
    expect(cacheGet<{ v: number }>(k)).toBeUndefined();
  });
});
