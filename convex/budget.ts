/**
 * T-31: hard daily stop for the public demo. Reads apiUsage (T-25), never the
 * provider billing APIs (xAI has no remaining-credits endpoint).
 */

import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  DAILY_CAPS,
  DAILY_WINDOW_MS,
  firstBreach,
  remainingOf,
  spendInWindow,
  type UsageRow,
} from "./budgetLogic";

const PAGE_SIZE = 256;

const vSpent = v.object({
  firecrawlCredits: v.number(),
  exaUsd: v.number(),
  xaiUsd: v.number(),
});

export const check = query({
  args: {
    workspaceId: v.id("workspaces"),
    now: v.number(),
  },
  returns: v.object({
    ok: v.boolean(),
    reason: v.union(v.null(), v.string()),
    spent: vSpent,
    remaining: vSpent,
    caps: vSpent,
  }),
  handler: async (ctx, { workspaceId, now }) => {
    const cutoff = now - DAILY_WINDOW_MS;
    const rows: UsageRow[] = [];
    let cursor: number | undefined;

    for (;;) {
      const page = await ctx.db
        .query("apiUsage")
        .withIndex("by_workspace", (q) =>
          cursor === undefined
            ? q.eq("workspaceId", workspaceId)
            : q.eq("workspaceId", workspaceId).lt("_creationTime", cursor),
        )
        .order("desc")
        .take(PAGE_SIZE);

      if (page.length === 0) break;

      let hitOld = false;
      for (const row of page) {
        if (row.createdAt < cutoff) {
          hitOld = true;
          break;
        }
        rows.push({
          provider: row.provider,
          costUsd: row.costUsd,
          credits: row.credits,
          createdAt: row.createdAt,
        });
      }

      if (hitOld || page.length < PAGE_SIZE) break;
      const last = page[page.length - 1];
      if (last === undefined) break;
      cursor = last._creationTime;
    }

    const spent = spendInWindow(rows, now);
    const reason = firstBreach(spent);
    return {
      ok: reason === null,
      reason,
      spent,
      remaining: remainingOf(spent),
      caps: DAILY_CAPS,
    };
  },
});
