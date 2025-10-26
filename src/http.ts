/** HTTP helper with timeout and simple retry logic. */
const DEFAULT_TIMEOUT_MS = 12_000;

/** Options for {@link httpGet}. */
export type FetchOptions = {
  /** Request timeout in milliseconds (default: 12s). */
  timeoutMs?: number;
  /** Additional headers to include in the request. */
  headers?: Record<string, string>;
  /** Number of retry attempts on network failures (default: 1). */
  retries?: number;
};

/**
 * Perform a GET request with a timeout and basic retry backoff.
 *
 * @param url - Absolute URL to fetch.
 * @param opts - Optional {@link FetchOptions} configuration.
 * @returns The fetch {@link Response} object.
 * @throws If all attempts fail or the request times out.
 */
export async function httpGet(url: string, opts: FetchOptions = {}): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const headers: Record<string, string> = {
    "user-agent": `npmlens-mcp/0.1.0 (+https://www.npmjs.com/)`,
    ...opts.headers,
  };
  const retries = Math.max(0, opts.retries ?? 1);
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(t);
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      await sleep(300 * (attempt + 1));
    }
  }
  if (lastErr instanceof Error) throw lastErr;
  throw new Error(String(lastErr));
}

/** Sleep helper used between retries. */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
