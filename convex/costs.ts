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
  handler: async () => {
    return null;
  },
});
