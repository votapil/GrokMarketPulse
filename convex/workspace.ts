import { v } from "convex/values";
import { query } from "./_generated/server";
import schema from "./schema";

/** Read-only demo snapshot. First open seeds via `api.seed.ensure` (PulseScreen). */

export const demo = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      workspace: schema.doc("workspaces"),
      company: schema.doc("companies"),
      competitors: v.array(schema.doc("competitors")),
      sources: v.array(schema.doc("sources")),
    }),
  ),
  handler: async (ctx) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();
    if (!workspace) {
      return null;
    }

    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .first();
    if (!company) {
      return null;
    }

    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    return { workspace, company, competitors, sources };
  },
});
