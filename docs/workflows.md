# GitHub Workflows - Execution Guide

This document explains the GitHub Actions workflows in this repository, categorized by purpose and execution order.

## Category 1: Continuous Integration (Quality Checks)

### CI

- **File**: `.github/workflows/ci.yml`
- **Triggers**:
  - Every pull request to any branch
  - Every push to `main`
- **Purpose**: Quality gates (lint, typecheck, build, test with 100% coverage)
- **Jobs**: Three parallel jobs
  1. `lint` - Typecheck + ESLint
  2. `build` - TypeScript compilation
  3. `test` - Vitest with 100% coverage enforcement
- **Execution**: Runs in parallel with other workflows

---

## Category 2: Release Preparation (Manual)

### Version Bump PR

- **File**: `.github/workflows/version-bump.yml`
- **Triggers**: Manual (workflow_dispatch)
- **Purpose**: Creates a pull request with version bump in package.json
- **How to Use**:
  1. Go to Actions → Version Bump PR → Run workflow
  2. Select semver level: `patch`, `minor`, or `major`
  3. Workflow creates a PR (e.g., `release/v0.1.6`)
- **Output**:
  - Updates `package.json` version
  - Creates PR with title `chore(release): v0.1.6`

---

## Category 3: Release Pipeline (Automated)

### Tag on Version Bump

- **File**: `.github/workflows/tag-on-bump.yml`
- **Triggers**:
  - Push to `main` branch where `package.json` changed
  - Manual trigger (workflow_dispatch)
- **Purpose**: Detects version changes and creates git tags
- **Logic**:
  1. Reads current version from `package.json`
  2. Reads previous version from `HEAD^:package.json`
  3. Compares versions
  4. If different, creates and pushes tag (e.g., `v0.1.6`)
- **Execution Order**: Step 2 in release pipeline

### Release

- **File**: `.github/workflows/release.yml`
- **Triggers**:
  - Push of version tags (`v*.*.*`)
  - Completion of "Tag on Version Bump" workflow
- **Purpose**: Build, publish to npm, and create GitHub release
- **Steps**:
  1. Checkout tag
  2. Install dependencies
  3. Build project (`pnpm build`)
  4. Verify tag matches package.json version
  5. Publish to npm (with provenance)
  6. Create GitHub Release with auto-generated notes
- **Requirements**: `NPM_TOKEN` secret must be set
- **Execution Order**: Step 3 in release pipeline (final step)

---

## Visual Flow Diagram

```text
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPMENT WORKFLOW                      │
└─────────────────────────────────────────────────────────────┘

Every PR/Push:
  ┌──────────┐
  │    CI    │ ← Runs on all PRs and pushes to main
  └──────────┘
      │
      ├─> Lint + Typecheck
      ├─> Build
      └─> Test (100% coverage)


┌─────────────────────────────────────────────────────────────┐
│                     RELEASE WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

Step 1 - Manual Trigger:
  ┌──────────────────┐
  │ Version Bump PR  │ ← You trigger manually (select patch/minor/major)
  └────────┬─────────┘
           │
           ▼
  Creates PR: release/v0.1.6
           │
           │
Step 2 - Merge the PR:
  ┌──────────────┐
  │  Merge PR    │
  │  to main     │
  └──────┬───────┘
         │
         ├────────────────────────┐
         │                        │
         ▼                        ▼
    ┌────────┐         ┌──────────────────────┐
    │   CI   │         │ Tag on Version Bump  │ ← Detects version change
    └────────┘         └──────────┬───────────┘    in package.json
                                  │
                                  ▼
                          Creates tag: v0.1.6
                                  │
                                  │
Step 3 - Automatic Publishing:
                                  │
                                  ▼
                         ┌────────────────┐
                         │    Release     │ ← Builds & publishes
                         └────────┬───────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
          Build project     Publish to npm    Create GitHub
                                                  Release
```

---

## Quick Reference Table

| Workflow | Category | Trigger | Execution Order | Purpose |
|----------|----------|---------|-----------------|---------|
| **CI** | Quality Check | Every PR + push to main | Parallel (always) | Lint, build, test |
| **Version Bump PR** | Manual | workflow_dispatch | 1️⃣ (you start) | Create version bump PR |
| **Tag on Version Bump** | Release Pipeline | Push to main (package.json) | 2️⃣ (after merge) | Create git tag |
| **Release** | Release Pipeline | Tag creation | 3️⃣ (after tag) | Publish to npm + GitHub |

---

## Complete Release Process (Step by Step)

### For Maintainers

1. **Trigger Version Bump**:

   ```text
   Actions → Version Bump PR → Run workflow → Select patch/minor/major
   ```

2. **Review the PR**:
   - Check that `package.json` version is correct
   - Verify CI passes (lint, build, test)

3. **Merge the PR**:
   - Use "Merge pull request" (not squash or rebase)
   - This triggers the automated pipeline

4. **Automatic Steps** (no action needed):
   - ✅ Tag on Version Bump creates git tag
   - ✅ Release workflow builds the project
   - ✅ Package published to npm
   - ✅ GitHub Release created

5. **Verify**:
   - Check npm: `npm view npmlens-mcp version`
   - Check GitHub Releases page

---

## Troubleshooting

### Tag on Version Bump didn't trigger

- **Check**: Did `package.json` change in the merged commit?
- **Check**: Was the commit message or PR created with `[skip ci]`?
- **Solution**: Manually trigger the workflow from Actions tab

### Release workflow failed

- **Check**: Is `NPM_TOKEN` secret set in repository settings?
- **Check**: Does the tag match the package.json version?
- **Check**: Is the npm package name available?

### CI failing

- Run locally:

  ```bash
  pnpm lint      # Typecheck + ESLint
  pnpm build     # TypeScript build
  pnpm coverage  # Tests with coverage
  ```

---

## Environment & Secrets

### Required Secrets

- `NPM_TOKEN`: Automation token from npmjs.com (for publishing)

### Permissions

- **CI**: Read-only
- **Version Bump PR**: Write (contents, pull-requests)
- **Tag on Version Bump**: Write (contents)
- **Release**: Write (contents, id-token for npm provenance)

---

## Workflow Dependencies

```text
Version Bump PR
       │
       ▼
   (manual merge)
       │
       ├─> CI (independent)
       │
       └─> Tag on Version Bump
               │
               └─> Release
```

The workflows are designed to be:

- **Atomic**: Each workflow has a single, clear purpose
- **Safe**: Multiple checks prevent accidental releases
- **Traceable**: Full audit trail from version bump to npm publish
