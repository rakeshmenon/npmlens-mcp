import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We'll mock dependencies used by the CLI per test case before importing the module

const importRun = async () => (await import("../src/cli.js")).run;

let origArgv: string[];
let exitSpy: unknown;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  origArgv = process.argv.slice();
  // Spy on process.exit; avoid strict typing of args/return (never) by using a SpyInstance
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((() => {
    // swallow exits in tests without throwing
    return undefined as never;
  }) as unknown) as typeof process.exit);
  logSpy = vi.spyOn(console, "log").mockImplementation(() => { /* noop */ });
  errSpy = vi.spyOn(console, "error").mockImplementation(() => { /* noop */ });
});

afterEach(() => {
  process.argv = origArgv;
  vi.restoreAllMocks();
});

describe("cli", () => {
  it("search prints results JSON", async () => {
    const run = await importRun();
    await run(["node", "cli", "search", "react", "debounce", "hook"], {
      searchNpm: vi.fn().mockResolvedValue({ total: 1, results: [{ name: "a", version: "1.0.0", links: {}, score: 1 }] }),
    });
    expect(logSpy).toHaveBeenCalled();
    const out = (logSpy.mock.calls[0]?.[0] as string) || "";
    expect(out).toContain("\"total\": 1");
  });

  it("readme prints header and repo/homepage", async () => {
    const run = await importRun();
    await run(["node", "cli", "readme", "react"], {
      getReadme: vi.fn().mockResolvedValue({ name: "react", version: "18.0.0", readme: "# React", repository: "https://github.com/fb/react", homepage: "https://react.dev" }),
    });
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    expect(lines.join("\n")).toContain("# react@18.0.0");
    expect(lines.join("\n")).toContain("Repository:");
    expect(lines.join("\n")).toContain("Homepage:");
  });

  it("readme prints placeholder when no readme and no links", async () => {
    const run = await importRun();
    await run(["node", "cli", "readme", "react"], {
      getReadme: vi.fn().mockResolvedValue({ name: "react" }),
    });
    const lines = logSpy.mock.calls.map((c) => String(c[0]));
    const text = lines.join("\n");
    expect(text).toContain("# react\n"); // covers header without @version branch
    expect(text).toContain("README not available");
  });

  it("info prints enriched JSON", async () => {
    const run = await importRun();
    await run(["node", "cli", "info", "pkg"], {
      getReadme: vi.fn().mockResolvedValue({ name: "pkg", version: "1.0.0", repository: "https://github.com/u/r", homepage: undefined, readme: "" }),
      downloadsLast: vi.fn().mockResolvedValue({ downloads: 123, start: "", end: "", package: "pkg" }),
      fetchGithubRepo: vi.fn().mockResolvedValue({ url: "https://github.com/u/r", fullName: "u/r" }),
    });
    const out = (logSpy.mock.calls[0]?.[0] as string) || "";
    expect(out).toContain("downloadsLastWeek");
  });

  it("downloads prints object JSON", async () => {
    const run = await importRun();
    await run(["node", "cli", "downloads", "pkg", "day"], {
      downloadsLast: vi.fn().mockResolvedValue({ downloads: 5, start: "", end: "", package: "pkg" }),
    });
    const out = (logSpy.mock.calls[0]?.[0] as string) || "";
    expect(out).toContain("\"downloads\": 5");
  });

  it("snippet prints snippet JSON", async () => {
    const run = await importRun();
    await run(["node", "cli", "snippet", "p"], {
      getReadme: vi.fn().mockResolvedValue({ name: "p", version: "1.0.0", readme: "## Usage\n```js\nconsole.log('x')\n```" }),
    });
    const out = (logSpy.mock.calls[0]?.[0] as string) || "";
    expect(out).toContain("snippet");
  });

  it("unknown command reports error and exits 1", async () => {
    const run = await importRun();
    await run(["node", "cli", "nope"]);
    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("prints help when no command provided", async () => {
    const run = await importRun();
    await run(["node", "cli"], {});
    expect(logSpy).toHaveBeenCalled();
  });

  it("search uses default query and env QUERY", async () => {
    const run = await importRun();
    await run(["node", "cli", "search"], {
      searchNpm: vi.fn().mockResolvedValue({ total: 0, results: [] }),
    });
    expect(logSpy).toHaveBeenCalled();
    logSpy.mockClear();
    process.env.QUERY = "foo bar";
    await run(["node", "cli", "search"], {
      searchNpm: vi.fn().mockResolvedValue({ total: 0, results: [] }),
    });
    expect(logSpy).toHaveBeenCalled();
    delete process.env.QUERY;
  });

  it("downloads falls back period when invalid", async () => {
    const run = await importRun();
    await run(["node", "cli", "downloads", "p", "invalid"], {
      downloadsLast: vi.fn().mockResolvedValue({ downloads: 0, start: "", end: "", package: "p" }),
    });
    expect(logSpy).toHaveBeenCalled();
  });

  it("readme missing name triggers error and exit", async () => {
    const run = await importRun();
    await run(["node", "cli", "readme"], {
      getReadme: vi.fn(),
    });
    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("info falls back to meta.repository when github not found", async () => {
    const run = await importRun();
    await run(["node", "cli", "info", "pkg"], {
      getReadme: vi.fn().mockResolvedValue({ name: "pkg", version: "1.0.0", repository: "https://github.com/u/r", homepage: undefined, readme: "" }),
      downloadsLast: vi.fn().mockResolvedValue({ downloads: 5, start: "", end: "", package: "pkg" }),
      fetchGithubRepo: vi.fn().mockResolvedValue(undefined),
    });
    const out = (logSpy.mock.calls[0]?.[0] as string) || "";
    expect(out).toContain("\"repository\": \"https://github.com/u/r\"");
  });

  it("downloads missing name triggers error and exit", async () => {
    const run = await importRun();
    await run(["node", "cli", "downloads"], {
      downloadsLast: vi.fn(),
    });
    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("snippet missing name triggers error and exit", async () => {
    const run = await importRun();
    await run(["node", "cli", "snippet"], {
      getReadme: vi.fn(),
    });
    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("info missing name triggers error and exit", async () => {
    const run = await importRun();
    await run(["node", "cli", "info"], {
      getReadme: vi.fn(),
      downloadsLast: vi.fn(),
      fetchGithubRepo: vi.fn(),
    });
    expect(errSpy).toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it("catch path handles non-Error thrown values", async () => {
    const run = await importRun();
    await run(["node", "cli", "search", "x"], {
      searchNpm: vi.fn().mockRejectedValue("boom"),
    });
    expect(errSpy).toHaveBeenCalledWith("boom");
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
