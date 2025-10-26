import { describe, it, expect, vi, beforeEach } from "vitest";
import * as http from "../src/http.js";
import { parseGithubRepo, fetchGithubRepo } from "../src/github.js";

describe("github helpers", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("parses github repo urls", () => {
    expect(parseGithubRepo("git+https://github.com/user/repo.git")).toEqual({ owner: "user", repo: "repo" });
    expect(parseGithubRepo("https://github.com/user/repo")).toEqual({ owner: "user", repo: "repo" });
    expect(parseGithubRepo("git://github.com/user/repo.git")).toEqual({ owner: "user", repo: "repo" });
    expect(parseGithubRepo("https://example.com/notgithub")).toBeUndefined();
    expect(parseGithubRepo(undefined)).toBeUndefined();
  });

  it("fetches repo info and falls back when not ok; sets auth header with token; license key fallback", async () => {
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(new Response(null, { status: 404 }));
    const fb = await fetchGithubRepo("https://github.com/user/repo");
    expect(fb?.url).toContain("github.com/user/repo");

    const spy = vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          full_name: "user/repo",
          html_url: "https://github.com/user/repo",
          description: "desc",
          stargazers_count: 10,
          forks_count: 2,
          license: { spdx_id: "MIT" },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    process.env.GITHUB_TOKEN = "t";
    let info = await fetchGithubRepo("https://github.com/user/repo");
    expect(info?.stars).toBe(10);
    expect(info?.license).toBe("MIT");
    // Ensure auth header was passed
    const opts = spy.mock.calls[0]?.[1] as { headers?: Record<string, string> } | undefined;
    expect(opts?.headers?.authorization).toContain("Bearer ");
    delete process.env.GITHUB_TOKEN;
    // License key fallback
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ full_name: "user/repo", html_url: "https://github.com/user/repo", license: { key: "Apache-2.0" } }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    info = await fetchGithubRepo("https://github.com/user/repo");
    expect(info?.license).toBe("Apache-2.0");
  });

  it("returns undefined when input cannot be parsed; falls back fullName/url when fields missing; license undefined when absent", async () => {
    expect(await fetchGithubRepo(undefined)).toBeUndefined();
    vi.spyOn(http, "httpGet").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ description: "d", stargazers_count: 0, forks_count: 0, license: null }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    );
    const info = await fetchGithubRepo("https://github.com/u/r");
    expect(info?.fullName).toBe("u/r");
    expect(info?.url).toBe("https://github.com/u/r");
    expect(info?.license).toBeUndefined();
  });
});
