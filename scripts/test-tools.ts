#!/usr/bin/env tsx
/**
 * Integration test script for all MCP tools.
 * Tests each tool with realistic queries to verify they work correctly.
 *
 * Usage: pnpm tsx scripts/test-tools.ts
 */

import { searchNpm, getReadme, getPackageVersions, getPackageDependencies, comparePackages } from "../src/npm.js";
import { downloadsLast } from "../src/downloads.js";
import { fetchGithubRepo } from "../src/github.js";
import { extractUsageSnippet } from "../src/snippet.js";

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message: string, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

function header(title: string) {
  console.log("\n" + "=".repeat(60));
  log(title, colors.bright + colors.cyan);
  console.log("=".repeat(60));
}

function success(message: string) {
  log(`✅ ${message}`, colors.green);
}

function error(message: string) {
  log(`❌ ${message}`, colors.red);
}

function info(message: string) {
  log(`ℹ️  ${message}`, colors.blue);
}

async function runTest(testName: string, testFn: () => Promise<void>) {
  try {
    log(`\n🧪 Testing: ${testName}`, colors.yellow);
    await testFn();
    success(`${testName} passed`);
    return true;
  } catch (err) {
    error(`${testName} failed: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

async function main() {
  header("NPMLens MCP Tools Integration Test");

  let passedTests = 0;
  let totalTests = 0;

  // Test 1: search_npm
  totalTests++;
  if (await runTest("search_npm - Basic search", async () => {
    const result = await searchNpm("react hooks", 5);
    if (result.total === 0) throw new Error("No results found");
    if (result.results.length === 0) throw new Error("Results array is empty");
    info(`Found ${result.total} packages, showing ${result.results.length}`);
    info(`Top result: ${result.results[0].name} (score: ${result.results[0].score.toFixed(2)})`);
  })) passedTests++;

  // Test 2: search_npm with weights
  totalTests++;
  if (await runTest("search_npm - With ranking weights", async () => {
    const result = await searchNpm("typescript logger", 3, 0, { popularity: 0.8, quality: 0.1, maintenance: 0.1 });
    if (result.results.length === 0) throw new Error("No results found");
    info(`Found ${result.results.length} packages with custom weights`);
  })) passedTests++;

  // Test 3: get_readme
  totalTests++;
  if (await runTest("get_readme - Fetch README", async () => {
    const result = await getReadme("lodash");
    if (!result.readme) throw new Error("README not found");
    if (!result.name) throw new Error("Package name missing");
    info(`Package: ${result.name}@${result.version ?? "latest"}`);
    info(`README length: ${result.readme.length} characters`);
    if (result.repository) info(`Repository: ${result.repository}`);
  })) passedTests++;

  // Test 4: get_readme with version
  totalTests++;
  if (await runTest("get_readme - Specific version", async () => {
    const result = await getReadme("react", "18.0.0");
    if (result.version !== "18.0.0") throw new Error(`Expected version 18.0.0, got ${result.version}`);
    info(`Fetched README for react@${result.version}`);
  })) passedTests++;

  // Test 5: get_package_info
  totalTests++;
  if (await runTest("get_package_info - Enriched data", async () => {
    const pkgData = await getReadme("lodash");
    const downloads = await downloadsLast("week", "lodash");
    const github = await fetchGithubRepo(pkgData.repository);

    if (downloads.downloads === undefined) throw new Error("Downloads missing");
    info(`Package: ${pkgData.name}@${pkgData.version}`);
    info(`Weekly downloads: ${downloads.downloads.toLocaleString()}`);
    if (github) {
      info(`GitHub: ${github.fullName} (⭐ ${github.stars?.toLocaleString() ?? 'N/A'})`);
    }
  })) passedTests++;

  // Test 6: get_downloads
  totalTests++;
  if (await runTest("get_downloads - Weekly stats", async () => {
    const result = await downloadsLast("week", "express");
    if (result.downloads === undefined) throw new Error("Downloads missing");
    info(`express weekly downloads: ${result.downloads.toLocaleString()}`);
    info(`Period: ${result.start} to ${result.end}`);
  })) passedTests++;

  // Test 7: get_usage_snippet
  totalTests++;
  if (await runTest("get_usage_snippet - Extract code example", async () => {
    const data = await getReadme("chalk");
    const snippet = extractUsageSnippet(data.readme);
    if (!snippet) {
      // Some packages might not have clear code snippets, which is okay
      info("No snippet found (package may not have standard usage examples)");
    } else {
      info(`Found ${snippet.language ?? "unknown"} code snippet`);
      info(`Code length: ${snippet.code.length} characters`);
      if (snippet.heading) info(`Under heading: ${snippet.heading}`);
    }
  })) passedTests++;

  // Test 8: get_package_versions
  totalTests++;
  if (await runTest("get_package_versions - List versions", async () => {
    const result = await getPackageVersions("react", 10);
    if (result.versions.length === 0) throw new Error("No versions found");
    info(`Package: ${result.name}`);
    info(`Found ${result.versions.length} versions (limited to 10)`);
    const latest = result.versions[0];
    info(`Latest: ${latest.version} (${latest.date.split("T")[0]})`);
    if (latest.tags?.length) {
      info(`Tags: ${latest.tags.join(", ")}`);
    }
  })) passedTests++;

  // Test 9: get_package_versions with date filter
  totalTests++;
  if (await runTest("get_package_versions - Date filter (6 months)", async () => {
    const result = await getPackageVersions("typescript", 5, "6 months");
    info(`Found ${result.versions.length} versions from last 6 months`);
    if (result.versions.length > 0) {
      info(`Most recent: ${result.versions[0].version} (${result.versions[0].date.split("T")[0]})`);
    }
  })) passedTests++;

  // Test 10: get_package_dependencies
  totalTests++;
  if (await runTest("get_package_dependencies - Fetch dependencies", async () => {
    const result = await getPackageDependencies("express", undefined, 1, false);
    info(`Package: ${result.name}@${result.version}`);
    info(`Dependencies: ${result.dependencies.length}`);
    if (result.dependencies.length > 0) {
      info(`First 3 deps: ${result.dependencies.slice(0, 3).map(d => d.name).join(", ")}`);
    }
  })) passedTests++;

  // Test 11: get_package_dependencies with devDeps
  totalTests++;
  if (await runTest("get_package_dependencies - Include devDependencies", async () => {
    const result = await getPackageDependencies("vitest", undefined, 1, true);
    info(`Package: ${result.name}`);
    info(`Dependencies: ${result.dependencies.length}`);
    if (result.devDependencies) {
      info(`Dev dependencies: ${result.devDependencies.length}`);
    }
  })) passedTests++;

  // Test 12: compare_packages
  totalTests++;
  if (await runTest("compare_packages - Compare 3 packages", async () => {
    const result = await comparePackages(["react", "vue", "svelte"]);
    if (result.length !== 3) throw new Error(`Expected 3 results, got ${result.length}`);

    info("\nComparison Results:");
    for (const pkg of result) {
      if (pkg.error) {
        info(`  ${pkg.name}: ERROR - ${pkg.error}`);
      } else {
        const stars = pkg.stars ? `⭐ ${pkg.stars.toLocaleString()}` : "⭐ N/A";
        const downloads = pkg.downloads ? `📦 ${(pkg.downloads / 1000).toFixed(0)}k/week` : "📦 N/A";
        info(`  ${pkg.name}@${pkg.version ?? "?"}: ${stars}, ${downloads}, License: ${pkg.license ?? "N/A"}`);
      }
    }
  })) passedTests++;

  // Test 13: search_by_keywords (simulated - just uses searchNpm)
  totalTests++;
  if (await runTest("search_by_keywords - AND operator", async () => {
    const keywords = ["react", "hooks", "typescript"];
    const query = keywords.join(" "); // AND operator
    const result = await searchNpm(query, 5);
    if (result.results.length === 0) throw new Error("No results found");
    info(`Found ${result.total} packages matching: ${keywords.join(" AND ")}`);
    info(`Top result: ${result.results[0].name}`);
  })) passedTests++;

  // Test 14: search_by_keywords with OR
  totalTests++;
  if (await runTest("search_by_keywords - OR operator", async () => {
    const keywords = ["webpack", "vite", "rollup"];
    const query = keywords.join(" OR "); // OR operator
    const result = await searchNpm(query, 5);
    if (result.results.length === 0) throw new Error("No results found");
    info(`Found ${result.total} packages matching: ${keywords.join(" OR ")}`);
  })) passedTests++;

  // Test 15: GitHub integration
  totalTests++;
  if (await runTest("GitHub integration - Fetch repo info", async () => {
    const github = await fetchGithubRepo("https://github.com/facebook/react");
    if (!github) throw new Error("GitHub info not found");
    info(`Repository: ${github.fullName}`);
    info(`Stars: ${github.stars?.toLocaleString() ?? "N/A"}`);
    info(`Forks: ${github.forks?.toLocaleString() ?? "N/A"}`);
    info(`License: ${github.license ?? "N/A"}`);
  })) passedTests++;

  // Test 16: Error handling
  totalTests++;
  if (await runTest("Error handling - Nonexistent package", async () => {
    try {
      await getReadme("this-package-definitely-does-not-exist-12345");
      throw new Error("Should have thrown an error");
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        info("Correctly handled 404 error");
      } else {
        throw err;
      }
    }
  })) passedTests++;

  // Test 17: Cache efficiency test
  totalTests++;
  if (await runTest("Cache efficiency - Same query twice", async () => {
    const start1 = Date.now();
    const result1 = await searchNpm("test package", 5);
    const time1 = Date.now() - start1;

    const start2 = Date.now();
    const result2 = await searchNpm("test package", 5);
    const time2 = Date.now() - start2;

    info(`First query: ${time1}ms`);
    info(`Cached query: ${time2}ms`);
    if (time2 < time1 / 2) {
      info("✨ Cache is working efficiently!");
    }
    if (result1.total !== result2.total) {
      throw new Error("Cache returned different results");
    }
  })) passedTests++;

  // Summary
  header("Test Summary");
  log(`\nTotal Tests: ${totalTests}`, colors.bright);
  log(`Passed: ${passedTests}`, colors.green);
  log(`Failed: ${totalTests - passedTests}`, totalTests === passedTests ? colors.green : colors.red);
  log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`, colors.cyan);

  if (passedTests === totalTests) {
    log("\n🎉 All tests passed! NPMLens MCP is working correctly.", colors.bright + colors.green);
  } else {
    log("\n⚠️  Some tests failed. Please review the errors above.", colors.bright + colors.yellow);
    process.exit(1);
  }
}

// Run the tests
main().catch((err) => {
  error(`Fatal error: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
