import { v } from "convex/values";
import { query } from "./_generated/server";
import schema from "./schema";

export const get = query({
  args: { artifactId: v.id("artifacts") },
  returns: v.union(v.null(), schema.doc("artifacts")),
  handler: async (ctx, { artifactId }) => {
    return await ctx.db.get("artifacts", artifactId);
  },
});

export const bySignal = query({
  args: { signalId: v.id("signals") },
  returns: v.array(schema.doc("artifacts")),
  handler: async (ctx, { signalId }) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .collect();
  },
});
