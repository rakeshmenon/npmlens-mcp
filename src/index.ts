/**
 * NPMLens MCP stdio server. Exposes tools for npm search, README retrieval,
 * enriched package info (downloads + GitHub), downloads, and usage snippets.
 * This is the executable entry point used by MCP clients.
 */
import { searchNpm, getReadme } from "./npm.js";
import { cacheGet, cacheSet, key } from "./cache.js";
import { downloadsLast } from "./downloads.js";
import { fetchGithubRepo } from "./github.js";
import { extractUsageSnippet } from "./snippet.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

/** Normalize an unknown error into a human-readable message. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

type ToolContent =
  | { type: "json"; json: unknown }
  | { type: "text"; text: string };
type ToolResult = { content: ToolContent[]; isError?: true };
type ToolHandler = (args: unknown) => Promise<ToolResult>;
type ToolDef = { description: string; inputSchema: unknown };
type ResourceListResp = { resources: { uri: string; name: string; description?: string; mimeType?: string }[] };
type ResourceReadResp = { contents: { uri: string; mimeType: string; text?: string }[] };
type ServerLike = {
  tool: (name: string, def: ToolDef, handler: ToolHandler) => void;
  setResourceHandlers: (h: { list: () => ResourceListResp | Promise<ResourceListResp>; read: (uri: string) => Promise<ResourceReadResp> }) => void;
  start: (transport: unknown) => Promise<void>;
};

const server = (new Server(
  { name: "npmlens-mcp", version: "0.1.0" },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
) as unknown) as ServerLike;

server.tool(
  "searchNpm",
  {
    description: "Search the npm registry for packages.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text, e.g. 'react debounce hook'" },
        size: { type: "number", minimum: 1, maximum: 250, default: 10 },
        from: { type: "number", minimum: 0, default: 0 },
        weights: {
          type: "object",
          properties: {
            quality: { type: "number" },
            popularity: { type: "number" },
            maintenance: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { query, size = 10, from = 0, weights } = args as {
        query: string;
        size?: number;
        from?: number;
        weights?: { quality?: number; popularity?: number; maintenance?: number };
      };
      const k = key(["search", query, size, from, weights ?? {}]);
      const cached = cacheGet<unknown>(k);
      if (cached) {
        return { content: [{ type: "json", json: cached }] } as const;
      }
      const { total, results } = await searchNpm(query, size, from, weights);
      const payload = { total, results };
      cacheSet(k, payload);
      return {
        content: [{ type: "json", json: payload }],
      } as const;
    } catch (err: unknown) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `searchNpm error: ${errorMessage(err)}`,
          },
        ],
      } as const;
    }
  }
);

// snake_case alias
server.tool(
  "search_npm",
  {
    description: "Search the npm registry for packages.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text, e.g. 'react debounce hook'" },
        size: { type: "number", minimum: 1, maximum: 250, default: 10 },
        from: { type: "number", minimum: 0, default: 0 },
        weights: {
          type: "object",
          properties: {
            quality: { type: "number" },
            popularity: { type: "number" },
            maintenance: { type: "number" },
          },
          additionalProperties: false,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { query, size = 10, from = 0, weights } = args as {
        query: string;
        size?: number;
        from?: number;
        weights?: { quality?: number; popularity?: number; maintenance?: number };
      };
      const k = key(["search", query, size, from, weights ?? {}]);
      const cached = cacheGet<unknown>(k);
      if (cached) {
        return { content: [{ type: "json", json: cached }] } as const;
      }
      const { total, results } = await searchNpm(query, size, from, weights);
      const payload = { total, results };
      cacheSet(k, payload);
      return {
        content: [{ type: "json", json: payload }],
      } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `searchNpm error: ${errorMessage(err)}` }] } as const;
    }
  }
);

server.tool(
  "getReadme",
  {
    description: "Fetch README text for a given npm package (optionally a specific version).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Package name, e.g. 'react'" },
        version: { type: "string", description: "Optional version, e.g. '18.2.0'" },
        truncateAt: { type: "number", description: "If set, truncate README to this many characters." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, version, truncateAt } = args as { name: string; version?: string; truncateAt?: number };
      const k = key(["readme", name, version ?? "latest"]);
      const cached = cacheGet<unknown>(k) as { name: string; version?: string; readme?: string; repository?: string; homepage?: string } | undefined;
      const data = cached ?? (await getReadme(name, version));
      if (!cached) cacheSet(k, data, 5 * 60_000);
      const readme = typeof truncateAt === "number" && data.readme ? data.readme.slice(0, truncateAt) : data.readme;
      return {
        content: [
          { type: "json", json: { name: data.name, version: data.version, repository: data.repository, homepage: data.homepage } },
          { type: "text", text: readme ?? "README not available" },
        ],
      } as const;
    } catch (err: unknown) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `getReadme error: ${errorMessage(err)}`,
          },
        ],
      } as const;
    }
  }
);

// snake_case alias
server.tool(
  "get_readme",
  {
    description: "Fetch README text for a given npm package (optionally a specific version).",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Package name, e.g. 'react'" },
        version: { type: "string", description: "Optional version, e.g. '18.2.0'" },
        truncateAt: { type: "number", description: "If set, truncate README to this many characters." },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, version, truncateAt } = args as { name: string; version?: string; truncateAt?: number };
      const k = key(["readme", name, version ?? "latest"]);
      const cached = cacheGet<unknown>(k) as { name: string; version?: string; readme?: string; repository?: string; homepage?: string } | undefined;
      const data = cached ?? (await getReadme(name, version));
      if (!cached) cacheSet(k, data, 5 * 60_000);
      const readme = typeof truncateAt === "number" && data.readme ? data.readme.slice(0, truncateAt) : data.readme;
      return {
        content: [
          { type: "json", json: { name: data.name, version: data.version, repository: data.repository, homepage: data.homepage } },
          { type: "text", text: readme ?? "README not available" },
        ],
      } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getReadme error: ${errorMessage(err)}` }] } as const;
    }
  }
);

server.tool(
  "getPackageInfo",
  {
    description:
      "Get enriched package info: registry metadata, last-week downloads, and GitHub repo details when available.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        includeReadme: { type: "boolean", default: false },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, version, includeReadme = false } = args as { name: string; version?: string; includeReadme?: boolean };
      const k = key(["info", name, version ?? "latest", includeReadme]);
      const cached = cacheGet<unknown>(k);
      if (cached) return { content: [{ type: "json", json: cached }] } as const;

      const pkg = await getReadme(name, version); // also gives repository/homepage
      const downloads = await downloadsLast("week", name);
      const gh = await fetchGithubRepo(pkg.repository);
      const payload = {
        name: pkg.name,
        version: pkg.version,
        repository: gh?.url ?? pkg.repository,
        homepage: pkg.homepage,
        github: gh,
        downloadsLastWeek: downloads.downloads,
        readme: includeReadme ? pkg.readme : undefined,
      };
      cacheSet(k, payload, 5 * 60_000);
      return { content: [{ type: "json", json: payload }] } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getPackageInfo error: ${errorMessage(err)}` }] } as const;
    }
  }
);

// snake_case alias
server.tool(
  "get_package_info",
  {
    description:
      "Get enriched package info: registry metadata, last-week downloads, and GitHub repo details when available.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
        includeReadme: { type: "boolean", default: false },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, version, includeReadme = false } = args as { name: string; version?: string; includeReadme?: boolean };
      const k = key(["info", name, version ?? "latest", includeReadme]);
      const cached = cacheGet<unknown>(k);
      if (cached) return { content: [{ type: "json", json: cached }] } as const;

      const pkg = await getReadme(name, version);
      const downloads = await downloadsLast("week", name);
      const gh = await fetchGithubRepo(pkg.repository);
      const payload = {
        name: pkg.name,
        version: pkg.version,
        repository: gh?.url ?? pkg.repository,
        homepage: pkg.homepage,
        github: gh,
        downloadsLastWeek: downloads.downloads,
        readme: includeReadme ? pkg.readme : undefined,
      };
      cacheSet(k, payload, 5 * 60_000);
      return { content: [{ type: "json", json: payload }] } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getPackageInfo error: ${errorMessage(err)}` }] } as const;
    }
  }
);

server.tool(
  "getDownloads",
  {
    description: "Get npm downloads for the last day/week/month.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        period: { type: "string", enum: ["day", "week", "month"], default: "week" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, period = "week" } = args as { name: string; period?: "day" | "week" | "month" };
      const k = key(["downloads", name, period]);
      const cached = cacheGet<unknown>(k);
      if (cached) return { content: [{ type: "json", json: cached }] } as const;
      const data = await downloadsLast(period, name);
      cacheSet(k, data, 10 * 60_000);
      return { content: [{ type: "json", json: data }] } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getDownloads error: ${errorMessage(err)}` }] } as const;
    }
  }
);

// snake_case alias
server.tool(
  "get_downloads",
  {
    description: "Get npm downloads for the last day/week/month.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        period: { type: "string", enum: ["day", "week", "month"], default: "week" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, period = "week" } = args as { name: string; period?: "day" | "week" | "month" };
      const k = key(["downloads", name, period]);
      const cached = cacheGet<unknown>(k);
      if (cached) return { content: [{ type: "json", json: cached }] } as const;
      const data = await downloadsLast(period, name);
      cacheSet(k, data, 10 * 60_000);
      return { content: [{ type: "json", json: data }] } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getDownloads error: ${errorMessage(err)}` }] } as const;
    }
  }
);

server.tool(
  "getUsageSnippet",
  {
    description: "Extract a likely usage snippet from a package's README.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, version } = args as { name: string; version?: string };
      const data = await getReadme(name, version);
      const snippet = extractUsageSnippet(data.readme);
      return { content: [{ type: "json", json: { name: data.name, version: data.version, snippet } }] } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getUsageSnippet error: ${errorMessage(err)}` }] } as const;
    }
  }
);

// snake_case alias
server.tool(
  "get_usage_snippet",
  {
    description: "Extract a likely usage snippet from a package's README.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        version: { type: "string" },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  async (args) => {
    try {
      const { name, version } = args as { name: string; version?: string };
      const data = await getReadme(name, version);
      const snippet = extractUsageSnippet(data.readme);
      return { content: [{ type: "json", json: { name: data.name, version: data.version, snippet } }] } as const;
    } catch (err: unknown) {
      return { isError: true, content: [{ type: "text", text: `getUsageSnippet error: ${errorMessage(err)}` }] } as const;
    }
  }
);

// Basic resource listing to advertise the npm endpoints this server uses.
// This is optional but helpful for discovery.
server.setResourceHandlers({
  list: () => {
    return {
      resources: [
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
      ],
    } as const;
  },
  read: async (uri: string) => {
    if (uri === "npm:registry/search") {
      return {
        contents: [
          {
            uri,
            mimeType: "application/json",
            text: JSON.stringify({ endpoint: "https://registry.npmjs.org/-/v1/search", docs: "https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md" }, null, 2),
          },
        ],
      } as const;
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
      } as const;
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
      } as const;
    }
    if (uri.startsWith("npm:downloads/")) {
      const [, , name, period] = uri.split("/");
      if (!name || !period) throw new Error("Expected npm:downloads/<name>/<period>");
      const p = ["day", "week", "month"].includes(period) ? (period as "day" | "week" | "month") : "week";
      const data = await downloadsLast(p, decodeURIComponent(name));
      return {
        contents: [
          { uri, mimeType: "application/json", text: JSON.stringify(data, null, 2) },
        ],
      } as const;
    }
    throw new Error(`Unknown resource: ${uri}`);
  },
});

/** Start the MCP server over stdio. */
async function main() {
  // Start the MCP server over stdio
  const transport = new StdioServerTransport();
  await server.start(transport);
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
