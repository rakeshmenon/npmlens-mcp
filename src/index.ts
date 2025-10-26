/**
 * NPMLens MCP stdio server. Exposes tools for npm search, README retrieval,
 * enriched package info (downloads + GitHub), downloads, and usage snippets.
 * This is the executable entry point used by MCP clients.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { searchNpm, getReadme, getPackageVersions, getPackageDependencies, comparePackages } from "./npm.js";
import { cacheGet, cacheSet, key } from "./cache.js";
import { downloadsLast } from "./downloads.js";
import { fetchGithubRepo } from "./github.js";
import { extractUsageSnippet } from "./snippet.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
  ListResourceTemplatesRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

/** Normalize an unknown error into a human-readable message. */
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

type ToolContent = { type: "text"; text: string };
type ToolResult = { content: ToolContent[]; isError?: true };

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };

const server = new Server(
  { name: "NPMLens", version: packageJson.version },
  {
    capabilities: {
      tools: {},
      resources: {},
      prompts: {},
    },
  }
);

// Define all available tools
type ToolDefinition = {
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

const tools: ToolDefinition[] = [
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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
    handler: async (args) => {
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

// Register handler for listing all available tools
server.setRequestHandler(ListToolsRequestSchema, () => {
  return {
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  };
});

// Register handler for calling individual tools
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const toolName = request.params.name;
  const tool = tools.find((t) => t.name === toolName);

  if (!tool) {
    return {
      content: [
        {
          type: "text",
          text: `Unknown tool: ${toolName}`,
        },
      ],
      isError: true,
    };
  }

  return await tool.handler(request.params.arguments ?? {});
});

// Register handler for listing resources
server.setRequestHandler(ListResourcesRequestSchema, () => {
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
  };
});

// Register handler for reading resources
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;

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
      } as const;
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
      } as const;
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
      } as const;
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
      } as const;
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// Define example prompts to help users understand how to use the tools
const prompts = [
  {
    name: "search-packages",
    description: "Search for npm packages with examples",
    arguments: [
      {
        name: "query",
        description: "What to search for (e.g., 'react hooks', 'typescript testing')",
        required: true,
      },
    ],
  },
  {
    name: "analyze-package",
    description: "Get detailed information about a package including README, downloads, and GitHub stats",
    arguments: [
      {
        name: "packageName",
        description: "Name of the npm package (e.g., 'react', 'express')",
        required: true,
      },
    ],
  },
  {
    name: "compare-alternatives",
    description: "Compare multiple packages side-by-side",
    arguments: [
      {
        name: "packages",
        description: "Comma-separated package names (e.g., 'react-query,swr,apollo-client')",
        required: true,
      },
    ],
  },
  {
    name: "check-dependencies",
    description: "View a package's dependencies and their versions",
    arguments: [
      {
        name: "packageName",
        description: "Name of the package to analyze",
        required: true,
      },
    ],
  },
];

// Register handler for listing prompts
server.setRequestHandler(ListPromptsRequestSchema, () => {
  return {
    prompts,
  };
});

// Register handler for getting a specific prompt
server.setRequestHandler(GetPromptRequestSchema, (request) => {
  const prompt = prompts.find(p => p.name === request.params.name);
  if (!prompt) {
    throw new Error(`Prompt not found: ${request.params.name}`);
  }

  // Generate example messages based on the prompt
  const examples: Record<string, string> = {
    "search-packages": "Search npm for '{query}' and show me the top results with their download counts and descriptions.",
    "analyze-package": "Give me detailed information about the '{packageName}' npm package including its README, weekly downloads, GitHub stars, and a usage example.",
    "compare-alternatives": "Compare these npm packages: {packages}. Show me their download counts, GitHub stars, licenses, and help me decide which one to use.",
    "check-dependencies": "Show me all dependencies for '{packageName}' and their version requirements.",
  };

  return {
    description: prompt.description,
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: examples[request.params.name] || `Use the ${request.params.name} prompt`,
        },
      },
    ],
  };
});

// Register handler for listing resource templates
server.setRequestHandler(ListResourceTemplatesRequestSchema, () => {
  return {
    resourceTemplates: [
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
    ],
  };
});

/** Start the MCP server over stdio. */
async function main() {
  // Start the MCP server over stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal server error:", err);
  process.exit(1);
});
