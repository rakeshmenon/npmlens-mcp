import { httpGet } from "./http.js";

export type DownloadsPoint = {
  downloads: number;
  start: string;
  end: string;
  package: string;
};

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

