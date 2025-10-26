#!/usr/bin/env node
import { searchNpm as _searchNpm, getReadme as _getReadme } from "./npm.js";
import { downloadsLast as _downloadsLast } from "./downloads.js";
import { fetchGithubRepo as _fetchGithubRepo } from "./github.js";
import { extractUsageSnippet as _extractUsageSnippet } from "./snippet.js";

function isPeriod(x: string): x is "day" | "week" | "month" {
  return x === "day" || x === "week" || x === "month";
}

export async function run(
  argv: string[] = process.argv,
  deps: {
    searchNpm?: typeof _searchNpm;
    getReadme?: typeof _getReadme;
    downloadsLast?: typeof _downloadsLast;
    fetchGithubRepo?: typeof _fetchGithubRepo;
    extractUsageSnippet?: typeof _extractUsageSnippet;
  } = {}
): Promise<void> {
  const searchNpm = deps.searchNpm ?? _searchNpm;
  const getReadme = deps.getReadme ?? _getReadme;
  const downloadsLast = deps.downloadsLast ?? _downloadsLast;
  const fetchGithubRepo = deps.fetchGithubRepo ?? _fetchGithubRepo;
  const extractUsageSnippet = deps.extractUsageSnippet ?? _extractUsageSnippet;
  const [cmd, ...rest] = argv.slice(2);
  if (!cmd || ["-h", "--help"].includes(cmd)) return help();
  try {
    if (cmd === "search") {
      const joined = rest.join(" ").trim();
      const envQuery = process.env.QUERY;
      const query = joined.length > 0 ? joined : envQuery ?? "react debounce hook";
      const { total, results } = await searchNpm(query, 10);
      console.log(JSON.stringify({ total, results }, null, 2));
      return;
    }
    if (cmd === "readme") {
      const name = rest[0] ?? process.env.PKG;
      const version = rest[1] ?? process.env.VERSION;
      if (!name) throw new Error("Usage: readme <package> [version]");
      const data = await getReadme(name, version);
      console.log(`# ${data.name}${data.version ? "@" + data.version : ""}`);
      if (data.repository) console.log(`Repository: ${data.repository}`);
      if (data.homepage) console.log(`Homepage: ${data.homepage}`);
      console.log();
      console.log(data.readme ?? "README not available");
      return;
    }
    if (cmd === "info") {
      const name = rest[0] ?? process.env.PKG;
      const version = rest[1] ?? process.env.VERSION;
      if (!name) throw new Error("Usage: info <package> [version]");
      const meta = await getReadme(name, version);
      const dl = await downloadsLast("week", name);
      const gh = await fetchGithubRepo(meta.repository);
      console.log(
        JSON.stringify(
          {
            name: meta.name,
            version: meta.version,
            repository: gh?.url ?? meta.repository,
            homepage: meta.homepage,
            github: gh,
            downloadsLastWeek: dl.downloads,
          },
          null,
          2
        )
      );
      return;
    }
    if (cmd === "downloads") {
      const name = rest[0] ?? process.env.PKG;
      const raw = (rest[1] ?? process.env.PERIOD) ?? "week";
      const p: "day" | "week" | "month" = isPeriod(raw) ? raw : "week";
      if (!name) throw new Error("Usage: downloads <package> [day|week|month]");
      const dl = await downloadsLast(p, name);
      console.log(JSON.stringify(dl, null, 2));
      return;
    }
    if (cmd === "snippet") {
      const name = rest[0] ?? process.env.PKG;
      const version = rest[1] ?? process.env.VERSION;
      if (!name) throw new Error("Usage: snippet <package> [version]");
      const meta = await getReadme(name, version);
      const snip = extractUsageSnippet(meta.readme);
      console.log(JSON.stringify({ name: meta.name, version: meta.version, snippet: snip }, null, 2));
      return;
    }
    throw new Error(`Unknown command: ${cmd}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    process.exit(1);
  }
}

function help(): void {
  console.log(
    `NPMLens MCP demo CLI\n\nCommands:\n  search <query...>    Search npm (default: 'react debounce hook')\n  readme <pkg> [ver]   Print README for package\n  info <pkg> [ver]     Print enriched info (downloads + GitHub)\n  downloads <pkg> [p]  Print downloads for day/week/month\n  snippet <pkg> [ver]  Extract usage snippet from README\n`
  );
}

/* c8 ignore next 3 */
if (!process.env.VITEST) {
  void run();
}
