import { v } from "convex/values";
import schema, { vPlan } from "./schema";
import type { Doc } from "./_generated/dataModel";
import { internalMutation, internalQuery, query } from "./_generated/server";

/** Конкурент держит единицы источников; граница защищает запрос от роста таблицы. */
const MAX_SOURCES_PER_COMPETITOR = 32;

/**
 * Проекция снапшота для UI. `markdown` (до 20 000 символов) намеренно не отдаём:
 * публичный реактивный запрос пересылал бы блоб браузеру на каждое обновление.
 */
const vLatestSnapshot = schema
  .doc("snapshots")
  .pick("_id", "sourceId", "fetchedAt", "headline", "plans", "features", "httpStatus");

function projectSnapshot(snapshot: Doc<"snapshots">) {
  return {
    _id: snapshot._id,
    sourceId: snapshot.sourceId,
    fetchedAt: snapshot.fetchedAt,
    headline: snapshot.headline,
    plans: snapshot.plans,
    features: snapshot.features,
    httpStatus: snapshot.httpStatus,
  };
}

/**
 * Публичный запрос для блоков «мы vs они» (`FeatureMatrix`): последний снапшот
 * конкурента. Без `sourceId` берём самый свежий по всем источникам конкурента;
 * с `sourceId` — только по этому источнику, если он принадлежит конкуренту.
 * `null` = снапшотов ещё нет (нормальное состояние до первого скана), не ошибка.
 */
export const latest = query({
  args: {
    competitorId: v.id("competitors"),
    sourceId: v.optional(v.id("sources")),
  },
  returns: v.union(v.null(), vLatestSnapshot),
  handler: async (ctx, { competitorId, sourceId }) => {
    const competitor = await ctx.db.get("competitors", competitorId);
    if (!competitor) {
      return null;
    }

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
      .take(MAX_SOURCES_PER_COMPETITOR);

    // Явный `sourceId` сужает выборку, но никогда не расширяет её за пределы конкурента.
    const scope =
      sourceId === undefined
        ? sources
        : sources.filter((source) => source._id === sourceId);

    let newest: Doc<"snapshots"> | null = null;
    for (const source of scope) {
      const candidate = await ctx.db
        .query("snapshots")
        .withIndex("by_source_and_time", (q) => q.eq("sourceId", source._id))
        .order("desc")
        .first();

      if (candidate && (newest === null || candidate.fetchedAt > newest.fetchedAt)) {
        newest = candidate;
      }
    }

    return newest === null ? null : projectSnapshot(newest);
  },
});

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
