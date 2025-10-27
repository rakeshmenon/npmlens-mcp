import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

describe("index.ts", () => {
  it("exports and initializes properly", async () => {
    // Simply importing should work without errors
    await import("../src/index.js");
    expect(true).toBe(true);
  });

  it("reads correct version from package.json", () => {
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const packageJson = JSON.parse(readFileSync(join(__dirname, "../package.json"), "utf8")) as { version: string };
    expect(packageJson.version).toMatch(/^\d+\.\d+\.\d+/);
  });
});
