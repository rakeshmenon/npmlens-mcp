# Advanced and Local Usage

This document collects the deeper, more technical details for
contributors and folks running NPMLens MCP locally.

## How to Test (local)

Basic smoke test (CLI, no MCP)

- Search: `pnpm demo:search -- react debounce hook`
- README: `pnpm demo:readme -- react`
- Info: `pnpm demo:info -- react`
- Downloads: `pnpm demo:downloads -- react week`
- Snippet: `pnpm demo:snippet -- react`

You should see JSON/text output with package lists, README content, weekly
downloads, and an extracted snippet.

## Demo CLI (no MCP)

A tiny CLI is included to try functionality directly during development.

### Search

```bash
npx -y npmlens-mcp@latest --help
# Or try a standalone search via the built-in demo commands in this
# repo (dev only)
pnpm demo:search -- react debounce hook

# Version pinning guidance
# - Latest (moving): use @latest
# - Major pin: npmlens-mcp@0 (gets newest 0.x)
# - Minor pin: npmlens-mcp@0.1 (newest 0.1.x)
# - Exact: npmlens-mcp@0.1.3
# Tip: check the current version with
# `npm view npmlens-mcp version`.
```

### Fetch README

```bash
pnpm demo:readme -- react
pnpm demo:readme -- lodash 4.17.21
```

### Enriched info (downloads + GitHub)

```bash
pnpm demo:info -- react
```

### Downloads

```bash
pnpm demo:downloads -- react week
```

### Usage snippet

```bash
pnpm demo:snippet -- react
```

## Tool Schemas

### Core Search & Information

#### search_npm

- input: `{ query: string, size?: number (1..250), from?: number,
  weights?: { quality?: number, popularity?: number, maintenance?:
  number } }`
- output: `{ total: number, results: Array<{ name, version,
  description?, date?, links, maintainers?, publisher?, keywords?,
  score }> }`

#### search_by_keywords

- input: `{ keywords: string[], operator?: 'AND'|'OR' (default 'AND'),
  size?: number (1..250) }`
- output: Same as `search_npm`
- example: `{ keywords: ["react", "hooks", "typescript"], operator:
  "AND", size: 10 }`

#### get_readme

- input: `{ name: string, version?: string, truncateAt?: number }`
- output: two contents
  - json content: `{ name, version?, repository?, homepage? }`
  - text content: README markdown (possibly truncated)

#### get_package_info

- input: `{ name: string, version?: string, includeReadme?: boolean }`
- output: `{ name, version?, repository?, homepage?, github?: {
  fullName, url, stars?, forks?, license? }, downloadsLastWeek: number,
  readme?: string }`

#### get_usage_snippet

- input: `{ name: string, version?: string }`
- output: `{ name, version?, snippet?: { language?, code, heading? } }`

### Version & Dependency Analysis

#### get_package_versions

- input: `{ name: string, limit?: number, since?: string }`
- output: `{ name: string, versions: Array<{ version: string, date:
  string, tags?: string[] }> }`
- since formats: ISO date (`"2024-01-01T00:00:00.000Z"`) or relative
  (`"6 months"`, `"1 year"`, `"30 days"`)
- example: `{ name: "react", limit: 10, since: "6 months" }`

#### get_package_dependencies

- input: `{ name: string, version?: string, depth?: number (1-3,
  default 1), includeDevDependencies?: boolean }`
- output: `{ name: string, version: string, dependencies: Array<{ name:
  string, version: string }>, devDependencies?: Array<{ name: string,
  version: string }> }`
- example: `{ name: "express", depth: 1, includeDevDependencies: true
  }`

### Metrics & Comparison

#### get_downloads

- input: `{ name: string, period?: 'day'|'week'|'month' }`
- output: npm downloads point payload

#### compare_packages

- input: `{ packages: string[] (1-10 packages) }`
- output: `Array<{ name: string, version?: string, description?: string,
  downloads?: number, stars?: number, forks?: number, license?: string,
  repository?: string, homepage?: string, error?: string }>`
- example: `{ packages: ["react", "vue", "svelte"] }`
- note: Fetches all packages in parallel; errors are returned per-package
  in the `error` field

## Example MCP Messages (stdio)

### Initialize

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "clientInfo": { "name": "demo", "version": "0.0.0" },
    "capabilities": {}
  }
}
```

### List tools

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

### Call search

```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "search_npm",
    "arguments": { "query": "react debounce hook", "size": 10 }
  }
}
```

### Call get_readme

```json
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_readme",
    "arguments": { "name": "react" }
  }
}
```

### Call get_package_info

```json
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "tools/call",
  "params": {
    "name": "get_package_info",
    "arguments": { "name": "react" }
  }
}
```

### Call get_package_versions

```json
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "tools/call",
  "params": {
    "name": "get_package_versions",
    "arguments": {
      "name": "react",
      "limit": 10,
      "since": "6 months"
    }
  }
}
```

### Call get_package_dependencies

```json
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "tools/call",
  "params": {
    "name": "get_package_dependencies",
    "arguments": {
      "name": "express",
      "depth": 1,
      "includeDevDependencies": true
    }
  }
}
```

### Call compare_packages

```json
{
  "jsonrpc": "2.0",
  "id": 8,
  "method": "tools/call",
  "params": {
    "name": "compare_packages",
    "arguments": { "packages": ["react", "vue", "svelte"] }
  }
}
```

### Call search_by_keywords

```json
{
  "jsonrpc": "2.0",
  "id": 9,
  "method": "tools/call",
  "params": {
    "name": "search_by_keywords",
    "arguments": {
      "keywords": ["react", "hooks", "typescript"],
      "operator": "AND",
      "size": 10
    }
  }
}
```

## Troubleshooting

- ESM import errors: ensure Node 18.17+ and that you ran `pnpm build`
  (or use `pnpm dev`).
- GitHub details missing: likely hitting unauthenticated rate limits;
  set `GITHUB_TOKEN`.
- Network or rate limit errors: retry, reduce requests, or increase
  cache TTL.
- MCP client cannot find the server: confirm absolute path to
  `dist/index.js` and correct permissions.

## Development

- Format/lint/typecheck: `pnpm lint`
- Tests: `pnpm test` (100% coverage enforced via `pnpm coverage`)
- Pre-commit hooks: Husky + lint-staged run typecheck, ESLint and
  related tests on staged files

## Security notes

- Inputs are validated by JSON Schema at the tool boundary; additional
  checks are in handlers.
- In-memory caching with TTL reduces request volume; adjust
  `CACHE_TTL_MS`/`CACHE_MAX` via env.
- GitHub API usage is optional; set `GITHUB_TOKEN` to raise rate limits.
- Only communicates with npm and GitHub APIs, no arbitrary URL fetching.

## Roadmap

- Add more filters (types, TS typings, keywords) for search.
- Support sorting by downloads/stars client-side.
- Add persistent cache or Etags for READMEs.
- Tests for search mapping and snippet extraction.
