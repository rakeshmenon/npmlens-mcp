/**
 * Resource handlers for NPMLens MCP server.
 * Resources expose npm registry endpoints and package data via MCP resource URIs.
 */
import { getReadme } from "./npm.js";
import { downloadsLast } from "./downloads.js";
import { fetchGithubRepo } from "./github.js";
import { cacheGet, cacheSet, key } from "./cache.js";

export type ResourceContent = {
  uri: string;
  mimeType: string;
  text: string;
};

export type ResourceResponse = {
  contents: ResourceContent[];
};

export const resourceList = [
  {
    uri: "npm:registry/search",
    name: "npm Search API",
    description: "Queries https://registry.npmjs.org/-/v1/search",
    mimeType: "application/json",
  },
  {
    uri: "npm:registry/package",
    name: "npm Package API",
    description: "Reads https://registry.npmjs.org/<package>[/<version>]",
    mimeType: "application/json",
  },
  {
    uri: "npm:readme/<name>[@<version>]",
    name: "Package README",
    description: "Fetch README for a package via resource URI.",
    mimeType: "text/markdown",
  },
  {
    uri: "npm:downloads/<name>/<period>",
    name: "Package downloads",
    description: "Downloads from api.npmjs.org for last day/week/month.",
    mimeType: "application/json",
  },
];

export const resourceTemplates = [
  {
    uriTemplate: "npm://package/{name}",
    name: "Package Information",
    description: "Get detailed information about any npm package by name",
    mimeType: "application/json",
  },
  {
    uriTemplate: "npm://package/{name}/readme",
    name: "Package README",
    description: "Get the README for any npm package",
    mimeType: "text/markdown",
  },
  {
    uriTemplate: "npm://package/{name}/version/{version}",
    name: "Specific Package Version",
    description: "Get information about a specific version of a package",
    mimeType: "application/json",
  },
  {
    uriTemplate: "npm://package/{name}/downloads/{period}",
    name: "Package Downloads",
    description: "Get download statistics (period: last-day, last-week, last-month)",
    mimeType: "application/json",
  },
];

export async function handleResourceRead(uri: string): Promise<ResourceResponse> {
  if (uri === "npm:registry/search") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ endpoint: "https://registry.npmjs.org/-/v1/search", docs: "https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md" }, null, 2),
        },
      ],
    };
  }

  if (uri === "npm:registry/package") {
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ endpoint: "https://registry.npmjs.org/<package>[/<version>]", docs: "https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md" }, null, 2),
        },
      ],
    };
  }

  if (uri.startsWith("npm:readme/")) {
    const path = uri.replace("npm:readme/", "");
    const [namePart, versionPart] = path.split("@");
    const pkgName = decodeURIComponent(namePart);
    const version = versionPart ? decodeURIComponent(versionPart) : undefined;
    const data = await getReadme(pkgName, version);
    return {
      contents: [
        {
          uri,
          mimeType: "text/markdown",
          text: data.readme ?? "README not available",
        },
      ],
    };
  }

  if (uri.startsWith("npm:downloads/")) {
    const path = uri.replace("npm:downloads/", "");
    const [name, period] = path.split("/");
    if (!name || !period) throw new Error("Expected npm:downloads/<name>/<period>");
    const p = ["day", "week", "month"].includes(period) ? (period as "day" | "week" | "month") : "week";
    const data = await downloadsLast(p, decodeURIComponent(name));
    return {
      contents: [
        { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
      ],
    };
  }

  // Handle template URIs: npm://package/{name}
  if (uri.startsWith("npm://package/")) {
    const path = uri.replace("npm://package/", "");
    const parts = path.split("/");

    if (parts.length === 1) {
      // npm://package/{name} - Get package info
      const pkgName = decodeURIComponent(parts[0]);
      const cacheKey = key(["packageInfo", pkgName]);
      let cached = cacheGet<string>(cacheKey);
      if (!cached) {
        const [meta, dl, github] = await Promise.all([
          getReadme(pkgName).catch(() => null),
          downloadsLast("week", pkgName).catch(() => ({ downloads: 0, package: pkgName })),
          (async () => {
            const readmeData = await getReadme(pkgName).catch(() => null);
            if (readmeData?.repository) {
              return fetchGithubRepo(readmeData.repository).catch(() => null);
            }
            return null;
          })(),
        ]);
        const info = {
          name: meta?.name ?? pkgName,
          version: meta?.version ?? undefined,
          repository: meta?.repository ?? undefined,
          homepage: meta?.homepage ?? undefined,
          weeklyDownloads: dl.downloads,
          github: github ? { stars: github.stars, forks: github.forks, license: github.license } : null,
        };
        cached = JSON.stringify(info, null, 2);
        cacheSet(cacheKey, cached, 300000); // 5 min
      }
      return {
        contents: [{ uri, mimeType: "application/json", text: cached }],
      };
    }

    if (parts.length === 2 && parts[1] === "readme") {
      // npm://package/{name}/readme - Get package README
      const pkgName = decodeURIComponent(parts[0]);
      const data = await getReadme(pkgName);
      return {
        contents: [{
          uri,
          mimeType: "text/markdown",
          text: data.readme ?? "README not available",
        }],
      };
    }

    if (parts.length === 3 && parts[1] === "version") {
      // npm://package/{name}/version/{version} - Get specific version
      const pkgName = decodeURIComponent(parts[0]);
      const version = decodeURIComponent(parts[2]);
      const data = await getReadme(pkgName, version);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify({
            name: data.name,
            version: data.version ?? version,
            repository: data.repository ?? undefined,
            homepage: data.homepage ?? undefined,
          }, null, 2),
        }],
      };
    }

    if (parts.length === 3 && parts[1] === "downloads") {
      // npm://package/{name}/downloads/{period}
      const pkgName = decodeURIComponent(parts[0]);
      const period = parts[2] as "last-day" | "last-week" | "last-month";
      const periodMap = { "last-day": "day", "last-week": "week", "last-month": "month" } as const;
      const p = periodMap[period] ?? "week";
      const data = await downloadsLast(p, pkgName);
      return {
        contents: [{
          uri,
          mimeType: "application/json",
          text: JSON.stringify(data, null, 2),
        }],
      };
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
}
