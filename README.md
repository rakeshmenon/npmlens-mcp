# NPMLens MCP

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D18.17-339933?logo=node.js&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Server-6E56CF)
![Tests](https://img.shields.io/badge/tests-Vitest-729B1B?logo=vitest&logoColor=white)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Lint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

NPMLens MCP is a modern Model Context Protocol (MCP) server that gives AI agents and developers a fast, structured way to explore the npm registry — search packages, fetch READMEs, and pull useful context (downloads, GitHub info, snippets) without web scraping.

Highlights

- Structured npm search (with ranking weights)
- Direct README fetch with optional truncation
- Enriched package info (downloads + GitHub)
- Quick usage snippet extraction from README
- Stdio MCP transport, ready for MCP-compatible clients
- 100% test coverage; strict linting and type-checking

Tools

- `searchNpm` — Search npm with optional weights.
- `getReadme` — Fetch README text for a package/version.
- `getPackageInfo` — Registry + downloads + GitHub details.
- `getDownloads` — Day/week/month downloads from api.npmjs.org.
- `getUsageSnippet` — Extract a likely usage snippet from README.

Transport

- MCP over stdio (JSON-RPC). Works with MCP-compatible clients.

## Quick Start

Prerequisites

- Node.js 18.17+

Install

```bash
pnpm i
pnpm build
```

or with npm/yarn.

Run the MCP server (stdio)

```bash
node dist/index.js
```

The process speaks MCP over stdio. Point your MCP client to this binary.

Dev mode

```bash
pnpm dev
```

Automated tests and coverage

- Run tests: `pnpm test`
- Watch mode: `pnpm test:watch`
- Coverage (100% enforced): `pnpm coverage`
- HTML report at `coverage/index.html`

## How to Test

Basic smoke test (CLI, no MCP)

- Search: `pnpm demo:search -- react debounce hook`
- README: `pnpm demo:readme -- react`
- Info: `pnpm demo:info -- react`
- Downloads: `pnpm demo:downloads -- react week`
- Snippet: `pnpm demo:snippet -- react`

You should see JSON/text output with package lists, README content, weekly downloads, and an extracted snippet.

Test over MCP (stdio) using any MCP-compatible client

- Configure your client to launch the server command:
  - Command: `node`
  - Args: `["/absolute/path/to/dist/index.js"]`
- Example: Claude Desktop config (macOS) snippet for `claude_desktop_config.json`:

  ```json
  {
    "mcpServers": {
      "npmlens": {
        "command": "node",
        "args": ["/absolute/path/to/dist/index.js"]
      }
    }
  }
  ```

- After adding, restart the client and use the tools `searchNpm`, `getReadme`, `getPackageInfo`, `getDownloads`, `getUsageSnippet` from within the chat UI.

Manual MCP check (JSON-RPC examples)

- If your client allows sending raw JSON-RPC, use the messages below:
  - Initialize:

    ```json
    {"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"demo","version":"0.0.0"},"capabilities":{}}}
    ```

  - List tools:

    ```json
    {"jsonrpc":"2.0","id":2,"method":"tools/list"}
    ```

  - Call search:

    ```json
    {"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"searchNpm","arguments":{"query":"react debounce hook","size":10}}}
    ```

  - Call getReadme:

    ```json
    {"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"getReadme","arguments":{"name":"react"}}}
    ```

  - Call getPackageInfo:

    ```json
    {"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"getPackageInfo","arguments":{"name":"react"}}}
    ```

Environment variables (optional)

- `GITHUB_TOKEN`: increases GitHub API rate limits for repo enrichment.
- `CACHE_TTL_MS`: default TTL for in-memory cache (ms). Default 60000.
- `CACHE_MAX`: max entries for cache. Default 500.

## Demo CLI (no MCP)

A tiny CLI is included to try functionality directly:

Search

```bash
pnpm demo:search -- react debounce hook
```

Fetch README

```bash
pnpm demo:readme -- react
pnpm demo:readme -- lodash 4.17.21
```

Enriched info (downloads + GitHub)

```bash
pnpm demo:info -- react
```

Downloads

```bash
pnpm demo:downloads -- react week
```

Usage snippet

```bash
pnpm demo:snippet -- react
```

## Tool Schemas

searchNpm

- input: `{ query: string, size?: number (1..250), from?: number, weights?: { quality?: number, popularity?: number, maintenance?: number } }`
- output: `{ total: number, results: Array<{ name, version, description?, date?, links, maintainers?, publisher?, keywords?, score }> }`

getReadme

- input: `{ name: string, version?: string, truncateAt?: number }`
- output: two contents
  - json content: `{ name, version?, repository?, homepage? }`
  - text content: README markdown (possibly truncated)

getPackageInfo

- input: `{ name: string, version?: string, includeReadme?: boolean }`
- output: `{ name, version?, repository?, homepage?, github?: { fullName, url, stars?, forks?, license? }, downloadsLastWeek: number, readme?: string }`

getDownloads

- input: `{ name: string, period?: 'day'|'week'|'month' }`
- output: npm downloads point payload

getUsageSnippet

- input: `{ name: string, version?: string }`
- output: `{ name, version?, snippet?: { language?, code, heading? } }`

## Example MCP Messages (stdio)

Initialize

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"demo","version":"0.0.0"},"capabilities":{}}}
```

List tools

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

Call searchNpm

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"searchNpm","arguments":{"query":"react debounce hook","size":10}}}
```

Call getReadme

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"getReadme","arguments":{"name":"react"}}}
```

Get enriched info

```json
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"getPackageInfo","arguments":{"name":"react"}}}
```

## Troubleshooting

- ESM import errors: ensure Node 18.17+ and that you ran `pnpm build` (or use `pnpm dev`).
- GitHub details missing: likely hitting unauthenticated rate limits; set `GITHUB_TOKEN`.
- Network or rate limit errors: retry, reduce requests, or increase cache TTL.
- MCP client cannot find the server: confirm absolute path to `dist/index.js` and correct permissions.

## Development

- Format/lint/typecheck: `pnpm lint`
- Tests: `pnpm test` (100% coverage enforced via `pnpm coverage`)
- Pre-commit hooks: Husky + lint-staged run typecheck, ESLint and related tests on staged files

## License

MIT — see `LICENSE`.

## Security notes

- Inputs are validated by JSON Schema at the tool boundary; additional checks are in handlers.
- In-memory caching with TTL reduces request volume; adjust `CACHE_TTL_MS`/`CACHE_MAX` via env.
- GitHub API usage is optional; set `GITHUB_TOKEN` to raise rate limits.
- Only communicates with npm and GitHub APIs, no arbitrary URL fetching.

## Roadmap

- Add more filters (types, TS typings, keywords) for search.
- Support sorting by downloads/stars client-side.
- Add persistent cache or Etags for READMEs.
- Tests for search mapping and snippet extraction.

## License

MIT — see `LICENSE`.
