/** npm downloads API wrapper. */
import { httpGet } from "./http.js";

/** Point-in-time downloads payload from api.npmjs.org. */
export type DownloadsPoint = {
  /** Number of downloads in the period. */
  downloads: number;
  /** Period start (ISO date). */
  start: string;
  /** Period end (ISO date). */
  end: string;
  /** Package name. */
  package: string;
};

/**
 * Fetch downloads for the last day, week, or month.
 *
 * @param period - Time window to query.
 * @param pkg - Package name.
 * @returns The downloads point payload.
 */
export async function downloadsLast(period: "day" | "week" | "month", pkg: string): Promise<DownloadsPoint> {
  const periods: Record<typeof period, string> = {
    day: "last-day",
    week: "last-week",
    month: "last-month",
  } as const;
  const url = `https://api.npmjs.org/downloads/point/${periods[period]}/${encodeURIComponent(pkg)}`;
  const res = await httpGet(url);
  if (!res.ok) throw new Error(`downloads fetch failed: ${res.status} ${res.statusText}`);
  return (await res.json()) as DownloadsPoint;
}
