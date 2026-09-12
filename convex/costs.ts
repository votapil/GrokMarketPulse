/**
 * Spend log for the sponsor APIs. Every paid call across scan / assess /
 * recommend / act / verify writes one row here; `api.usage.summary` reads them.
 */

import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const log = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    provider: v.union(
      v.literal("xai"),
      v.literal("firecrawl"),
      v.literal("exa"),
      v.literal("fal"),
    ),
    op: v.string(),
    costUsd: v.number(),
    credits: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // A bad usage number from a provider must not fail the call it belongs to.
    const costUsd = Number.isFinite(args.costUsd) ? args.costUsd : 0;
    const credits = Number.isFinite(args.credits) ? args.credits : 0;

    await ctx.db.insert("apiUsage", {
      workspaceId: args.workspaceId,
      provider: args.provider,
      op: args.op,
      costUsd,
      credits,
      createdAt: Date.now(),
    });
    return null;
  },
});
