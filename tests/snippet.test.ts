import { describe, it, expect } from "vitest";
import { extractUsageSnippet } from "../src/snippet.js";

const fence = "```";
const README = `
# Package

Some intro

## Usage

${fence}ts
import { x } from 'p';
x();
${fence}

More text

## API

${fence}bash
npm i p
${fence}
`;

describe("extractUsageSnippet", () => {
  it("picks the first code block after Usage heading", () => {
    const s = extractUsageSnippet(README);
    expect(s?.language).toBe("ts");
    expect(s?.code).toContain("import { x }");
    expect(s?.heading).toContain("usage");
  });

  it("falls back to language preference when no heading match", () => {
    const s = extractUsageSnippet(`${fence}js\nconsole.log('hi')\n${fence}\n`);
    expect(s?.language).toBe("js");
  });

  it("returns undefined for empty or no code", () => {
    expect(extractUsageSnippet(undefined)).toBeUndefined();
    expect(extractUsageSnippet("no code here")).toBeUndefined();
  });

  it("falls back to first non-empty when language not preferred", () => {
    const s = extractUsageSnippet(`${fence}python\nprint('x')\n${fence}\n`);
    expect(s?.code).toContain("print('x')");
  });

  it("pref language present but empty code falls through to next non-empty block", () => {
    const md = `${fence}js\n${fence}\n${fence}ts\nconsole.log('x')\n${fence}`;
    const s = extractUsageSnippet(md);
    expect(s?.code).toContain("console.log('x')");
  });

  it("no preferred language and all blocks empty returns undefined", () => {
    const md = `${fence}python\n${fence}`;
    const s = extractUsageSnippet(md);
    expect(s).toBeUndefined();
  });

  it("handles code block with no language fence (undefined lang)", () => {
    const md = `${fence}\nconst a = 1\n${fence}`;
    const s = extractUsageSnippet(md);
    expect(s?.code).toContain("const a = 1");
  });
});
