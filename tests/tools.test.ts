import { describe, it, expect, vi, beforeEach } from "vitest";
import { tools, errorMessage } from "../src/tools.js";
import * as npm from "../src/npm.js";
import type { PackageComparison } from "../src/npm.js";
import * as downloads from "../src/downloads.js";
import * as github from "../src/github.js";
import * as snippet from "../src/snippet.js";
import * as cache from "../src/cache.js";

describe("errorMessage", () => {
  it("handles Error objects", () => {
    expect(errorMessage(new Error("test error"))).toBe("test error");
  });

  it("handles JSON-serializable values", () => {
    expect(errorMessage({ code: "ERR" })).toBe('{"code":"ERR"}');
  });

  it("handles non-serializable values", () => {
    const circular: { self?: unknown } = {};
    circular.self = circular;
    expect(errorMessage(circular)).toBe("[object Object]");
  });

  it("handles strings", () => {
    expect(errorMessage("plain error")).toBe('"plain error"');
  });
});

describe("tools", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(cache, "cacheGet").mockReturnValue(undefined);
    vi.spyOn(cache, "cacheSet").mockImplementation(() => undefined);
  });

  describe("search_npm", () => {
    it("searches npm with default parameters", async () => {
      vi.spyOn(npm, "searchNpm").mockResolvedValue({
        total: 1,
        results: [{ name: "test-pkg", version: "1.0.0", description: "Test", score: 0.9, links: { npm: "https://npmjs.com/test-pkg" } }],
      });

      const tool = tools.find(t => t.name === "search_npm")!;
      const result = await tool.handler({ query: "react" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("test-pkg");
      expect(npm.searchNpm).toHaveBeenCalledWith("react", 10, 0, undefined);
    });

    it("searches npm with custom parameters", async () => {
      vi.spyOn(npm, "searchNpm").mockResolvedValue({ total: 0, results: [] });

      const tool = tools.find(t => t.name === "search_npm")!;
      await tool.handler({ query: "test", size: 5, from: 10, weights: { quality: 0.5 } });

      expect(npm.searchNpm).toHaveBeenCalledWith("test", 5, 10, { quality: 0.5 });
    });

    it("returns cached results", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ total: 1, results: [] });
      const searchSpy = vi.spyOn(npm, "searchNpm");

      const tool = tools.find(t => t.name === "search_npm")!;
      const result = await tool.handler({ query: "cached" });

      expect(result.isError).toBeUndefined();
      expect(searchSpy).not.toHaveBeenCalled();
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "searchNpm").mockRejectedValue(new Error("Network error"));

      const tool = tools.find(t => t.name === "search_npm")!;
      const result = await tool.handler({ query: "fail" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Network error");
    });
  });

  describe("get_readme", () => {
    it("fetches readme for package", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        readme: "# Test",
        repository: "https://github.com/test/pkg",
        homepage: "https://test.com",
      });

      const tool = tools.find(t => t.name === "get_readme")!;
      const result = await tool.handler({ name: "test-pkg" });

      expect(result.isError).toBeUndefined();
      expect(result.content[0].text).toContain("# Test");
      expect(result.content[0].text).toContain("test-pkg");
    });

    it("truncates readme when requested", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        readme: "This is a very long readme that should be truncated",
      });

      const tool = tools.find(t => t.name === "get_readme")!;
      const result = await tool.handler({ name: "test-pkg", truncateAt: 10 });

      expect(result.content[0].text).toContain("This is a ");
      expect(result.content[0].text).not.toContain("very long");
    });

    it("uses cache when available", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ name: "cached-pkg", readme: "cached" });
      const readmeSpy = vi.spyOn(npm, "getReadme");

      const tool = tools.find(t => t.name === "get_readme")!;
      const result = await tool.handler({ name: "cached-pkg" });

      expect(readmeSpy).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain("cached");
    });

    it("handles missing readme", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({ name: "no-readme", version: "1.0.0" });

      const tool = tools.find(t => t.name === "get_readme")!;
      const result = await tool.handler({ name: "no-readme" });

      expect(result.content[0].text).toContain("README not available");
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "getReadme").mockRejectedValue(new Error("Not found"));

      const tool = tools.find(t => t.name === "get_readme")!;
      const result = await tool.handler({ name: "missing" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Not found");
    });
  });

  describe("get_package_info", () => {
    it("fetches enriched package info", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        repository: "https://github.com/test/pkg",
        homepage: "https://test.com",
      });
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({ downloads: 1000, start: "2024-01-01", end: "2024-01-07", package: "test-pkg" });
      vi.spyOn(github, "fetchGithubRepo").mockResolvedValue({
        fullName: "test/pkg",
        url: "https://github.com/test/pkg",
        stars: 100,
        forks: 10,
        license: "MIT",
      });

      const tool = tools.find(t => t.name === "get_package_info")!;
      const result = await tool.handler({ name: "test-pkg" });

      expect(result.isError).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.downloadsLastWeek).toBe(1000);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.github.stars).toBe(100);
    });

    it("includes readme when requested", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        readme: "# Test",
      });
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({ downloads: 1000, start: "2024-01-01", end: "2024-01-07", package: "test-pkg" });
      vi.spyOn(github, "fetchGithubRepo").mockResolvedValue(undefined);

      const tool = tools.find(t => t.name === "get_package_info")!;
      const result = await tool.handler({ name: "test-pkg", includeReadme: true });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.readme).toBe("# Test");
    });

    it("uses cache when available", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ name: "cached", downloadsLastWeek: 500 });
      const readmeSpy = vi.spyOn(npm, "getReadme");

      const tool = tools.find(t => t.name === "get_package_info")!;
      const result = await tool.handler({ name: "cached" });

      expect(readmeSpy).not.toHaveBeenCalled();
      expect(result.content[0].text).toContain("cached");
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "getReadme").mockRejectedValue(new Error("Failed"));

      const tool = tools.find(t => t.name === "get_package_info")!;
      const result = await tool.handler({ name: "fail" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("Failed");
    });
  });

  describe("get_downloads", () => {
    it("fetches download stats", async () => {
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({ downloads: 5000, start: "2024-01-01", end: "2024-01-07", package: "test-pkg" });

      const tool = tools.find(t => t.name === "get_downloads")!;
      const result = await tool.handler({ name: "test-pkg" });

      expect(result.isError).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.downloads).toBe(5000);
      expect(downloads.downloadsLast).toHaveBeenCalledWith("week", "test-pkg");
    });

    it("fetches download stats for custom period", async () => {
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({ downloads: 100, start: "2024-01-01", end: "2024-01-07", package: "test-pkg" });

      const tool = tools.find(t => t.name === "get_downloads")!;
      await tool.handler({ name: "test-pkg", period: "day" });

      expect(downloads.downloadsLast).toHaveBeenCalledWith("day", "test-pkg");
    });

    it("uses cache when available", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ downloads: 999, start: "2024-01-01", end: "2024-01-07", package: "cached" });
      const dlSpy = vi.spyOn(downloads, "downloadsLast");

      const tool = tools.find(t => t.name === "get_downloads")!;
      await tool.handler({ name: "cached" });

      expect(dlSpy).not.toHaveBeenCalled();
    });

    it("handles errors", async () => {
      vi.spyOn(downloads, "downloadsLast").mockRejectedValue(new Error("API error"));

      const tool = tools.find(t => t.name === "get_downloads")!;
      const result = await tool.handler({ name: "fail" });

      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain("API error");
    });
  });

  describe("get_usage_snippet", () => {
    it("extracts usage snippet", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        readme: "# Usage\n```js\nconst x = require('test-pkg');\n```",
      });
      vi.spyOn(snippet, "extractUsageSnippet").mockReturnValue({ code: "const x = require('test-pkg');", language: "js" });

      const tool = tools.find(t => t.name === "get_usage_snippet")!;
      const result = await tool.handler({ name: "test-pkg" });

      expect(result.isError).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.snippet.code).toBe("const x = require('test-pkg');");
    });

    it("handles missing snippet", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({ name: "test-pkg", version: "1.0.0" });
      vi.spyOn(snippet, "extractUsageSnippet").mockReturnValue(undefined);

      const tool = tools.find(t => t.name === "get_usage_snippet")!;
      const result = await tool.handler({ name: "test-pkg" });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.snippet).toBeUndefined();
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "getReadme").mockRejectedValue(new Error("Failed"));

      const tool = tools.find(t => t.name === "get_usage_snippet")!;
      const result = await tool.handler({ name: "fail" });

      expect(result.isError).toBe(true);
    });
  });

  describe("get_package_versions", () => {
    it("fetches package versions", async () => {
      vi.spyOn(npm, "getPackageVersions").mockResolvedValue({
        name: "test-pkg",
        versions: [
          { version: "1.0.0", date: "2024-01-01", tags: ["latest"] },
        ],
      });

      const tool = tools.find(t => t.name === "get_package_versions")!;
      const result = await tool.handler({ name: "test-pkg" });

      expect(result.isError).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.versions).toHaveLength(1);
    });

    it("applies limit and since parameters", async () => {
      vi.spyOn(npm, "getPackageVersions").mockResolvedValue({ name: "test-pkg", versions: [] });

      const tool = tools.find(t => t.name === "get_package_versions")!;
      await tool.handler({ name: "test-pkg", limit: 5, since: "6 months" });

      expect(npm.getPackageVersions).toHaveBeenCalledWith("test-pkg", 5, "6 months");
    });

    it("uses cache when available", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ name: "cached", versions: [] });
      const versionsSpy = vi.spyOn(npm, "getPackageVersions");

      const tool = tools.find(t => t.name === "get_package_versions")!;
      await tool.handler({ name: "cached" });

      expect(versionsSpy).not.toHaveBeenCalled();
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "getPackageVersions").mockRejectedValue(new Error("Failed"));

      const tool = tools.find(t => t.name === "get_package_versions")!;
      const result = await tool.handler({ name: "fail" });

      expect(result.isError).toBe(true);
    });
  });

  describe("get_package_dependencies", () => {
    it("fetches package dependencies", async () => {
      vi.spyOn(npm, "getPackageDependencies").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        dependencies: [{ name: "dep1", version: "^1.0.0" }],
      });

      const tool = tools.find(t => t.name === "get_package_dependencies")!;
      const result = await tool.handler({ name: "test-pkg" });

      expect(result.isError).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.dependencies).toHaveLength(1);
    });

    it("applies depth and devDependencies parameters", async () => {
      vi.spyOn(npm, "getPackageDependencies").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        dependencies: [],
      });

      const tool = tools.find(t => t.name === "get_package_dependencies")!;
      await tool.handler({ name: "test-pkg", depth: 2, includeDevDependencies: true });

      expect(npm.getPackageDependencies).toHaveBeenCalledWith("test-pkg", undefined, 2, true);
    });

    it("uses cache when available", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ name: "cached", dependencies: [] });
      const depsSpy = vi.spyOn(npm, "getPackageDependencies");

      const tool = tools.find(t => t.name === "get_package_dependencies")!;
      await tool.handler({ name: "cached" });

      expect(depsSpy).not.toHaveBeenCalled();
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "getPackageDependencies").mockRejectedValue(new Error("Failed"));

      const tool = tools.find(t => t.name === "get_package_dependencies")!;
      const result = await tool.handler({ name: "fail" });

      expect(result.isError).toBe(true);
    });
  });

  describe("compare_packages", () => {
    it("compares multiple packages", async () => {
      // Using unknown type for test mock
      vi.spyOn(npm, "comparePackages").mockResolvedValue([
        { name: "pkg1", downloadsLastWeek: 1000 },
        { name: "pkg2", downloadsLastWeek: 2000 },
      ] as unknown as PackageComparison[]);

      const tool = tools.find(t => t.name === "compare_packages")!;
      const result = await tool.handler({ packages: ["pkg1", "pkg2"] });

      expect(result.isError).toBeUndefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.content[0].text);
      expect(data).toHaveLength(2);
    });

    it("uses cache with sorted package names", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ packages: [] });
      const compareSpy = vi.spyOn(npm, "comparePackages");

      const tool = tools.find(t => t.name === "compare_packages")!;
      await tool.handler({ packages: ["b", "a", "c"] });

      expect(compareSpy).not.toHaveBeenCalled();
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "comparePackages").mockRejectedValue(new Error("Failed"));

      const tool = tools.find(t => t.name === "compare_packages")!;
      const result = await tool.handler({ packages: ["fail"] });

      expect(result.isError).toBe(true);
    });
  });

  describe("search_by_keywords", () => {
    it("searches with AND operator by default", async () => {
      vi.spyOn(npm, "searchNpm").mockResolvedValue({ total: 1, results: [] });

      const tool = tools.find(t => t.name === "search_by_keywords")!;
      await tool.handler({ keywords: ["react", "hooks"] });

      expect(npm.searchNpm).toHaveBeenCalledWith("react hooks", 10);
    });

    it("searches with OR operator", async () => {
      vi.spyOn(npm, "searchNpm").mockResolvedValue({ total: 1, results: [] });

      const tool = tools.find(t => t.name === "search_by_keywords")!;
      await tool.handler({ keywords: ["react", "vue"], operator: "OR" });

      expect(npm.searchNpm).toHaveBeenCalledWith("react OR vue", 10);
    });

    it("applies custom size", async () => {
      vi.spyOn(npm, "searchNpm").mockResolvedValue({ total: 0, results: [] });

      const tool = tools.find(t => t.name === "search_by_keywords")!;
      await tool.handler({ keywords: ["test"], size: 5 });

      expect(npm.searchNpm).toHaveBeenCalledWith("test", 5);
    });

    it("uses cache when available", async () => {
      vi.spyOn(cache, "cacheGet").mockReturnValue({ total: 0, results: [] });
      const searchSpy = vi.spyOn(npm, "searchNpm");

      const tool = tools.find(t => t.name === "search_by_keywords")!;
      await tool.handler({ keywords: ["cached"] });

      expect(searchSpy).not.toHaveBeenCalled();
    });

    it("handles errors", async () => {
      vi.spyOn(npm, "searchNpm").mockRejectedValue(new Error("Failed"));

      const tool = tools.find(t => t.name === "search_by_keywords")!;
      const result = await tool.handler({ keywords: ["fail"] });

      expect(result.isError).toBe(true);
    });
  });
});
