import { v } from "convex/values";
import { query } from "./_generated/server";
import schema, { vBlock } from "./schema";
import { defaultLayout } from "./layout";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(schema.doc("signals")),
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("signals")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { signalId: v.id("signals") },
  returns: v.union(
    v.null(),
    v.object({
      signal: schema.doc("signals"),
      evidence: v.array(schema.doc("evidence")),
      competitor: schema.doc("competitors"),
      source: schema.doc("sources"),
    }),
  ),
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      return null;
    }

    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .collect();

    const competitor = await ctx.db.get("competitors", signal.competitorId);
    const source = await ctx.db.get("sources", signal.sourceId);
    if (!competitor || !source) {
      return null;
    }

    return { signal, evidence, competitor, source };
  },
});

export const layout = query({
  args: { signalId: v.id("signals") },
  returns: v.array(vBlock),
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal || signal.layout.length === 0) {
      return defaultLayout(signalId);
    }
    return signal.layout;
  },
});
