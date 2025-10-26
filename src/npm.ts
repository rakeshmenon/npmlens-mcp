/** Common links for a package result. */
export type PackageLinks = {
  /** Link to the package on npmjs.com */
  npm?: string;
  /** Project homepage */
  homepage?: string;
  /** Repository URL */
  repository?: string;
};

/** A single npm search result mapped into a stable shape. */
export type PackageResult = {
  /** Package name */
  name: string;
  /** Latest version in the search object */
  version: string;
  /** Optional description */
  description?: string;
  /** Publish date of the version */
  date?: string;
  /** Useful links */
  links: PackageLinks;
  /** Maintainer usernames */
  maintainers?: string[];
  /** Publisher username */
  publisher?: string;
  /** Package keywords */
  keywords?: string[];
  /** npm scoring metric */
  score: number;
};

type NpmSearchObject = {
  package: {
    name: string;
    version: string;
    description?: string;
    date?: string;
    links?: PackageLinks;
    maintainers?: { username: string; email?: string }[];
    publisher?: { username: string; email?: string };
    keywords?: string[];
  };
  score: { final: number };
  searchScore?: number;
};

type NpmSearchResponse = {
  total: number;
  objects: NpmSearchObject[];
};

import { httpGet } from "./http.js";

const SEARCH_ENDPOINT = "https://registry.npmjs.org/-/v1/search";
const PACKAGE_ENDPOINT = "https://registry.npmjs.org";

/**
 * Search the npm registry using the official search API and map
 * results to {@link PackageResult} items.
 *
 * @param query - Search text, e.g. "react debounce hook".
 * @param size - Page size (1..250, default 10).
 * @param from - Offset for pagination.
 * @param weights - Optional ranking weights.
 * @returns Total hits and mapped results.
 */
export async function searchNpm(
  query: string,
  size = 10,
  from = 0,
  weights?: { quality?: number; popularity?: number; maintenance?: number }
): Promise<{ total: number; results: PackageResult[] }> {
  const q = query.trim();
  if (!q) throw new Error("Query must be a non-empty string");
  if (size < 1 || size > 250) throw new Error("size must be between 1 and 250");
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("text", q);
  url.searchParams.set("size", String(size));
  if (from > 0) url.searchParams.set("from", String(from));
  if (weights) {
    if (weights.quality != null) url.searchParams.set("quality", String(weights.quality));
    if (weights.popularity != null) url.searchParams.set("popularity", String(weights.popularity));
    if (weights.maintenance != null) url.searchParams.set("maintenance", String(weights.maintenance));
  }

  const res = await httpGet(url.toString(), { retries: 1 });
  if (!res.ok) throw new Error(`npm search failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as NpmSearchResponse;

  const results: PackageResult[] = (data.objects ?? []).map((o) => {
    const p = o.package;
    return {
      name: p.name,
      version: p.version,
      description: p.description,
      date: p.date,
      links: p.links ?? {},
      maintainers: (p.maintainers ?? []).map((m) => m.username),
      publisher: p.publisher?.username,
      keywords: p.keywords ?? [],
      score: o.score?.final ?? 0,
    } satisfies PackageResult;
  });

  return { total: data.total, results };
}

type NpmRepository = string | { url?: string } | undefined;
type NpmPackageMeta = {
  name?: string;
  version?: string;
  readme?: string;
  readmeFilename?: string;
  repository?: NpmRepository;
  homepage?: string;
};

/**
 * Read package metadata from the registry and return core details
 * along with README when available.
 *
 * @param pkg - Package name.
 * @param version - Optional version.
 * @returns Minimal metadata including README, repository, and homepage.
 */
export async function getReadme(
  pkg: string,
  version?: string
): Promise<{ name: string; version?: string; readme?: string; repository?: string; homepage?: string }>{
  const safe = pkg.trim();
  if (!safe) throw new Error("Package name is required");

  const base = `${PACKAGE_ENDPOINT}/${encodeURIComponent(safe)}`;
  const url = version ? `${base}/${encodeURIComponent(version)}` : base;
  const res = await httpGet(url, { retries: 1 });
  if (!res.ok) throw new Error(`npm package fetch failed: ${res.status} ${res.statusText}`);
  const data = (await res.json()) as NpmPackageMeta;
  const readme: string | undefined = data.readme || data.readmeFilename ? data.readme : undefined;
  // repository can be string or object
  let repository: string | undefined;
  const repo = data.repository;
  if (typeof repo === "string") repository = repo;
  else if (repo && typeof repo.url === "string") repository = repo.url;

  const homepage: string | undefined = typeof data.homepage === "string" ? data.homepage : undefined;

  return {
    name: data.name ?? safe,
    version: data.version ?? version,
    readme,
    repository,
    homepage,
  };
}
