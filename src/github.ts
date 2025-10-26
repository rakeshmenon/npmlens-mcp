import { httpGet } from "./http.js";

export type RepoInfo = {
  fullName: string; // owner/repo
  url: string;
  description?: string;
  stars?: number;
  forks?: number;
  license?: string;
};

export function parseGithubRepo(raw?: string): { owner: string; repo: string } | undefined {
  if (!raw) return undefined;
  // Examples: git+https://github.com/user/repo.git, https://github.com/user/repo, git://github.com/user/repo.git
  const cleaned = raw.replace(/^git\+/, "").replace(/\.git$/, "");
  const m = /github\.com\/(.+?)\/(.+?)(?:$|\?|#|\/)$/i.exec(cleaned);
  if (!m) return undefined;
  return { owner: m[1], repo: m[2] };
}

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
