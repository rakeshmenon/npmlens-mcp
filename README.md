# NPMLens MCP

[![npm npmlens-mcp package](https://img.shields.io/npm/v/npmlens-mcp.svg)](https://npmjs.org/package/npmlens-mcp)
[![CI](https://github.com/rakeshmenon/npmlens-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/rakeshmenon/npmlens-mcp/actions/workflows/ci.yml)
![npm downloads](https://img.shields.io/npm/dm/npmlens-mcp?logo=npm)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node](https://img.shields.io/badge/Node-%3E%3D18.17-339933?logo=node.js&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-Server-6E56CF)
![Tests](https://img.shields.io/badge/tests-Vitest-729B1B?logo=vitest&logoColor=white)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![Lint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

`npmlens-mcp` lets your coding agent (such as Claude, Cursor, Copilot, Gemini or Codex)
search the npm registry and fetch package context (README, downloads, GitHub info, usage snippets).
It acts as a Model‑Context‑Protocol (MCP) server, giving your AI assistant a structured way to
discover libraries and integrate them quickly.

## [Changelog](https://github.com/rakeshmenon/npmlens-mcp/releases) | [Contributing](./CONTRIBUTING.md) | [Troubleshooting](./docs/advanced.md#troubleshooting) | [Tool reference](./docs/advanced.md#tool-schemas)

## Key features

- Structured npm search with optional ranking weights.
- Direct README fetch (optionally truncated).
- Enriched package info (downloads + GitHub details).
- Usage snippet extraction from README.
- Stdio MCP transport, ready for MCP‑compatible clients.

## Disclaimers

`npmlens-mcp` performs network requests to npm and GitHub when tools are used.
Avoid sharing secrets in prompts; set `GITHUB_TOKEN` only if you want higher GitHub rate limits.

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
> Using `npmlens-mcp@latest` ensures your MCP client always runs the latest published version.

### MCP Client configuration

<details>
  <summary>Amp</summary>
  Follow the Amp docs and use the config provided above. You can also install via CLI:

```bash
amp mcp add npmlens -- npx npmlens-mcp@latest
```

</details>

<details>
  <summary>Claude Code</summary>
  Use the Claude Code CLI to add the NPMLens MCP server (see the Claude Code MCP guide):

```bash
claude mcp add npmlens npx npmlens-mcp@latest
```

</details>

<details>
  <summary>Cline</summary>
  Follow https://docs.cline.bot/mcp/configuring-mcp-servers and use the config provided above.
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

Alternatively, follow the Gemini CLI MCP guide and use the standard config from above.

</details>

<details>
  <summary>Gemini Code Assist</summary>
  Follow the provider guide to configure MCP servers and use the standard config from above.
</details>

<details>
  <summary>JetBrains AI Assistant & Junie</summary>

Go to `Settings | Tools | AI Assistant | Model Context Protocol (MCP)` -> `Add`.
Use the config provided above. Same for Junie under `Settings | Tools | Junie | MCP Settings` -> `Add`.

</details>

<details>
  <summary>Warp</summary>

Go to `Settings | AI | Manage MCP Servers` -> `+ Add` and use the config provided above.

</details>

### Your first prompt

Enter the following prompt in your MCP client to check if everything works:

```
Find 5 React debounce hook libraries, include weekly downloads, and fetch the README for the top result.
```

---

## Advanced and Local Usage

Looking for JSON‑RPC examples, tool schemas, the local dev CLI, troubleshooting, or contributor setup?

- See `docs/advanced.md` for all technical details.
- See `CONTRIBUTING.md` for contributing guidelines.

## Tools

Below are the tools exposed by NPMLens MCP. For full JSON schemas, see the [Tool reference](./docs/advanced.md#tool-schemas).

- `search_npm`
  - Search the npm registry with optional ranking weights.
  - Args: `query` (string, required), `size` (1..250), `from` (offset), `weights` (object with `quality`, `popularity`, `maintenance`).
  - Returns: `{ total, results[] }` where each result includes `name`, `version`, `description`, `links`, `score`, etc.

- `get_readme`
  - Fetch README markdown for a package (optionally by version).
  - Args: `name` (string, required), `version` (string), `truncateAt` (number).
  - Returns: JSON metadata (`name`, `version`, `repository`, `homepage`) and the README as text content.

- `get_package_info`
  - Enriched package info combining registry metadata, npm downloads, and GitHub details.
  - Args: `name` (string, required), `version` (string), `includeReadme` (boolean).
  - Returns: `name`, `version`, `repository`, `homepage`, `github{ fullName, url, stars, forks, license }`, `downloadsLastWeek`, and optional `readme`.

- `get_downloads`
  - Fetch npm downloads for the last `day`/`week`/`month`.
  - Args: `name` (string, required), `period` (`day` | `week` | `month`, default `week`).
  - Returns: `{ downloads, start, end, package }`.

- `get_usage_snippet`
  - Extract a likely usage snippet from a package README.
  - Args: `name` (string, required), `version` (string).
  - Returns: `{ snippet: { language, code, heading } }`.

## Version pinning guidance

- Latest (moving): use `@latest`.
- Major pin: `npmlens-mcp@0` (newest 0.x).
- Minor pin: `npmlens-mcp@0.1` (newest 0.1.x).
- Exact: `npmlens-mcp@0.1.3`.
Tip: check the current version with `npm view npmlens-mcp version`.
