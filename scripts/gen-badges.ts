#!/usr/bin/env -S node --enable-source-maps
/*
 Generate dynamic badges for tests and coverage using Vitest output.
 - Runs Vitest with coverage and JSON reporter
 - Reads .tmp/vitest.json for test counts
 - Reads coverage/coverage-summary.json for coverage percent
 - Emits SVGs at badges/tests.svg and badges/coverage.svg
*/
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

// Lazy import to avoid ESM issues if not installed
async function makeBadgeSvg(label: string, message: string, color: string): Promise<string> {
  const { makeBadge } = await import("badge-maker");
  return makeBadge({ label, message, color, labelColor: "#555", style: "flat" });
}

function colorForPct(pct: number): string {
  if (pct >= 95) return "brightgreen";
  if (pct >= 90) return "green";
  if (pct >= 80) return "yellowgreen";
  if (pct >= 70) return "yellow";
  if (pct >= 60) return "orange";
  return "red";
}

function pct(n: number): number {
  return Math.round(n);
}

function runVitestJson(): void {
  // Ensure temp dir exists
  mkdirSync(resolve(".tmp"), { recursive: true });
  const outFile = resolve(".tmp/vitest.json");
  const args = [
    "run",
    "--coverage",
    "--reporter=json",
    "--outputFile",
    outFile,
  ];
  const res = spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["vitest", ...args], {
    stdio: "inherit",
    env: process.env,
  });
  if (res.status !== 0) {
    throw new Error(`Vitest run failed with status ${res.status}`);
  }
}

function readJson<T>(path: string): T {
  const raw = readFileSync(path, "utf8");
  return JSON.parse(raw) as unknown as T;
}

type VitestJsonSummary = {
  numTotalTests: number;
  numPassedTests: number;
};

type CoverageSummary = {
  total: {
    lines: { pct: number };
  };
};

async function main() {
  // 1) Run vitest to produce JSON + coverage summary
  runVitestJson();

  // 2) Read test results
  const vitest = readJson<VitestJsonSummary>(".tmp/vitest.json");
  const total = Number(vitest?.numTotalTests ?? 0);
  const passed = Number(vitest?.numPassedTests ?? 0);
  const passPct = total > 0 ? (passed / total) * 100 : 0;

  // 3) Read coverage summary (from vitest config reporter json-summary)
  const covPath = "coverage/coverage-summary.json";
  const cov = readJson<CoverageSummary>(covPath);
  const linesPct = Number(cov?.total?.lines.pct ?? 0);

  // 4) Build badges
  mkdirSync("badges", { recursive: true });

  const testsMsg = `${pct(passPct)}%`; // keep concise for badge
  const testsColor = colorForPct(passPct);
  const testsSvg = await makeBadgeSvg("tests", testsMsg, testsColor);
  writeFileSync("badges/tests.svg", testsSvg, "utf8");

  const covMsg = `${pct(linesPct)}%`;
  const covColor = colorForPct(linesPct);
  const covSvg = await makeBadgeSvg("coverage", covMsg, covColor);
  writeFileSync("badges/coverage.svg", covSvg, "utf8");

  // 5) Log a short summary
  console.log(`Generated badges: tests ${testsMsg} (${passed}/${total}), coverage ${covMsg}`);
}

main().catch((err: unknown) => {
  console.error("gen-badges failed:", err);
  process.exit(1);
});
