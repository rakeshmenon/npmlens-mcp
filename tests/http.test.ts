import { describe, it, expect, vi, beforeEach } from "vitest";
import { httpGet } from "../src/http.js";

const okResponse = (body: unknown, init: ResponseInit = { status: 200 }): Response =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, ...init });

describe("httpGet", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns response on success and sets user-agent", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(okResponse({ hello: "world" }));
    const res = await httpGet("https://example.com/api");
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const args = fetchSpy.mock.calls[0][1]!;
    expect(args.headers).toBeDefined();
    const ua = (args.headers as Record<string, string>)["user-agent"];
    expect(ua).toContain("npmlens-mcp");
  });

  it("retries once on failure then succeeds", async () => {
    const err = new Error("network");
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(err)
      .mockResolvedValueOnce(okResponse({ ok: true }));
    const res = await httpGet("https://example.com/x", { retries: 1 });
    expect(res.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws new Error when rejection is non-Error", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce("boom");
    await expect(httpGet("https://x", { retries: 0 })).rejects.toBeInstanceOf(Error);
  });

  it("aborts on timeout and throws", async () => {
    vi.useFakeTimers();
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const signal = init?.signal as AbortSignal | undefined;
      return new Promise((_, reject) => {
        signal?.addEventListener("abort", () => reject(new Error("AbortError")));
      }) as unknown as Promise<Response>;
    });
    const p = httpGet("https://slow.example.com", { timeoutMs: 10, retries: 0 });
    vi.advanceTimersByTime(20);
    await expect(p).rejects.toBeInstanceOf(Error);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
