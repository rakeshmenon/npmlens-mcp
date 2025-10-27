import { describe, it, expect, vi, beforeEach } from "vitest";
import { handleResourceRead, resourceList, resourceTemplates } from "../src/resources.js";
import * as npm from "../src/npm.js";
import * as downloads from "../src/downloads.js";
import * as github from "../src/github.js";
import * as cache from "../src/cache.js";

describe("resources", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(cache, "cacheGet").mockReturnValue(undefined);
    vi.spyOn(cache, "cacheSet").mockImplementation(() => undefined);
  });

  describe("resourceList", () => {
    it("contains all expected resources", () => {
      expect(resourceList).toHaveLength(4);
      expect(resourceList.map(r => r.uri)).toEqual([
        "npm:registry/search",
        "npm:registry/package",
        "npm:readme/<name>[@<version>]",
        "npm:downloads/<name>/<period>",
      ]);
    });

    it("all resources have required properties", () => {
      resourceList.forEach(resource => {
        expect(resource.uri).toBeDefined();
        expect(resource.name).toBeDefined();
        expect(resource.description).toBeDefined();
        expect(resource.mimeType).toBeDefined();
      });
    });
  });

  describe("resourceTemplates", () => {
    it("contains all expected templates", () => {
      expect(resourceTemplates).toHaveLength(4);
      expect(resourceTemplates.map(t => t.uriTemplate)).toEqual([
        "npm://package/{name}",
        "npm://package/{name}/readme",
        "npm://package/{name}/version/{version}",
        "npm://package/{name}/downloads/{period}",
      ]);
    });

    it("all templates have required properties", () => {
      resourceTemplates.forEach(template => {
        expect(template.uriTemplate).toBeDefined();
        expect(template.name).toBeDefined();
        expect(template.description).toBeDefined();
        expect(template.mimeType).toBeDefined();
      });
    });
  });

  describe("handleResourceRead", () => {
    it("returns search API endpoint info", async () => {
      const result = await handleResourceRead("npm:registry/search");
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");
      expect(result.contents[0].text).toContain("registry.npmjs.org/-/v1/search");
    });

    it("returns package API endpoint info", async () => {
      const result = await handleResourceRead("npm:registry/package");
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");
      expect(result.contents[0].text).toContain("registry.npmjs.org/<package>");
    });

    it("returns README for package", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
        readme: "# Test Package",
      });

      const result = await handleResourceRead("npm:readme/test-pkg");
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("text/markdown");
      expect(result.contents[0].text).toBe("# Test Package");
    });

    it("returns README for specific version", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "2.0.0",
        readme: "# Version 2",
      });

      const result = await handleResourceRead("npm:readme/test-pkg@2.0.0");
      expect(result.contents[0].text).toBe("# Version 2");
      expect(npm.getReadme).toHaveBeenCalledWith("test-pkg", "2.0.0");
    });

    it("handles missing README", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
      });

      const result = await handleResourceRead("npm:readme/test-pkg");
      expect(result.contents[0].text).toBe("README not available");
    });

    it("handles missing README in template URI", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        version: "1.0.0",
      });

      const result = await handleResourceRead("npm://package/test-pkg/readme");
      expect(result.contents[0].text).toBe("README not available");
    });

    it("uses version from param when data.version is undefined", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "test-pkg",
        // version is undefined
      });

      const result = await handleResourceRead("npm://package/test-pkg/version/3.0.0");
       
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.contents[0].text);
       
         
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.version).toBe("3.0.0");
    });

    it("handles URL-encoded package names in readme", async () => {
      vi.spyOn(npm, "getReadme").mockResolvedValue({
        name: "@scope/pkg",
        version: "1.0.0",
        readme: "# Scoped",
      });

      await handleResourceRead("npm:readme/%40scope%2Fpkg");
      expect(npm.getReadme).toHaveBeenCalledWith("@scope/pkg", undefined);
    });

    it("returns download stats", async () => {
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({
        downloads: 5000,
        start: "2024-01-01",
        end: "2024-01-07",
        package: "test-pkg",
      });

      // Fix: URI should have 4 segments: "npm" "downloads" "name" "period"
      const result = await handleResourceRead("npm:downloads/test-pkg/week");
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].mimeType).toBe("application/json");
       
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = JSON.parse(result.contents[0].text);
       
         
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(data.downloads).toBe(5000);
    });

    it("defaults to week for invalid period", async () => {
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({
        downloads: 1000,
        start: "2024-01-01",
        end: "2024-01-07",
        package: "test-pkg",
      });

      await handleResourceRead("npm:downloads/test-pkg/invalid");
      expect(downloads.downloadsLast).toHaveBeenCalledWith("week", "test-pkg");
    });

    it("handles URL-encoded package names in downloads", async () => {
      vi.spyOn(downloads, "downloadsLast").mockResolvedValue({
        downloads: 100, start: "2024-01-01", end: "2024-01-07",
        package: "@scope/pkg",
      });

      await handleResourceRead("npm:downloads/%40scope%2Fpkg/day");
      expect(downloads.downloadsLast).toHaveBeenCalledWith("day", "@scope/pkg");
    });

    it("throws error for missing name/period in downloads", async () => {
      await expect(handleResourceRead("npm:downloads/test-pkg")).rejects.toThrow("Expected npm:downloads/<name>/<period>");
      await expect(handleResourceRead("npm:downloads/")).rejects.toThrow("Expected npm:downloads/<name>/<period>");
    });

    describe("template URIs", () => {
      it("returns package info for npm://package/{name}", async () => {
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

       
        const result = await handleResourceRead("npm://package/test-pkg");
        expect(result.contents).toHaveLength(1);
        expect(result.contents[0].mimeType).toBe("application/json");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = JSON.parse(result.contents[0].text);
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.name).toBe("test-pkg");
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.weeklyDownloads).toBe(1000);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.github.stars).toBe(100);
      });

      it("uses cache for package info", async () => {
        vi.spyOn(cache, "cacheGet").mockReturnValue(JSON.stringify({ name: "cached", weeklyDownloads: 999 }));
        const readmeSpy = vi.spyOn(npm, "getReadme");

        const result = await handleResourceRead("npm://package/cached-pkg");
        expect(readmeSpy).not.toHaveBeenCalled();
        expect(result.contents[0].text).toContain("cached");
      });

      it("handles errors gracefully in package info", async () => {
        vi.spyOn(npm, "getReadme").mockRejectedValue(new Error("Not found"));
        vi.spyOn(downloads, "downloadsLast").mockRejectedValue(new Error("Failed"));
        vi.spyOn(github, "fetchGithubRepo").mockResolvedValue(undefined);

        const result = await handleResourceRead("npm://package/missing-pkg");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = JSON.parse(result.contents[0].text);
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.name).toBe("missing-pkg");
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.version).toBeUndefined();
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.weeklyDownloads).toBe(0);
      });

      it("returns README for npm://package/{name}/readme", async () => {
        vi.spyOn(npm, "getReadme").mockResolvedValue({
          name: "test-pkg",
          version: "1.0.0",
          readme: "# Readme content",
        });

        const result = await handleResourceRead("npm://package/test-pkg/readme");
        expect(result.contents[0].mimeType).toBe("text/markdown");
        expect(result.contents[0].text).toBe("# Readme content");
      });

      it("returns version info for npm://package/{name}/version/{version}", async () => {
        vi.spyOn(npm, "getReadme").mockResolvedValue({
          name: "test-pkg",
          version: "2.0.0",
          repository: "https://github.com/test/pkg",
        });

        const result = await handleResourceRead("npm://package/test-pkg/version/2.0.0");
        expect(result.contents[0].mimeType).toBe("application/json");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = JSON.parse(result.contents[0].text);
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.version).toBe("2.0.0");
      });

      it("handles URL-encoded version strings", async () => {
        vi.spyOn(npm, "getReadme").mockResolvedValue({
          name: "@scope/pkg",
          version: "1.0.0-beta.1",
        });

        await handleResourceRead("npm://package/%40scope%2Fpkg/version/1.0.0-beta.1");
        expect(npm.getReadme).toHaveBeenCalledWith("@scope/pkg", "1.0.0-beta.1");
      });

      it("returns download stats for npm://package/{name}/downloads/{period}", async () => {
        vi.spyOn(downloads, "downloadsLast").mockResolvedValue({
          downloads: 2000,
          start: "2024-01-01",
          end: "2024-01-07",
          package: "test-pkg",
        });

        const result = await handleResourceRead("npm://package/test-pkg/downloads/last-week");
        expect(result.contents[0].mimeType).toBe("application/json");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = JSON.parse(result.contents[0].text);
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.downloads).toBe(2000);
      });

      it("maps period strings correctly", async () => {
        vi.spyOn(downloads, "downloadsLast").mockResolvedValue({
          downloads: 100,
          start: "2024-01-01",
          end: "2024-01-07",
          package: "test-pkg",
        });

        await handleResourceRead("npm://package/test-pkg/downloads/last-day");
        expect(downloads.downloadsLast).toHaveBeenCalledWith("day", "test-pkg");

        await handleResourceRead("npm://package/test-pkg/downloads/last-month");
        expect(downloads.downloadsLast).toHaveBeenCalledWith("month", "test-pkg");
      });

      it("defaults to week for invalid period in template URI", async () => {
        vi.spyOn(downloads, "downloadsLast").mockResolvedValue({
          downloads: 100,
          start: "2024-01-01",
          end: "2024-01-07",
          package: "test-pkg",
        });

        await handleResourceRead("npm://package/test-pkg/downloads/invalid");
        expect(downloads.downloadsLast).toHaveBeenCalledWith("week", "test-pkg");
      });

      it("handles URL-encoded package names in template URIs", async () => {
        const readmeSpy = vi.spyOn(npm, "getReadme");
        const downloadsSpy = vi.spyOn(downloads, "downloadsLast");
        const githubSpy = vi.spyOn(github, "fetchGithubRepo");

        // Test 1: npm://package/{name}
        readmeSpy.mockResolvedValueOnce({ name: "@scope/pkg", version: "1.0.0" });
        downloadsSpy.mockResolvedValueOnce({ downloads: 100, start: "2024-01-01", end: "2024-01-07", package: "@scope/pkg" });
        githubSpy.mockResolvedValueOnce(undefined);

        await handleResourceRead("npm://package/%40scope%2Fpkg");
        expect(readmeSpy).toHaveBeenCalledWith("@scope/pkg");
        readmeSpy.mockClear();

        // Test 2: npm://package/{name}/readme
        readmeSpy.mockResolvedValueOnce({ name: "@scope/pkg", version: "1.0.0", readme: "test" });

        await handleResourceRead("npm://package/%40scope%2Fpkg/readme");
        expect(readmeSpy).toHaveBeenCalledWith("@scope/pkg");
        readmeSpy.mockClear();

        // Test 3: npm://package/{name}/version/{version}
        readmeSpy.mockResolvedValueOnce({ name: "@scope/pkg", version: "2.0.0" });

        await handleResourceRead("npm://package/%40scope%2Fpkg/version/2.0.0");
        expect(readmeSpy).toHaveBeenCalledWith("@scope/pkg", "2.0.0");
      });

      it("handles null github data in package info", async () => {
        vi.spyOn(npm, "getReadme").mockResolvedValue({
          name: "test-pkg",
          version: "1.0.0",
          repository: "https://github.com/test/pkg",
        });
        vi.spyOn(downloads, "downloadsLast").mockResolvedValue({ downloads: 500, start: "2024-01-01", end: "2024-01-07", package: "test-pkg" });
        vi.spyOn(github, "fetchGithubRepo").mockResolvedValue(undefined);

        const result = await handleResourceRead("npm://package/test-pkg");
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = JSON.parse(result.contents[0].text);
         
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(data.github).toBeNull();
      });
    });

    it("throws error for unknown resource URI", async () => {
      await expect(handleResourceRead("npm:unknown/resource")).rejects.toThrow("Unknown resource");
    });

    it("throws error for unknown template URI", async () => {
      await expect(handleResourceRead("npm://unknown/template")).rejects.toThrow("Unknown resource");
    });
  });
});
