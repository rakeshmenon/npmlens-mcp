# Contributing

Thanks for your interest in contributing! This project aims to keep the user experience simple (zero‑install usage for MCP clients) while enforcing a high bar for code quality and safety.

## Setup

- Node 18.17+
- Install deps: `pnpm i`
- Typecheck: `pnpm typecheck` (tsconfig.eslint.json; includes tests)
- Lint: `pnpm lint` (runs typecheck + ESLint)
- Tests: `pnpm test`
- Coverage (100% enforced): `pnpm coverage` (HTML report in `coverage/`)
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
- `src/npm.ts` — npm registry helpers (search, package readme)
- `src/downloads.ts` — npm downloads API
- `src/github.ts` — GitHub enrichment helpers
- `src/snippet.ts` — README usage snippet extractor
- `src/cli.ts` — small demo CLI (dev only)
- `tests/` — Vitest unit tests
- `docs/advanced.md` — JSON‑RPC examples, schemas, local dev docs

## Code style and safety

- TypeScript strict; avoid `any`. Prefer `unknown` and narrow.
- Don’t throw raw values; always throw `Error`.
- Prefer `??` over `||` for fallbacks.
- Keep tool input schemas precise (JSON Schema) and validate at the boundary.
- Network access is limited to npm and GitHub; do not add arbitrary URL fetches.
- Cache sensitive results with TTL (see `src/cache.ts`); expose TTL via env only if needed.

## Adding or changing tools

- Use snake_case for new tool names; keep camelCase alias only if necessary for BC.
- Define an `inputSchema` with `required` and `additionalProperties: false`.
- Return structured JSON and/or text content; avoid giant blobs when possible.
- Add unit tests covering success and error paths.
- Update `docs/advanced.md` (schemas/examples) and a short note in README if UX changes.

## CI

- GitHub Actions runs three parallel jobs on PRs: lint, build, test (coverage 100%).
- Pushes run only on `main`.
- Keep PRs green; add tests for new code.

## Release process

- We use a PR‑based release:
  - Trigger the "Version Bump PR" workflow (`.github/workflows/version-bump.yml`) and choose patch/minor/major.
  - Merge the PR (branch protection applies).
  - A push to `main` tags and publishes to npm (`.github/workflows/release.yml`).
- Publishing requires `NPM_TOKEN` (automation token) and Actions with write permission.

## MVP user experience

- Users should prefer zero‑install launchers in MCP clients:
  - `npx -y npmlens-mcp@latest` (or `pnpm dlx npmlens-mcp@latest`).
- README should prioritize user setup; local instructions live in `docs/advanced.md`.

## Good first issues

- Improve result ranking heuristics and weights.
- Add a downloads/star‑based sort to search results (client‑side).
- Add resource templates (e.g., `npm:readme/<name>[@version]`).
- Expand tests for snippet extraction and edge cases.
