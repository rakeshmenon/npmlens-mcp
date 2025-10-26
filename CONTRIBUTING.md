# Contributing

Thanks for your interest in contributing! This project aims to keep the
user experience simple (zero‑install usage for MCP clients) while
enforcing a high bar for code quality and safety.

## Setup

- Node 18.17+
- Install deps: `pnpm i`
- Typecheck: `pnpm typecheck` (tsconfig.eslint.json; includes tests)
- Lint: `pnpm lint` (runs typecheck + ESLint + markdownlint)
- Lint markdown only: `pnpm lint:md` (checks all .md files)
- Tests: `pnpm test`
- Coverage (100% enforced): `pnpm coverage` (HTML report in `coverage/`)
- Integration tests: `pnpm test:integration` (tests all 9 tools with real
  API calls)
- Build: `pnpm build` (emits ESM + `.d.ts` to `dist/`)
- Dev (watch): `pnpm dev` (runs the stdio MCP server)

## Git hooks (Husky + lint‑staged)

- Pre‑commit runs typecheck + ESLint on staged files and related tests.
- Hooks are installed via `prepare` automatically after `pnpm i`.
- If hooks don’t fire, ensure:
  - `git config core.hooksPath .husky`
  - `chmod +x .husky/*`

## Project structure

- `src/index.ts` — MCP server (stdio), tool registrations
- `src/npm.ts` — npm registry helpers (search, versions, dependencies,
  comparison)
- `src/downloads.ts` — npm downloads API
- `src/github.ts` — GitHub enrichment helpers
- `src/snippet.ts` — README usage snippet extractor
- `src/cache.ts` — LRU cache layer for network responses
- `src/http.ts` — Centralized HTTP client with error handling
- `src/cli.ts` — small demo CLI (dev only)
- `tests/` — Vitest unit tests (100% coverage required)
- `scripts/` — Integration test scripts and utilities
- `docs/advanced.md` — JSON‑RPC examples, schemas, local dev docs
- `docs/workflows.md` — GitHub Actions workflow documentation
- `.github/workflows/` — CI/CD automation (ci, release, version-bump,
  tag-on-bump)

## Code style and safety

### TypeScript

- TypeScript strict; avoid `any`. Prefer `unknown` and narrow.
- Don't throw raw values; always throw `Error`.
- Prefer `??` over `||` for fallbacks.
- Keep tool input schemas precise (JSON Schema) and validate at the
  boundary.
- Network access is limited to npm and GitHub; do not add arbitrary URL
  fetches.
- Cache sensitive results with TTL (see `src/cache.ts`); expose TTL via
  env only if needed.

### Markdown

- All markdown files must pass markdownlint validation
- Configuration in `.markdownlint.json` (minimal exceptions for HTML
  elements and tables)
- Line length limit: 80 characters (except in tables)
- Allowed HTML elements: `<details>` and `<summary>` (for collapsible
  sections)
- Run `pnpm lint:md` to check markdown files
- Blank lines required around headings and lists

## Adding or changing tools

- Use snake_case for new tool names; keep camelCase alias only if
  necessary for BC.
- Define an `inputSchema` with `required` and
  `additionalProperties: false`.
- Return structured JSON and/or text content; avoid giant blobs when
  possible.
- Add unit tests covering success and error paths.
- Ensure 100% code coverage is maintained (`pnpm coverage`).
- Add integration test scenarios in `scripts/test-tools.ts` for
  end-to-end validation.
- Update `docs/advanced.md` (schemas/examples) and a short note in
  README if UX changes.
- Update `CLAUDE.md` with tool details and implementation notes.

## Testing strategy

### Unit tests (`pnpm test`)

- Located in `tests/` directory, mirror source structure
- Mock all HTTP calls to avoid network dependency
- Cover success paths, error paths, and edge cases
- 100% coverage enforced (lines, branches, functions, statements)
- Run automatically in pre-commit hooks via lint-staged

### Integration tests (`pnpm test:integration`)

- Located in `scripts/test-tools.ts`
- Tests all 9 MCP tools with real npm/GitHub API calls
- 17 test scenarios covering different use cases
- Validates cache efficiency and error handling
- Requires active internet connection
- Optional: Set `GITHUB_TOKEN` for higher rate limits
- Run manually before releases or after adding new tools

### Demo CLI (`pnpm demo:*`)

- Standalone commands for manual testing without MCP transport
- Useful for quick validation during development
- Available commands: search, readme, info, downloads, snippet

## CI

- GitHub Actions runs three parallel jobs on PRs: lint, build, test
  (coverage 100%).
- Pushes run only on `main`.
- Keep PRs green; add tests for new code.
- See `docs/workflows.md` for detailed workflow documentation.

## Release process

- We use a PR‑based release workflow:
  1. Trigger "Version Bump PR" workflow
     (`.github/workflows/version-bump.yml`) manually and choose
     patch/minor/major.
  2. Review and merge the PR (branch protection applies).
  3. After merge to `main`, "Tag on Version Bump" workflow
     (`.github/workflows/tag-on-bump.yml`) detects the version change
     and creates a git tag.
  4. Tag creation triggers "Release" workflow
     (`.github/workflows/release.yml`) which builds and publishes to npm.
- **Important**: Release workflow triggers ONLY on tag push, never on
  regular PR merges to main.
- Publishing requires `NPM_TOKEN` (automation token) and Actions with
  write permission.
- See `docs/workflows.md` for detailed workflow documentation.

## MVP user experience

- Users should prefer zero‑install launchers in MCP clients:
  - `npx -y npmlens-mcp@latest` (or `pnpm dlx npmlens-mcp@latest`).
- README should prioritize user setup; local instructions live in
  `docs/advanced.md`.

## Environment variables

- `GITHUB_TOKEN` — Optional personal access token for higher GitHub API
  rate limits
- `CACHE_TTL_MS` — Cache TTL in milliseconds (default: 60000)
- `CACHE_MAX` — Maximum cache entries (default: 500)

Set these in your shell or MCP client config's `env` object.

## Available MCP tools

The server currently exposes 9 tools (all registered with snake_case names):

### Core Search & Information (5 tools)

1. `search_npm` — Search npm registry with ranking weights
2. `get_readme` — Fetch package README with metadata
3. `get_package_info` — Enriched data (registry + downloads + GitHub)
4. `get_downloads` — Download statistics (day/week/month)
5. `get_usage_snippet` — Extract usage examples from README

### Version & Dependency Analysis (2 tools)

1. `get_package_versions` — List versions with dates and dist tags
2. `get_package_dependencies` — Fetch dependency tree (configurable depth)

### Metrics & Comparison (2 tools)

1. `compare_packages` — Side-by-side package comparison (parallel fetching)
2. `search_by_keywords` — Targeted search with AND/OR operators

See `docs/advanced.md` for detailed schemas and JSON-RPC examples.

## Good first issues

- Improve result ranking heuristics and weights.
- Add a downloads/star‑based sort to search results (client‑side).
- Add resource templates (e.g., `npm:readme/<name>[@version]`).
- Expand tests for snippet extraction and edge cases.
- Add more keyword search operators (NOT, exact phrase matching).
- Implement package health score based on maintenance metrics.

## Version pinning guidance

- Latest (moving): use `@latest`.
- Major pin: `npmlens-mcp@0` (newest 0.x).
- Minor pin: `npmlens-mcp@0.1` (newest 0.1.x).
- Exact: `npmlens-mcp@0.1.3`.

Tip: check the current version with `npm view npmlens-mcp version`.
