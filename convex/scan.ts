import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const createRun = internalMutation({
  args: { competitorId: v.id("competitors") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { competitorId }) => {
    const competitor = await ctx.db.get("competitors", competitorId);
    if (!competitor) {
      throw new Error("Competitor not found");
    }

    const now = Date.now();
    const runId = await ctx.db.insert("runs", {
      workspaceId: competitor.workspaceId,
      competitorId,
      kind: "scan",
      status: "running",
      startedAt: now,
      finishedAt: null,
      signalId: null,
      steps: [
        { key: "firecrawl", label: "Scrape pricing", status: "running", detail: "Queued" },
      ],
      error: null,
    });

    return { runId };
  },
});

export const run = action({
  args: { competitorId: v.id("competitors") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { competitorId }): Promise<{ runId: Id<"runs"> }> => {
    return await ctx.runMutation(internal.scan.createRun, { competitorId });
  },
});
