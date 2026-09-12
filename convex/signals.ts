import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, mutation, query } from "./_generated/server";
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

/**
 * Persist a detected signal + evidence, or no-op when competitorId+type+currentState already exists.
 */
export const insertDetected = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    competitorId: v.id("competitors"),
    sourceId: v.id("sources"),
    type: v.string(),
    title: v.string(),
    summary: v.string(),
    previousState: v.string(),
    currentState: v.string(),
    previousSnapshotId: v.id("snapshots"),
    currentSnapshotId: v.id("snapshots"),
    sourceUrl: v.string(),
    diffFragment: v.string(),
    previousFragment: v.string(),
    currentFragment: v.string(),
    previousObservedAt: v.number(),
    currentObservedAt: v.number(),
  },
  returns: v.object({
    signalId: v.union(v.null(), v.id("signals")),
    deduped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("signals")
      .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId))
      .collect();

    const duplicate = existing.find(
      (s) => s.type === args.type && s.currentState === args.currentState,
    );
    if (duplicate) {
      return { signalId: null, deduped: true };
    }

    const detectedAt = Date.now();
    const signalId: Id<"signals"> = await ctx.db.insert("signals", {
      workspaceId: args.workspaceId,
      competitorId: args.competitorId,
      sourceId: args.sourceId,
      type: args.type,
      title: args.title,
      summary: args.summary,
      previousState: args.previousState,
      currentState: args.currentState,
      detectedAt,
      status: "detected",
      kind: args.type === "price_change" ? "threat" : "neutral",
      severity: "medium",
      urgency: "medium",
      score: 50,
      confidence: 0.85,
      previousSnapshotId: args.previousSnapshotId,
      currentSnapshotId: args.currentSnapshotId,
      assessment: null,
      recommendations: [],
      layout: [],
      selectedRecommendationId: null,
      error: null,
    });

    const evidenceRows = [
      {
        kind: "previous_snapshot" as const,
        provider: "internal" as const,
        url: args.sourceUrl,
        title: "Previous snapshot",
        fragment: args.previousFragment,
        confidence: 0.99,
        observedAt: args.previousObservedAt,
      },
      {
        kind: "current_snapshot" as const,
        provider: "internal" as const,
        url: args.sourceUrl,
        title: "Current snapshot",
        fragment: args.currentFragment,
        confidence: 0.99,
        observedAt: args.currentObservedAt,
      },
      {
        kind: "diff" as const,
        provider: "internal" as const,
        url: args.sourceUrl,
        title: "Structural diff",
        fragment: args.diffFragment,
        confidence: 0.97,
        observedAt: args.currentObservedAt,
      },
    ];

    for (const row of evidenceRows) {
      await ctx.db.insert("evidence", {
        workspaceId: args.workspaceId,
        signalId,
        ...row,
      });
    }

    return { signalId, deduped: false };
  },
});

/** Test/demo helper: remove all signals (+ evidence) for a source so compare can re-create. */
export const purgeBySource = mutation({
  args: { sourceId: v.id("sources") },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, { sourceId }) => {
    const source = await ctx.db.get("sources", sourceId);
    if (!source) {
      return { deleted: 0 };
    }

    const rows = await ctx.db
      .query("signals")
      .withIndex("by_competitor", (q) => q.eq("competitorId", source.competitorId))
      .collect();

    const forSource = rows.filter((s) => s.sourceId === sourceId);
    let deleted = 0;
    for (const signal of forSource) {
      const evidence = await ctx.db
        .query("evidence")
        .withIndex("by_signal", (q) => q.eq("signalId", signal._id))
        .collect();
      for (const row of evidence) {
        await ctx.db.delete(row._id);
      }
      await ctx.db.delete(signal._id);
      deleted += 1;
    }
    return { deleted };
  },
});
