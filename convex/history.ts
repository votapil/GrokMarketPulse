import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { query } from "./_generated/server";

export const timeline = query({
  args: { competitorId: v.id("competitors") },
  returns: v.array(
    v.object({
      at: v.number(),
      label: v.string(),
      price: v.union(v.number(), v.null()),
      signalId: v.union(v.null(), v.id("signals")),
    }),
  ),
  handler: async (ctx, { competitorId }) => {
    const competitor = await ctx.db.get("competitors", competitorId);
    if (!competitor) {
      return [];
    }

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
      .collect();

    const entries: Array<{
      at: number;
      label: string;
      price: number | null;
      signalId: Id<"signals"> | null;
    }> = [];

    for (const source of sources) {
      const snapshots = await ctx.db
        .query("snapshots")
        .withIndex("by_source_and_time", (q) => q.eq("sourceId", source._id))
        .collect();

      for (const snapshot of snapshots) {
        const proPlan = snapshot.plans.find((plan) => plan.name === "Pro");
        const price = proPlan?.usd ?? null;
        entries.push({
          at: snapshot.fetchedAt,
          label: snapshot.isBaseline
            ? `Baseline Pro $${price ?? "?"}`
            : `Pro cut to $${price ?? "?"}`,
          price,
          signalId: null,
        });
      }
    }

    const signals = await ctx.db
      .query("signals")
      .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
      .collect();

    const result = entries.map((entry) => ({ ...entry }));
    for (const signal of signals) {
      const idx = result.findIndex((entry) => entry.at === signal.detectedAt);
      if (idx >= 0) {
        result[idx] = {
          at: signal.detectedAt,
          label: signal.title,
          price: result[idx].price,
          signalId: signal._id,
        };
      } else {
        const proPrice = signal.currentState.includes("$39") ? 39 : null;
        result.push({
          at: signal.detectedAt,
          label: signal.title,
          price: proPrice,
          signalId: signal._id,
        });
      }
    }

    return result.sort((a, b) => a.at - b.at);
  },
});
