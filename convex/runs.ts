import { v } from "convex/values";
import { query } from "./_generated/server";
import schema from "./schema";

export const latest = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(v.null(), schema.doc("runs")),
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("runs")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .first();
  },
});
