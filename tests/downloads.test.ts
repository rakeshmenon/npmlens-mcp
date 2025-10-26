import { describe, it, expect, vi, beforeEach } from "vitest";
import * as http from "../src/http.js";
import { downloadsLast } from "../src/downloads.js";

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("downloads", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("fetches day/week/month points", async () => {
    const spy = vi
      .spyOn(http, "httpGet")
      .mockResolvedValueOnce(ok({ downloads: 10, start: "", end: "", package: "p" }))
      .mockResolvedValueOnce(ok({ downloads: 10, start: "", end: "", package: "p" }))
      .mockResolvedValueOnce(ok({ downloads: 10, start: "", end: "", package: "p" }));
    expect((await downloadsLast("day", "p")).downloads).toBe(10);
    expect((await downloadsLast("week", "p")).downloads).toBe(10);
    expect((await downloadsLast("month", "p")).downloads).toBe(10);
    expect(spy).toHaveBeenCalledTimes(3);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(new Response("bad", { status: 500 }));
    await expect(downloadsLast("day", "p")).rejects.toBeInstanceOf(Error);
  });
});
