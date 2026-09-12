import { v } from "convex/values";
import schema, { vPlan } from "./schema";
import { internalMutation, internalQuery } from "./_generated/server";

export const getSource = internalQuery({
  args: { sourceId: v.id("sources") },
  returns: v.union(v.null(), schema.doc("sources")),
  handler: async (ctx, { sourceId }) => {
    return await ctx.db.get("sources", sourceId);
  },
});

export const persist = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
    fetchedAt: v.number(),
    isBaseline: v.boolean(),
    hash: v.string(),
    markdown: v.string(),
    plans: v.array(vPlan),
    features: v.array(v.string()),
    headline: v.string(),
    provider: v.union(v.literal("firecrawl"), v.literal("fixture")),
    httpStatus: v.number(),
  },
  returns: v.object({
    snapshotId: v.id("snapshots"),
    reused: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("snapshots")
      .withIndex("by_source_and_time", (q) => q.eq("sourceId", args.sourceId))
      .order("desc")
      .first();

    if (previous && previous.hash === args.hash) {
      await ctx.db.patch(args.sourceId, {
        lastFetchedAt: args.fetchedAt,
        lastStatus: args.httpStatus,
      });
      return { snapshotId: previous._id, reused: true };
    }

    const snapshotId = await ctx.db.insert("snapshots", {
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      fetchedAt: args.fetchedAt,
      isBaseline: args.isBaseline,
      hash: args.hash,
      markdown: args.markdown,
      plans: args.plans,
      features: args.features,
      headline: args.headline,
      provider: args.provider,
      httpStatus: args.httpStatus,
    });

    await ctx.db.patch(args.sourceId, {
      lastFetchedAt: args.fetchedAt,
      lastStatus: args.httpStatus,
    });

    return { snapshotId, reused: false };
  },
});

export const recordUsage = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    createdAt: v.number(),
    credits: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.insert("apiUsage", {
      workspaceId: args.workspaceId,
      provider: "firecrawl",
      op: "scrape",
      costUsd: 0,
      credits: args.credits,
      createdAt: args.createdAt,
    });
    return null;
  },
});
