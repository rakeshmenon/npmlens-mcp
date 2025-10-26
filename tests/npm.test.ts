import { describe, it, expect, vi, beforeEach } from "vitest";
import * as http from "../src/http.js";
import { searchNpm, getReadme, getPackageVersions, getPackageDependencies, comparePackages } from "../src/npm.js";

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

  it("getPackageVersions returns sorted versions with tags", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        "dist-tags": { latest: "2.0.0", next: "3.0.0-beta" },
        time: { "1.0.0": "2020-01-01T00:00:00.000Z", "2.0.0": "2021-01-01T00:00:00.000Z", "3.0.0-beta": "2022-01-01T00:00:00.000Z" },
        versions: { "1.0.0": { version: "1.0.0" }, "2.0.0": { version: "2.0.0" }, "3.0.0-beta": { version: "3.0.0-beta" } },
      })
    );
    const result = await getPackageVersions("pkg");
    expect(result.name).toBe("pkg");
    expect(result.versions.length).toBe(3);
    // Should be sorted by date descending
    expect(result.versions[0].version).toBe("3.0.0-beta");
    expect(result.versions[0].tags).toContain("next");
    expect(result.versions[1].version).toBe("2.0.0");
    expect(result.versions[1].tags).toContain("latest");
  });

  it("getPackageVersions handles multiple tags for same version", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        "dist-tags": { latest: "2.0.0", stable: "2.0.0" },
        time: { "2.0.0": "2021-01-01T00:00:00.000Z" },
        versions: { "2.0.0": { version: "2.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg");
    expect(result.versions[0].tags?.length).toBe(2);
    expect(result.versions[0].tags).toContain("latest");
    expect(result.versions[0].tags).toContain("stable");
  });

  it("getPackageVersions applies limit", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        time: { "1.0.0": "2020-01-01T00:00:00.000Z", "2.0.0": "2021-01-01T00:00:00.000Z" },
        versions: { "1.0.0": { version: "1.0.0" }, "2.0.0": { version: "2.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg", 1);
    expect(result.versions.length).toBe(1);
  });

  it("getPackageVersions filters by since date (ISO)", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        time: { "1.0.0": "2020-01-01T00:00:00.000Z", "2.0.0": "2021-06-01T00:00:00.000Z" },
        versions: { "1.0.0": { version: "1.0.0" }, "2.0.0": { version: "2.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg", undefined, "2021-01-01T00:00:00.000Z");
    expect(result.versions.length).toBe(1);
    expect(result.versions[0].version).toBe("2.0.0");
  });

  it("getPackageVersions filters by since (relative month)", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        time: { "1.0.0": "2000-01-01T00:00:00.000Z", "2.0.0": new Date().toISOString() },
        versions: { "1.0.0": { version: "1.0.0" }, "2.0.0": { version: "2.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg", undefined, "1 month");
    expect(result.versions.length).toBe(1);
    expect(result.versions[0].version).toBe("2.0.0");
  });

  it("getPackageVersions filters by since (relative days)", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        time: { "1.0.0": "2000-01-01T00:00:00.000Z", "2.0.0": new Date().toISOString() },
        versions: { "1.0.0": { version: "1.0.0" }, "2.0.0": { version: "2.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg", undefined, "7 days");
    expect(result.versions.length).toBe(1);
  });

  it("getPackageVersions filters by since (relative years)", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        time: { "1.0.0": "2000-01-01T00:00:00.000Z", "2.0.0": new Date().toISOString() },
        versions: { "1.0.0": { version: "1.0.0" }, "2.0.0": { version: "2.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg", undefined, "1 year");
    expect(result.versions.length).toBe(1);
  });

  it("getPackageVersions handles missing time data", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        versions: { "1.0.0": { version: "1.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg");
    expect(result.versions.length).toBe(0);
  });

  it("getPackageVersions validates input", async () => {
    await expect(getPackageVersions(" ")).rejects.toBeInstanceOf(Error);
  });

  it("getPackageVersions throws on non-ok response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(new Response("bad", { status: 404, statusText: "Not Found" }));
    await expect(getPackageVersions("nonexistent")).rejects.toBeInstanceOf(Error);
  });

  it("getPackageVersions handles missing name in response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        time: { "1.0.0": "2020-01-01T00:00:00.000Z" },
        versions: { "1.0.0": { version: "1.0.0" } },
      })
    );
    const result = await getPackageVersions("pkg");
    expect(result.name).toBe("pkg");
  });

  it("getPackageVersions handles missing versions", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        time: { "1.0.0": "2020-01-01T00:00:00.000Z" },
      })
    );
    const result = await getPackageVersions("pkg");
    expect(result.versions.length).toBe(0);
  });

  it("getPackageDependencies returns dependencies", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        version: "1.0.0",
        dependencies: { lodash: "^4.0.0", react: "^18.0.0" },
        devDependencies: { vitest: "^1.0.0" },
      })
    );
    const result = await getPackageDependencies("pkg");
    expect(result.name).toBe("pkg");
    expect(result.dependencies.length).toBe(2);
    expect(result.dependencies.find((d) => d.name === "lodash")).toBeDefined();
    expect(result.devDependencies).toBeUndefined();
  });

  it("getPackageDependencies includes devDependencies when requested", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        name: "pkg",
        version: "1.0.0",
        dependencies: { lodash: "^4.0.0" },
        devDependencies: { vitest: "^1.0.0" },
      })
    );
    const result = await getPackageDependencies("pkg", undefined, 1, true);
    expect(result.devDependencies).toBeDefined();
    expect(result.devDependencies?.length).toBe(1);
  });

  it("getPackageDependencies validates depth", async () => {
    await expect(getPackageDependencies("pkg", undefined, 0)).rejects.toBeInstanceOf(Error);
    await expect(getPackageDependencies("pkg", undefined, 4)).rejects.toBeInstanceOf(Error);
  });

  it("getPackageDependencies validates input", async () => {
    await expect(getPackageDependencies(" ")).rejects.toBeInstanceOf(Error);
  });

  it("getPackageDependencies throws on non-ok response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(new Response("bad", { status: 404, statusText: "Not Found" }));
    await expect(getPackageDependencies("nonexistent")).rejects.toBeInstanceOf(Error);
  });

  it("getPackageDependencies handles missing name and version in response", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        dependencies: { lodash: "^4.0.0" },
      })
    );
    const result = await getPackageDependencies("pkg", "1.0.0");
    expect(result.name).toBe("pkg");
    expect(result.version).toBe("1.0.0");
  });

  it("getPackageDependencies defaults version to latest when missing", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      ok({
        dependencies: { lodash: "^4.0.0" },
      })
    );
    const result = await getPackageDependencies("pkg");
    expect(result.version).toBe("latest");
  });

  it("getPackageDependencies handles missing dependencies", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ name: "pkg", version: "1.0.0" }));
    const result = await getPackageDependencies("pkg");
    expect(result.dependencies.length).toBe(0);
  });

  it("getPackageDependencies handles missing devDependencies when requested", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(ok({ name: "pkg", version: "1.0.0", dependencies: { lodash: "^4.0.0" } }));
    const result = await getPackageDependencies("pkg", undefined, 1, true);
    expect(result.devDependencies).toBeDefined();
    expect(result.devDependencies?.length).toBe(0);
  });

  it("comparePackages returns comparison data", async () => {
    // Mock getReadme
    vi.spyOn(http, "httpGet")
      .mockResolvedValueOnce(
        ok({
          name: "pkg1",
          version: "1.0.0",
          readme: "# Package 1\nA great package",
          repository: "https://github.com/user/pkg1",
        })
      )
      .mockResolvedValueOnce(ok({ downloads: 1000, start: "2024-01-01", end: "2024-01-07", package: "pkg1" }))
      .mockResolvedValueOnce(
        ok({ full_name: "user/pkg1", html_url: "https://github.com/user/pkg1", stargazers_count: 100, forks_count: 10, license: { spdx_id: "MIT" } })
      );

    const result = await comparePackages(["pkg1"]);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe("pkg1");
    expect(result[0].downloads).toBe(1000);
    expect(result[0].stars).toBe(100);
    expect(result[0].license).toBe("MIT");
  });

  it("comparePackages handles errors gracefully", async () => {
    vi.spyOn(http, "httpGet").mockRejectedValueOnce(new Error("Network error"));
    const result = await comparePackages(["nonexistent"]);
    expect(result.length).toBe(1);
    expect(result[0].error).toBeDefined();
  });

  it("comparePackages handles download errors gracefully", async () => {
    vi.spyOn(http, "httpGet")
      .mockResolvedValueOnce(ok({ name: "pkg1", version: "1.0.0", readme: "# Package", repository: "https://github.com/user/pkg1" }))
      .mockRejectedValueOnce(new Error("Downloads API error"))
      .mockResolvedValueOnce(ok({ full_name: "user/pkg1", html_url: "https://github.com/user/pkg1", stargazers_count: 50 }));
    const result = await comparePackages(["pkg1"]);
    expect(result[0].downloads).toBeUndefined();
    expect(result[0].stars).toBe(50);
  });

  it("comparePackages handles GitHub errors gracefully", async () => {
    vi.spyOn(http, "httpGet")
      .mockResolvedValueOnce(ok({ name: "pkg1", version: "1.0.0", readme: "# Package", repository: "https://github.com/user/pkg1" }))
      .mockResolvedValueOnce(ok({ downloads: 1000, start: "2024-01-01", end: "2024-01-07", package: "pkg1" }))
      .mockRejectedValueOnce(new Error("GitHub API error"));
    const result = await comparePackages(["pkg1"]);
    expect(result[0].downloads).toBe(1000);
    expect(result[0].stars).toBeUndefined();
  });

  it("comparePackages handles empty package name", async () => {
    const result = await comparePackages([" "]);
    expect(result[0].error).toBeDefined();
  });

  it("comparePackages handles non-Error exceptions", async () => {
    vi.spyOn(http, "httpGet").mockRejectedValueOnce("string error");
    const result = await comparePackages(["pkg"]);
    expect(result[0].error).toBe("string error");
  });

  it("comparePackages validates input", async () => {
    await expect(comparePackages([])).rejects.toBeInstanceOf(Error);
    await expect(comparePackages(Array(11).fill("pkg") as string[])).rejects.toBeInstanceOf(Error);
  });
});
