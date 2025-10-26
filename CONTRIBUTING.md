# Contributing

Thanks for your interest in contributing! For small fixes, feel free to open a PR.

Setup

- Node 18.17+
- Install deps: `pnpm i` (or npm/yarn)
- Build: `pnpm build`
- Dev (watch): `pnpm dev`
- Tests: `pnpm test` (coverage enforced to 100%)
- Coverage report: `pnpm coverage` -> `coverage/index.html`

Git hooks (Husky + lint-staged)

- We use Husky (latest) to run ESLint and related tests on staged files at commit time.
- After installing deps, Husky should be enabled via the `prepare` script.
- If hooks don’t fire, ensure the hooks path and executable bit:
  - `git config core.hooksPath .husky`
  - `chmod +x .husky/*`
  - Commit again.

Project structure

- `src/index.ts` — MCP server (stdio)
- `src/npm.ts` — npm registry helpers
- `src/cli.ts` — small CLI demo (no MCP)
- `tests/` — unit tests (Vitest)

Conventions

- Keep changes focused and minimal.
- Add helpful errors and input validation for tool handlers.
- Avoid adding new external endpoints without discussion.

Good first issues

- Add downloads metrics to search results.
- Add resource templates (e.g., `npm:readme/<name>[@version]`).
- Add tests for result mapping.
