/**
 * Tool definitions and handlers for NPMLens MCP server.
 * Each tool follows the pattern: validate input -> check cache -> execute -> cache result -> return.
 */
import { searchNpm, getReadme, getPackageVersions, getPackageDependencies, comparePackages } from "./npm.js";
import { cacheGet, cacheSet, key } from "./cache.js";
import { downloadsLast } from "./downloads.js";
import { fetchGithubRepo } from "./github.js";
import { extractUsageSnippet } from "./snippet.js";

/** Normalize an unknown error into a human-readable message. */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export type ToolContent = { type: "text"; text: string };
export type ToolResult = { content: ToolContent[]; isError?: true };

export type ToolDefinition = {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
  handler: (args: unknown) => Promise<ToolResult>;
};

export const tools: ToolDefinition[] = [
  {
    name: "search_npm",
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
    handler: async (args: unknown): Promise<ToolResult> => {
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
          return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        }
        const { total, results } = await searchNpm(query, size, from, weights);
        const payload = { total, results };
        cacheSet(k, payload);
        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
        };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `searchNpm error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "get_readme",
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
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { name, version, truncateAt } = args as { name: string; version?: string; truncateAt?: number };
        const k = key(["readme", name, version ?? "latest"]);
        const cached = cacheGet<unknown>(k) as { name: string; version?: string; readme?: string; repository?: string; homepage?: string } | undefined;
        const data = cached ?? (await getReadme(name, version));
        if (!cached) cacheSet(k, data, 5 * 60_000);
        const readme = typeof truncateAt === "number" && data.readme ? data.readme.slice(0, truncateAt) : data.readme;
        const metadata = { name: data.name, version: data.version, repository: data.repository, homepage: data.homepage };
        const output = `${JSON.stringify(metadata, null, 2)}\n\n--- README ---\n${readme ?? "README not available"}`;
        return {
          content: [{ type: "text", text: output }],
        };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `getReadme error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "get_package_info",
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
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { name, version, includeReadme = false } = args as { name: string; version?: string; includeReadme?: boolean };
        const k = key(["info", name, version ?? "latest", includeReadme]);
        const cached = cacheGet<unknown>(k);
        if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };

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
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `getPackageInfo error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "get_downloads",
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
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { name, period = "week" } = args as { name: string; period?: "day" | "week" | "month" };
        const k = key(["downloads", name, period]);
        const cached = cacheGet<unknown>(k);
        if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        const data = await downloadsLast(period, name);
        cacheSet(k, data, 10 * 60_000);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `getDownloads error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "get_usage_snippet",
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
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { name, version } = args as { name: string; version?: string };
        const data = await getReadme(name, version);
        const snippet = extractUsageSnippet(data.readme);
        const payload = { name: data.name, version: data.version, snippet };
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `getUsageSnippet error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "get_package_versions",
    description: "List all available versions of a package with publish dates and dist tags.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Package name" },
        limit: { type: "number", minimum: 1, description: "Maximum number of versions to return" },
        since: { type: "string", description: "Filter versions published after this date (ISO date or relative like '6 months')" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { name, limit, since } = args as { name: string; limit?: number; since?: string };
        const k = key(["versions", name, limit ?? 0, since ?? ""]);
        const cached = cacheGet<unknown>(k);
        if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        const data = await getPackageVersions(name, limit, since);
        cacheSet(k, data, 5 * 60_000);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `get_package_versions error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "get_package_dependencies",
    description: "Get the dependency tree for a package.",
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Package name" },
        version: { type: "string", description: "Package version (defaults to latest)" },
        depth: { type: "number", minimum: 1, maximum: 3, default: 1, description: "Depth of dependency tree to fetch" },
        includeDevDependencies: { type: "boolean", default: false, description: "Include devDependencies" },
      },
      required: ["name"],
      additionalProperties: false,
    },
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { name, version, depth = 1, includeDevDependencies = false } = args as {
          name: string;
          version?: string;
          depth?: number;
          includeDevDependencies?: boolean;
        };
        const k = key(["deps", name, version ?? "latest", depth, includeDevDependencies]);
        const cached = cacheGet<unknown>(k);
        if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        const data = await getPackageDependencies(name, version, depth, includeDevDependencies);
        cacheSet(k, data, 5 * 60_000);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `get_package_dependencies error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "compare_packages",
    description: "Compare multiple npm packages side-by-side (downloads, stars, license, etc.).",
    inputSchema: {
      type: "object",
      properties: {
        packages: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          maxItems: 10,
          description: "Array of package names to compare",
        },
      },
      required: ["packages"],
      additionalProperties: false,
    },
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { packages } = args as { packages: string[] };
        const k = key(["compare", ...packages.sort()]);
        const cached = cacheGet<unknown>(k);
        if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        const data = await comparePackages(packages);
        cacheSet(k, data, 5 * 60_000);
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `compare_packages error: ${errorMessage(err)}` }] };
      }
    },
  },
  {
    name: "search_by_keywords",
    description: "Search npm packages by specific keywords/tags.",
    inputSchema: {
      type: "object",
      properties: {
        keywords: {
          type: "array",
          items: { type: "string" },
          minItems: 1,
          description: "Keywords to search for",
        },
        operator: {
          type: "string",
          enum: ["AND", "OR"],
          default: "AND",
          description: "Logical operator for combining keywords",
        },
        size: { type: "number", minimum: 1, maximum: 250, default: 10 },
      },
      required: ["keywords"],
      additionalProperties: false,
    },
    handler: async (args: unknown): Promise<ToolResult> => {
      try {
        const { keywords, operator = "AND", size = 10 } = args as { keywords: string[]; operator?: "AND" | "OR"; size?: number };
        // Construct search query
        const query = operator === "AND" ? keywords.join(" ") : keywords.join(" OR ");
        const k = key(["search_keywords", query, size]);
        const cached = cacheGet<unknown>(k);
        if (cached) return { content: [{ type: "text", text: JSON.stringify(cached, null, 2) }] };
        const { total, results } = await searchNpm(query, size);
        const payload = { total, results };
        cacheSet(k, payload);
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      } catch (err: unknown) {
        return { isError: true, content: [{ type: "text", text: `search_by_keywords error: ${errorMessage(err)}` }] };
      }
    },
  },
];
