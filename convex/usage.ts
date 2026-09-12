import { v } from "convex/values";
import { query } from "./_generated/server";

const PAGE_SIZE = 256;

export const summary = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.object({
    xaiUsd: v.number(),
    firecrawlCredits: v.number(),
    exaUsd: v.number(),
    falUsd: v.number(),
    totalUsd: v.number(),
  }),
  handler: async (ctx, { workspaceId }) => {
    let xaiUsd = 0;
    let firecrawlCredits = 0;
    let exaUsd = 0;
    let falUsd = 0;
    let afterCreationTime: number | undefined;

    for (;;) {
      const page = await ctx.db
        .query("apiUsage")
        .withIndex("by_workspace", (q) =>
          afterCreationTime === undefined
            ? q.eq("workspaceId", workspaceId)
            : q.eq("workspaceId", workspaceId).gt("_creationTime", afterCreationTime),
        )
        .take(PAGE_SIZE);

      for (const row of page) {
        switch (row.provider) {
          case "xai":
            xaiUsd += row.costUsd;
            break;
          case "firecrawl":
            firecrawlCredits += row.credits;
            break;
          case "exa":
            exaUsd += row.costUsd;
            break;
          case "fal":
            falUsd += row.costUsd;
            break;
        }
      }

      const last = page[PAGE_SIZE - 1];
      if (last === undefined) {
        break;
      }
      afterCreationTime = last._creationTime;
    }

    return {
      xaiUsd,
      firecrawlCredits,
      exaUsd,
      falUsd,
      totalUsd: xaiUsd + exaUsd + falUsd,
    };
  },
});
