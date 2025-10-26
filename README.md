<div align="center">
  <img src="images/npmlens-mcp-logo.svg" alt="NPMLens MCP Logo"
       width="80" height="80">
  <h1>NPMLens MCP</h1>
</div>

<p>
  <a href="https://npmjs.org/package/npmlens-mcp">
    <img src="https://img.shields.io/npm/v/npmlens-mcp.svg"
         alt="npm version">
  </a>
  <a href="https://github.com/rakeshmenon/npmlens-mcp/actions/workflows/ci.yml">
    <img
      src="https://github.com/rakeshmenon/npmlens-mcp/actions/workflows/ci.yml/badge.svg"
      alt="CI">
  </a>
  <img src="https://img.shields.io/npm/dm/npmlens-mcp?logo=npm"
       alt="npm downloads">
  <img
    src="https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white"
    alt="TypeScript">
  <img
    src="https://img.shields.io/badge/Node-%3E%3D18.17-339933?logo=node.js&logoColor=white"
    alt="Node">
  <img src="https://img.shields.io/badge/MCP-Server-6E56CF" alt="MCP">
  <img
    src="https://img.shields.io/badge/tests-Vitest-729B1B?logo=vitest&logoColor=white"
    alt="Tests">
  <img src="https://img.shields.io/badge/coverage-100%25-brightgreen"
       alt="Coverage">
  <img
    src="https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white"
    alt="Lint">
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="License">
</p>

`npmlens-mcp` lets your coding agent (such as Claude, Cursor, Copilot,
Gemini or Codex) search the npm registry and fetch package context
(README, downloads, GitHub info, usage snippets). It acts as a
Model‑Context‑Protocol (MCP) server, giving your AI assistant a
structured way to discover libraries and integrate them quickly.

## [Changelog](https://github.com/rakeshmenon/npmlens-mcp/releases) | [Contributing](./CONTRIBUTING.md) | [Troubleshooting](./docs/advanced.md#troubleshooting) | [Tool reference](./docs/advanced.md#tool-schemas)

## Key features

- Structured npm search with optional ranking weights.
- Direct README fetch (optionally truncated).
- Enriched package info (downloads + GitHub details).
- Usage snippet extraction from README.
- Stdio MCP transport, ready for MCP‑compatible clients.

## Disclaimers

`npmlens-mcp` performs network requests to npm and GitHub when tools are
used. Avoid sharing secrets in prompts; set `GITHUB_TOKEN` only if you
want higher GitHub rate limits.

## Requirements

- Node.js v18.17 or newer
- npm (or pnpm)

## Getting started

Add the following config to your MCP client:

```json
{
  "mcpServers": {
    "npmlens": {
      "command": "npx",
      "args": ["-y", "npmlens-mcp@latest"]
    }
  }
}
```

> [!NOTE]
> Using `npmlens-mcp@latest` ensures your MCP client always runs the
> latest published version.

### MCP Client configuration

<details>
  <summary>Amp</summary>
  Follow the Amp docs and use the config provided above. You can also
  install via CLI:

```bash
amp mcp add npmlens -- npx npmlens-mcp@latest
```

</details>

<details>
  <summary>Claude Code</summary>
  Use the Claude Code CLI to add the NPMLens MCP server (see the Claude
  Code MCP guide):

```bash
claude mcp add npmlens npx npmlens-mcp@latest
```

</details>

<details>
  <summary>Cline</summary>
  Follow <https://docs.cline.bot/mcp/configuring-mcp-servers> and use the
  config provided above.
</details>

<details>
  <summary>Codex</summary>
  Use the Codex CLI to add the server:

```bash
codex mcp add npmlens -- npx npmlens-mcp@latest
```

</details>

<details>
  <summary>Copilot CLI</summary>

Start Copilot CLI:

```bash
copilot
```

Start the dialog to add a new MCP server by running:

```bash
/mcp add
```

Configure the following fields and press `CTRL+S` to save:

- **Server name:** `npmlens`
- **Server Type:** `Local`
- **Command:** `npx -y npmlens-mcp@latest`

</details>

<details>
  <summary>Copilot / VS Code</summary>
  Use the VS Code CLI:

```bash
code --add-mcp '{"name":"npmlens","command":"npx","args":["-y","npmlens-mcp@latest"]}'
```

</details>

<details>
  <summary>Cursor</summary>

Go to `Cursor Settings` -> `MCP` -> `New MCP Server`. Use the config provided above.

</details>

<details>
  <summary>Gemini CLI</summary>
  Install the NPMLens MCP server using the Gemini CLI.

**Project wide:**

```bash
gemini mcp add npmlens npx npmlens-mcp@latest
```

**Globally:**

```bash
gemini mcp add -s user npmlens npx npmlens-mcp@latest
```

Alternatively, follow the Gemini CLI MCP guide and use the standard
config from above.

</details>

<details>
  <summary>Gemini Code Assist</summary>
  Follow the provider guide to configure MCP servers and use the
  standard config from above.
</details>

<details>
  <summary>JetBrains AI Assistant & Junie</summary>

Go to `Settings | Tools | AI Assistant | Model Context Protocol (MCP)`
-> `Add`. Use the config provided above. Same for Junie under
`Settings | Tools | Junie | MCP Settings` -> `Add`.

</details>

<details>
  <summary>Warp</summary>

Go to `Settings | AI | Manage MCP Servers` -> `+ Add` and use the
config provided above.

</details>

### Your first prompt

Enter one of the following prompts in your MCP client to check if everything works:

**Basic search and info:**

```text
Find 5 React debounce hook libraries, include weekly downloads, and
fetch the README for the top result.
```

**Compare packages:**

```text
Compare react-query, swr, and apollo-client. Show me their weekly
downloads, GitHub stars, and licenses.
```

**Version history:**

```text
Show me all TypeScript versions released in the last 6 months with
their publish dates.
```

**Dependencies:**

```text
What are the dependencies of express? Include dev dependencies.
```

---

## Advanced and Local Usage

Looking for JSON‑RPC examples, tool schemas, the local dev CLI,
troubleshooting, or contributor setup?

- See `docs/advanced.md` for all technical details.
- See `CONTRIBUTING.md` for contributing guidelines.

## Tools

Below are the tools exposed by NPMLens MCP. For full JSON schemas, see
the [Tool reference](./docs/advanced.md#tool-schemas).

### Core Search & Information

- `search_npm`
  - Search the npm registry with optional ranking weights.
  - Args: `query` (string, required), `size` (1..250), `from` (offset),
    `weights` (object with `quality`, `popularity`, `maintenance`).
  - Returns: `{ total, results[] }` where each result includes `name`,
    `version`, `description`, `links`, `score`, etc.

- `search_by_keywords`
  - Search npm packages by specific keywords/tags with AND/OR operators.
  - Args: `keywords` (array of strings, required), `operator` (`AND` |
    `OR`, default `AND`), `size` (1..250).
  - Returns: Same as `search_npm`.
  - Example: Find packages with "react" AND "hooks" AND "typescript".

- `get_readme`
  - Fetch README markdown for a package (optionally by version).
  - Args: `name` (string, required), `version` (string), `truncateAt`
    (number).
  - Returns: JSON metadata (`name`, `version`, `repository`, `homepage`)
    and the README as text content.

- `get_package_info`
  - Enriched package info combining registry metadata, npm downloads,
    and GitHub details.
  - Args: `name` (string, required), `version` (string), `includeReadme`
    (boolean).
  - Returns: `name`, `version`, `repository`, `homepage`, `github{
    fullName, url, stars, forks, license }`, `downloadsLastWeek`, and
    optional `readme`.

- `get_usage_snippet`
  - Extract a likely usage snippet from a package README.
  - Args: `name` (string, required), `version` (string).
  - Returns: `{ snippet: { language, code, heading } }`.

### Version & Dependency Analysis

- `get_package_versions`
  - List all available versions of a package with publish dates and dist
    tags.
  - Args: `name` (string, required), `limit` (number), `since` (string -
    ISO date or relative like "6 months").
  - Returns: `{ name, versions[] }` where each version includes
    `version`, `date`, `tags[]`.
  - Example: "Show me all React versions from the last year".

- `get_package_dependencies`
  - Get the dependency tree for a package.
  - Args: `name` (string, required), `version` (string), `depth` (1-3,
    default 1), `includeDevDependencies` (boolean).
  - Returns: `{ name, version, dependencies[], devDependencies[] }` with
    name and version range for each dependency.
  - Example: "What dependencies does express have?".

### Metrics & Comparison

- `get_downloads`
  - Fetch npm downloads for the last `day`/`week`/`month`.
  - Args: `name` (string, required), `period` (`day` | `week` | `month`,
    default `week`).
  - Returns: `{ downloads, start, end, package }`.

- `compare_packages`
  - Compare multiple npm packages side-by-side.
  - Args: `packages` (array of 1-10 package names, required).
  - Returns: Array of comparison data with `name`, `version`,
    `description`, `downloads`, `stars`, `forks`, `license`,
    `repository`, `homepage`, and optional `error`.
  - Fetches all packages in parallel for performance.
  - Example: "Compare react-query, swr, and apollo-client".

## Version pinning guidance

- Latest (moving): use `@latest`.
- Major pin: `npmlens-mcp@0` (newest 0.x).
- Minor pin: `npmlens-mcp@0.1` (newest 0.1.x).
- Exact: `npmlens-mcp@0.1.3`.

Tip: check the current version with `npm view npmlens-mcp version`.
