/**
 * T-31 daily spend caps. Rolling 24h window against apiUsage rows.
 * Caps are demo-safety, not the hackathon credit pool
 * (Grok ~$35 / Exa $50 / Firecrawl 10k).
 */

export const DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Cron (~48 scrapes/day for one source) plus a handful of manual Run Scan. */
export const CAP_FIRECRAWL_CREDITS = 80;
/** Verify + discovery searches on a public URL. */
export const CAP_EXA_USD = 3;
/** Detect / assess / recommend / chat / layout on a public URL. */
export const CAP_XAI_USD = 5;

export type DailySpent = {
  firecrawlCredits: number;
  exaUsd: number;
  xaiUsd: number;
};

export type DailyCaps = {
  firecrawlCredits: number;
  exaUsd: number;
  xaiUsd: number;
};

export const DAILY_CAPS: DailyCaps = {
  firecrawlCredits: CAP_FIRECRAWL_CREDITS,
  exaUsd: CAP_EXA_USD,
  xaiUsd: CAP_XAI_USD,
};

export type UsageRow = {
  provider: "xai" | "firecrawl" | "exa" | "fal";
  costUsd: number;
  credits: number;
  createdAt: number;
};

export function remainingOf(spent: DailySpent, caps: DailyCaps = DAILY_CAPS): DailySpent {
  return {
    firecrawlCredits: Math.max(0, caps.firecrawlCredits - spent.firecrawlCredits),
    exaUsd: Math.max(0, caps.exaUsd - spent.exaUsd),
    xaiUsd: Math.max(0, caps.xaiUsd - spent.xaiUsd),
  };
}

export function firstBreach(
  spent: DailySpent,
  caps: DailyCaps = DAILY_CAPS,
): string | null {
  if (spent.firecrawlCredits >= caps.firecrawlCredits) {
    return `Daily Firecrawl cap reached (${caps.firecrawlCredits} credits). Scan skipped.`;
  }
  if (spent.exaUsd >= caps.exaUsd) {
    return `Daily Exa cap reached ($${caps.exaUsd.toFixed(2)}). Scan skipped.`;
  }
  if (spent.xaiUsd >= caps.xaiUsd) {
    return `Daily Grok cap reached ($${caps.xaiUsd.toFixed(2)}). Scan skipped.`;
  }
  return null;
}

export function spendInWindow(
  rows: UsageRow[],
  now: number,
  windowMs: number = DAILY_WINDOW_MS,
): DailySpent {
  const cutoff = now - windowMs;
  let firecrawlCredits = 0;
  let exaUsd = 0;
  let xaiUsd = 0;
  for (const row of rows) {
    if (row.createdAt < cutoff) continue;
    switch (row.provider) {
      case "firecrawl":
        firecrawlCredits += row.credits;
        break;
      case "exa":
        exaUsd += row.costUsd;
        break;
      case "xai":
        xaiUsd += row.costUsd;
        break;
      default:
        break;
    }
  }
  return { firecrawlCredits, exaUsd, xaiUsd };
}
