/** GitHub repository enrichment helpers. */
import { httpGet } from "./http.js";

/** Minimal repository info returned by {@link fetchGithubRepo}. */
export type RepoInfo = {
  /** owner/repo string */
  fullName: string;
  /** HTTPS URL to the repository */
  url: string;
  /** Repo description (if available) */
  description?: string;
  /** Star count */
  stars?: number;
  /** Fork count */
  forks?: number;
  /** SPDX license identifier (if present) */
  license?: string;
};

/**
 * Parse a GitHub repository reference from common npm metadata formats.
 * Accepts git+https, https, or git:// URLs and strips .git.
 *
 * @param raw - Raw repository string from npm metadata.
 * @returns owner/repo pair if detected.
 */
export function parseGithubRepo(raw?: string): { owner: string; repo: string } | undefined {
  if (!raw) return undefined;
  // Examples: git+https://github.com/user/repo.git, https://github.com/user/repo, git://github.com/user/repo.git
  const cleaned = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  const m = /github\.com\/(.+?)\/(.+?)(?:$|\?|#|\/)$/i.exec(cleaned);
  if (!m) return undefined;
  return { owner: m[1], repo: m[2] };
}

/**
 * Fetch GitHub repository info via the public API. If the request fails
 * or rate limits apply, a minimal object with URL and fullName is returned.
 *
 * @param raw - Raw repository field from npm metadata.
 * @returns Minimal {@link RepoInfo} or undefined if not a GitHub repo.
 */
export async function fetchGithubRepo(raw?: string): Promise<RepoInfo | undefined> {
  const parsed = parseGithubRepo(raw);
  if (!parsed) return undefined;
  const { owner, repo } = parsed;
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const headers: Record<string, string> = {};
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await httpGet(url, { headers, retries: 1 });
  if (!res.ok) return { fullName: `${owner}/${repo}`, url: `https://github.com/${owner}/${repo}` };
  type GitHubRepo = {
    full_name?: string;
    html_url?: string;
    description?: string | null;
    stargazers_count?: number;
    forks_count?: number;
    license?: { spdx_id?: string | null; key?: string | null } | null;
  };
  const data = (await res.json()) as GitHubRepo;
  return {
    fullName: data.full_name ?? `${owner}/${repo}`,
    url: data.html_url ?? `https://github.com/${owner}/${repo}`,
    description: data.description ?? undefined,
    stars: data.stargazers_count ?? undefined,
    forks: data.forks_count ?? undefined,
    license: data.license?.spdx_id ?? data.license?.key ?? undefined,
  };
}
