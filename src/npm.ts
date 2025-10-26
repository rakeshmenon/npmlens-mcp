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

/**
 * Version information for a package.
 */
export type PackageVersion = {
  /** Version string */
  version: string;
  /** Publish date */
  date: string;
  /** Dist tags (e.g., "latest", "next") */
  tags?: string[];
};

type NpmPackageAllVersions = {
  name?: string;
  "dist-tags"?: Record<string, string>;
  time?: Record<string, string>;
  versions?: Record<string, {
    version?: string;
    deprecated?: string | boolean;
  }>;
};

/**
 * Get all versions of a package with publish dates and tags.
 *
 * @param pkg - Package name.
 * @param limit - Maximum number of versions to return (most recent first).
 * @param since - Optional date filter (ISO string or relative like "6 months").
 * @returns Array of versions sorted by date (newest first).
 */
export async function getPackageVersions(
  pkg: string,
  limit?: number,
  since?: string
): Promise<{ name: string; versions: PackageVersion[] }> {
  const safe = pkg.trim();
  if (!safe) throw new Error("Package name is required");

  const url = `${PACKAGE_ENDPOINT}/${encodeURIComponent(safe)}`;
  const res = await httpGet(url, { retries: 1 });
  if (!res.ok) throw new Error(`npm package fetch failed: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as NpmPackageAllVersions;
  const distTags = data["dist-tags"] ?? {};
  const timeData = data.time ?? {};
  const versions = data.versions ?? {};

  // Create reverse map: version -> tags
  const versionToTags: Record<string, string[]> = {};
  for (const [tag, ver] of Object.entries(distTags)) {
    if (!versionToTags[ver]) versionToTags[ver] = [];
    versionToTags[ver].push(tag);
  }

  // Parse since date if provided
  let sinceDate: Date | undefined;
  if (since) {
    // Try parsing as ISO date first
    const parsed = new Date(since);
    if (!isNaN(parsed.getTime())) {
      sinceDate = parsed;
    } else {
      // Try relative format like "6 months", "1 year", "30 days"
      const match = /^(\d+)\s*(month|year|day)s?$/i.exec(since.trim());
      if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        sinceDate = new Date();
        if (unit === "day") sinceDate.setDate(sinceDate.getDate() - amount);
        else if (unit === "month") sinceDate.setMonth(sinceDate.getMonth() - amount);
        else if (unit === "year") sinceDate.setFullYear(sinceDate.getFullYear() - amount);
      }
    }
  }

  // Build version list
  const versionList: PackageVersion[] = [];
  for (const [ver] of Object.entries(versions)) {
    const dateStr = timeData[ver];
    if (!dateStr) continue;

    const date = new Date(dateStr);
    if (sinceDate && date < sinceDate) continue;

    versionList.push({
      version: ver,
      date: dateStr,
      tags: versionToTags[ver],
    });
  }

  // Sort by date descending
  versionList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Apply limit
  const limited = limit && limit > 0 ? versionList.slice(0, limit) : versionList;

  return {
    name: data.name ?? safe,
    versions: limited,
  };
}

/**
 * Dependency information.
 */
export type DependencyInfo = {
  /** Dependency name */
  name: string;
  /** Version range */
  version: string;
  /** Nested dependencies (if depth > 1) */
  dependencies?: DependencyInfo[];
};

type NpmPackageMetaFull = {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

/**
 * Get dependencies for a package.
 *
 * @param pkg - Package name.
 * @param version - Optional version (defaults to latest).
 * @param depth - How deep to traverse (default 1, max 3).
 * @param includeDevDependencies - Include devDependencies.
 * @returns Dependency tree.
 */
export async function getPackageDependencies(
  pkg: string,
  version?: string,
  depth = 1,
  includeDevDependencies = false
): Promise<{ name: string; version: string; dependencies: DependencyInfo[]; devDependencies?: DependencyInfo[] }> {
  const safe = pkg.trim();
  if (!safe) throw new Error("Package name is required");
  if (depth < 1 || depth > 3) throw new Error("depth must be between 1 and 3");

  const base = `${PACKAGE_ENDPOINT}/${encodeURIComponent(safe)}`;
  const url = version ? `${base}/${encodeURIComponent(version)}` : base;
  const res = await httpGet(url, { retries: 1 });
  if (!res.ok) throw new Error(`npm package fetch failed: ${res.status} ${res.statusText}`);

  const data = (await res.json()) as NpmPackageMetaFull;
  const deps = data.dependencies ?? {};
  const devDeps = includeDevDependencies ? (data.devDependencies ?? {}) : {};

  // Convert to DependencyInfo array
  const dependencies: DependencyInfo[] = Object.entries(deps).map(([name, ver]) => ({
    name,
    version: ver,
  }));

  const devDependencies: DependencyInfo[] = Object.entries(devDeps).map(([name, ver]) => ({
    name,
    version: ver,
  }));

  return {
    name: data.name ?? safe,
    version: data.version ?? version ?? "latest",
    dependencies,
    devDependencies: includeDevDependencies ? devDependencies : undefined,
  };
}

/**
 * Package comparison data.
 */
export type PackageComparison = {
  name: string;
  version?: string;
  description?: string;
  downloads?: number;
  stars?: number;
  forks?: number;
  license?: string;
  repository?: string;
  homepage?: string;
  error?: string;
};

/**
 * Compare multiple packages side-by-side.
 *
 * @param packages - Array of package names to compare.
 * @returns Comparison data for each package.
 */
export async function comparePackages(packages: string[]): Promise<PackageComparison[]> {
  if (!packages || packages.length === 0) {
    throw new Error("At least one package name is required");
  }
  if (packages.length > 10) {
    throw new Error("Maximum 10 packages can be compared at once");
  }

  // Import here to avoid circular dependency
  const { downloadsLast } = await import("./downloads.js");
  const { fetchGithubRepo } = await import("./github.js");

  const results: PackageComparison[] = [];

  // Fetch all packages in parallel
  const promises = packages.map(async (pkg) => {
    try {
      const safe = pkg.trim();
      if (!safe) throw new Error("Package name cannot be empty");

      // Fetch package metadata
      const pkgData = await getReadme(safe);

      // Fetch downloads
      let downloads: number | undefined;
      try {
        const dlData = await downloadsLast("week", safe);
        downloads = dlData.downloads;
      } catch {
        // Ignore download errors
      }

      // Fetch GitHub data
      let stars: number | undefined;
      let forks: number | undefined;
      let license: string | undefined;
      try {
        const ghData = await fetchGithubRepo(pkgData.repository);
        stars = ghData?.stars;
        forks = ghData?.forks;
        license = ghData?.license;
      } catch {
        // Ignore GitHub errors
      }

      return {
        name: pkgData.name,
        version: pkgData.version,
        description: pkgData.readme?.split("\n")[0]?.replace(/^#+ */, "").trim().substring(0, 200),
        downloads,
        stars,
        forks,
        license,
        repository: pkgData.repository,
        homepage: pkgData.homepage,
      };
    } catch (err: unknown) {
      return {
        name: pkg,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });

  results.push(...(await Promise.all(promises)));
  return results;
}
