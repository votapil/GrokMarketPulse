import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CAP_EXA_USD,
  CAP_FIRECRAWL_CREDITS,
  CAP_XAI_USD,
  DAILY_WINDOW_MS,
  firstBreach,
  remainingOf,
  spendInWindow,
  type UsageRow,
} from "../convex/budgetLogic.ts";

const NOW = 1_700_000_000_000;

function row(
  provider: UsageRow["provider"],
  createdAt: number,
  extra: Partial<UsageRow> = {},
): UsageRow {
  return { provider, createdAt, costUsd: 0, credits: 0, ...extra };
}

test("spendInWindow ignores rows older than 24h", () => {
  const spent = spendInWindow(
    [
      row("firecrawl", NOW - DAILY_WINDOW_MS - 1, { credits: 50 }),
      row("firecrawl", NOW - 1_000, { credits: 3 }),
      row("exa", NOW - 2_000, { costUsd: 0.4 }),
      row("xai", NOW - 3_000, { costUsd: 1.2 }),
      row("fal", NOW - 4_000, { costUsd: 9 }),
    ],
    NOW,
  );
  assert.deepEqual(spent, {
    firecrawlCredits: 3,
    exaUsd: 0.4,
    xaiUsd: 1.2,
  });
});

test("firstBreach stops Firecrawl before Exa and Grok", () => {
  assert.equal(
    firstBreach({
      firecrawlCredits: CAP_FIRECRAWL_CREDITS,
      exaUsd: 0,
      xaiUsd: 0,
    }),
    `Daily Firecrawl cap reached (${CAP_FIRECRAWL_CREDITS} credits). Scan skipped.`,
  );
  assert.match(
    firstBreach({
      firecrawlCredits: 0,
      exaUsd: CAP_EXA_USD,
      xaiUsd: 0,
    }) ?? "",
    /Exa/,
  );
  assert.match(
    firstBreach({
      firecrawlCredits: 0,
      exaUsd: 0,
      xaiUsd: CAP_XAI_USD,
    }) ?? "",
    /Grok/,
  );
  assert.equal(
    firstBreach({
      firecrawlCredits: CAP_FIRECRAWL_CREDITS - 1,
      exaUsd: CAP_EXA_USD - 0.01,
      xaiUsd: CAP_XAI_USD - 0.01,
    }),
    null,
  );
});

test("remainingOf floors at zero", () => {
  assert.deepEqual(
    remainingOf({
      firecrawlCredits: CAP_FIRECRAWL_CREDITS + 10,
      exaUsd: 0,
      xaiUsd: 1,
    }),
    {
      firecrawlCredits: 0,
      exaUsd: CAP_EXA_USD,
      xaiUsd: CAP_XAI_USD - 1,
    },
  );
});
