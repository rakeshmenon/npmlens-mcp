# Integration Test Scripts

This directory contains integration test scripts for NPMLens MCP.

## test-tools.ts

Comprehensive integration test that verifies all 9 MCP tools work correctly
with real npm registry queries.

### Usage

```bash
pnpm test:integration
```

### What it Tests

The script runs 17 different test scenarios covering:

1. **search_npm** (2 tests)
   - Basic search functionality
   - Custom ranking weights

2. **get_readme** (2 tests)
   - Fetch README for latest version
   - Fetch README for specific version

3. **get_package_info** (1 test)
   - Enriched data with downloads + GitHub stats

4. **get_downloads** (1 test)
   - Weekly download statistics

5. **get_usage_snippet** (1 test)
   - Extract code examples from README

6. **get_package_versions** (2 tests)
   - List all versions with tags
   - Filter by date (relative format like "6 months")

7. **get_package_dependencies** (2 tests)
   - Fetch dependency tree
   - Include devDependencies

8. **compare_packages** (1 test)
   - Compare 3 packages side-by-side

9. **search_by_keywords** (2 tests)
   - AND operator (all keywords required)
   - OR operator (any keyword matches)

10. **GitHub integration** (1 test)
    - Fetch repository info from GitHub

11. **Error handling** (1 test)
    - Nonexistent package handling

12. **Cache efficiency** (1 test)
    - Verify caching reduces response time

### Output

The script provides:

- ✅ Green checkmarks for passed tests
- ❌ Red X for failed tests
- ℹ️  Blue info messages with test details
- 🎉 Success summary if all tests pass
- ⚠️  Warning if any tests fail

### Exit Codes

- `0` - All tests passed
- `1` - One or more tests failed

### Requirements

- Active internet connection (makes real API calls)
- No environment variables required for basic testing
- Optional: `GITHUB_TOKEN` for higher GitHub API rate limits

### Notes

- Tests use real npm registry and GitHub APIs
- Some tests may be slow due to network latency
- Cache warming occurs during the first test run
- Subsequent runs benefit from caching
