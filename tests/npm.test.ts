import { describe, it, expect, vi, beforeEach } from "vitest";
import * as http from "../src/http.js";
import { searchNpm, getReadme } from "../src/npm.js";

const ok = (body: unknown): Response => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

describe("npm helpers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("searchNpm maps results and applies weights", async () => {
    const mock = vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        total: 1,
        objects: [
          {
            package: {
              name: "pkg",
              version: "1.0.0",
              description: "d",
              date: "2020-01-01",
              links: { npm: "https://npmjs.com/pkg" },
              maintainers: [{ username: "u" }],
              publisher: { username: "p" },
              keywords: ["k"],
            },
            score: { final: 0.7 },
          },
        ],
      })
    );
    const { total, results } = await searchNpm("react hook", 5, 0, { popularity: 0.8, maintenance: 0.1, quality: 0.1 });
    expect(total).toBe(1);
    expect(results[0]).toMatchObject({ name: "pkg", version: "1.0.0", score: 0.7 });
    expect(mock).toHaveBeenCalled();
    const url = (mock.mock.calls[0]?.[0]) || "";
    expect(url).toContain("popularity=0.8");
    expect(url).toContain("maintenance=0.1");
    expect(url).toContain("quality=0.1");
  });

  it("searchNpm without weights omits params", async () => {
    const mock = vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ total: 0, objects: [] }));
    await searchNpm("x", 10, 0);
    const url = (mock.mock.calls[0]?.[0]) || "";
    expect(url).not.toContain("quality=");
    expect(url).not.toContain("popularity=");
    expect(url).not.toContain("maintenance=");
  });

  it("searchNpm includes from when > 0 and validates size bounds", async () => {
    const spy = vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ total: 0, objects: [] }));
    await searchNpm("x", 5, 10);
    const url = (spy.mock.calls[0]?.[0]) || "";
    expect(url).toContain("from=10");
    await expect(searchNpm("x", 0)).rejects.toBeInstanceOf(Error);
    await expect(searchNpm("x", 251)).rejects.toBeInstanceOf(Error);
  });

  it("getReadme reads repo string and object forms and homepage", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({ name: "a", version: "1.0.0", readme: "# A", repository: "https://github.com/x/y" })
    );
    const a = await getReadme("a");
    expect(a.repository).toContain("github.com/x/y");

    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({ name: "b", version: "1.0.0", readme: "# B", homepage: "https://b.example", repository: { url: "git+https://github.com/z/w.git" } })
    );
    const b = await getReadme("b");
    expect(b.repository).toContain("github.com/z/w");
    expect(b.homepage).toContain("b.example");
  });

  it("getReadme handles missing repository/homepage", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({ version: "1.0.0", readme: "# C" })
    );
    const c = await getReadme("c");
    expect(c.name).toBe("c");
    expect(c.repository).toBeUndefined();
    expect(c.homepage).toBeUndefined();
  });

  it("searchNpm throws on non-ok response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(new Response("bad", { status: 500, statusText: "err" }));
    await expect(searchNpm("x")).rejects.toBeInstanceOf(Error);
  });

  it("getReadme throws on non-ok response and honors version in URL", async () => {
    const resp = new Response("bad", { status: 404, statusText: "nf" });
    const spy = vi.spyOn(http, "httpGet").mockResolvedValueOnce(resp);
    await expect(getReadme("pkg", "1.0.0")).rejects.toBeInstanceOf(Error);
    const url = (spy.mock.calls[0]?.[0]) || "";
    expect(url).toContain("/pkg/1.0.0");
  });

  it("getReadme readmeFilename without readme results in undefined readme", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ name: "p", version: "1.0.0", readmeFilename: "README.md" }));
    const r = await getReadme("p");
    expect(r.readme).toBeUndefined();
  });

  it("getReadme without readme and readmeFilename yields undefined", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ name: "p", version: "1.0.0" }));
    const r = await getReadme("p");
    expect(r.readme).toBeUndefined();
  });

  it("score defaults to 0 when missing", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({ total: 1, objects: [{ package: { name: "x", version: "1.0.0" } }] })
    );
    const r = await searchNpm("x");
    expect(r.results[0].score).toBe(0);
  });

  it("returned version falls back to requested version when missing in response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ name: "p", readme: "# P" }));
    const r = await getReadme("p", "9.9.9");
    expect(r.version).toBe("9.9.9");
  });

  it("getReadme prefers readme when both readme and readmeFilename present", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ name: "p", version: "1.0.0", readme: "# P", readmeFilename: "README.md" }));
    const r = await getReadme("p");
    expect(r.readme).toBe("# P");
  });

  it("searchNpm handles missing objects array (coalesce to empty)", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ total: 0 }));
    const r = await searchNpm("x");
    expect(Array.isArray(r.results)).toBe(true);
    expect(r.results.length).toBe(0);
  });

  it("searchNpm maps when maintainers list missing", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({ total: 1, objects: [{ package: { name: "x", version: "1.0.0" }, score: { final: 0.1 } }] })
    );
    const r = await searchNpm("x", 1, 0);
    expect(r.results[0].maintainers).toEqual([]);
  });

  it("validates inputs", async () => {
    await expect(searchNpm(" ")).rejects.toBeInstanceOf(Error);
    await expect(getReadme(" ")).rejects.toBeInstanceOf(Error);
  });
});
