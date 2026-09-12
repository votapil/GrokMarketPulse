import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, env, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { MOCK_PRICING_PATH } from "./mockHtml";
import {
  companyContext,
  fixtureBaseline,
  slackAssessment,
  slackEvidence,
  SLACK_DETECTED_AT,
  SLACK_TITLE,
} from "./seedData";

const upsertReturn = v.object({
  workspaceId: v.id("workspaces"),
  sourceId: v.id("sources"),
  hasBaseline: v.boolean(),
});

function slackLayout(signalId: string) {
  return [
    { id: "b1", type: "SignalCard" as const, props: { signalId } },
    { id: "b3", type: "EvidenceCard" as const, props: { signalId } },
    { id: "b4", type: "MetricCards" as const, props: { signalId } },
  ];
}

export const upsertDemo = internalMutation({
  args: { sourceUrl: v.string() },
  returns: upsertReturn,
  handler: async (ctx, { sourceUrl }) => {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();

    if (existing) {
      const competitor = await ctx.db
        .query("competitors")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", existing._id))
        .first();
      if (competitor && competitor.url !== sourceUrl) {
        await ctx.db.patch(competitor._id, { url: sourceUrl });
      }

      let source = await ctx.db
        .query("sources")
        .withIndex("by_workspace", (q) => q.eq("workspaceId", existing._id))
        .first();

      if (!source && competitor) {
        const sourceId = await ctx.db.insert("sources", {
          workspaceId: existing._id,
          competitorId: competitor._id,
          url: sourceUrl,
          kind: "pricing",
          label: "AcmeFlow Pricing",
          lastFetchedAt: null,
          lastStatus: null,
        });
        source = await ctx.db.get("sources", sourceId);
      } else if (source && source.url !== sourceUrl) {
        await ctx.db.patch(source._id, { url: sourceUrl });
      }

      if (!source) {
        throw new Error("demo workspace is missing a pricing source");
      }

      const snapshots = await ctx.db
        .query("snapshots")
        .withIndex("by_source_and_time", (q) => q.eq("sourceId", source._id))
        .collect();

      return {
        workspaceId: existing._id,
        sourceId: source._id,
        hasBaseline: snapshots.some((row) => row.isBaseline),
      };
    }

    const workspaceId = await ctx.db.insert("workspaces", {
      name: "Helpdesk AI",
      slug: "demo",
    });

    await ctx.db.insert("companies", {
      workspaceId,
      name: "Helpdesk AI",
      url: "https://helpdesk.ai",
      contextStatus: "ready",
      context: companyContext,
      error: null,
    });

    const competitorId = await ctx.db.insert("competitors", {
      workspaceId,
      name: "AcmeFlow",
      url: sourceUrl,
      kind: "direct",
      summary: "Direct competitor in AI helpdesk pricing.",
      origin: "seed",
    });

    const sourceId = await ctx.db.insert("sources", {
      workspaceId,
      competitorId,
      url: sourceUrl,
      kind: "pricing",
      label: "AcmeFlow Pricing",
      lastFetchedAt: null,
      lastStatus: null,
    });

    const signalId = await ctx.db.insert("signals", {
      workspaceId,
      competitorId,
      sourceId,
      type: "new_feature",
      title: SLACK_TITLE,
      summary: "AcmeFlow shipped native Slack alerts for ticket SLA.",
      previousState: "Email + chat only",
      currentState: "Email + chat + Slack",
      detectedAt: SLACK_DETECTED_AT,
      status: "resolved",
      kind: "opportunity",
      severity: "low",
      urgency: "low",
      score: 34,
      confidence: 0.8,
      previousSnapshotId: null,
      currentSnapshotId: null,
      assessment: slackAssessment,
      recommendations: [],
      layout: [],
      selectedRecommendationId: null,
      error: null,
    });

    await ctx.db.patch(signalId, { layout: slackLayout(signalId) });

    for (const row of slackEvidence(sourceUrl)) {
      await ctx.db.insert("evidence", { workspaceId, signalId, ...row });
    }

    return { workspaceId, sourceId, hasBaseline: false };
  },
});

export const insertFixtureBaseline = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
  },
  returns: v.id("snapshots"),
  handler: async (ctx, args) => {
    const previous = await ctx.db
      .query("snapshots")
      .withIndex("by_source_and_time", (q) => q.eq("sourceId", args.sourceId))
      .collect();
    const existing = previous.find((row) => row.isBaseline);
    if (existing) {
      return existing._id;
    }

    const fetchedAt = Date.now();
    const snapshotId = await ctx.db.insert("snapshots", {
      workspaceId: args.workspaceId,
      sourceId: args.sourceId,
      fetchedAt,
      isBaseline: true,
      hash: fixtureBaseline.hash,
      markdown: fixtureBaseline.markdown,
      plans: fixtureBaseline.plans,
      features: fixtureBaseline.features,
      headline: fixtureBaseline.headline,
      provider: "fixture",
      httpStatus: 200,
    });

    await ctx.db.patch(args.sourceId, {
      lastFetchedAt: fetchedAt,
      lastStatus: 200,
    });

    return snapshotId;
  },
});

export const ensure = action({
  args: {},
  returns: v.object({ workspaceId: v.id("workspaces") }),
  handler: async (ctx): Promise<{ workspaceId: Id<"workspaces"> }> => {
    const sourceUrl = `${env.CONVEX_SITE_URL.replace(/\/$/, "")}${MOCK_PRICING_PATH}`;
    const upserted = await ctx.runMutation(internal.seed.upsertDemo, {
      sourceUrl,
    });

    await ctx.runMutation(internal.mock.flipVariant, { variant: "v1" });

    if (!upserted.hasBaseline) {
      const scraped = await ctx.runAction(internal.firecrawl.scrape, {
        sourceId: upserted.sourceId,
        isBaseline: true,
      });
      if (!scraped.ok) {
        await ctx.runMutation(internal.seed.insertFixtureBaseline, {
          workspaceId: upserted.workspaceId,
          sourceId: upserted.sourceId,
        });
      }
    }

    return { workspaceId: upserted.workspaceId };
  },
});
