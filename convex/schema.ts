import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const vLevel = v.union(
  v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"),
);

export const vSignalStatus = v.union(
  v.literal("detected"), v.literal("verifying"), v.literal("verified"),
  v.literal("assessed"), v.literal("recommendations_ready"),
  v.literal("action_selected"), v.literal("artifact_generated"),
  v.literal("resolved"), v.literal("low_confidence"), v.literal("error"),
);

export const vBlockType = v.union(
  v.literal("SignalCard"), v.literal("DiffView"), v.literal("EvidenceCard"),
  v.literal("MetricCards"), v.literal("RecommendationCards"), v.literal("SourceList"),
  v.literal("Timeline"), v.literal("Chart"), v.literal("FeatureMatrix"),
  v.literal("ActionPreview"), v.literal("DataGrid"), v.literal("GeoMap"),
);

// Блок несёт ТОЛЬКО тип и ссылки-идентификаторы. Данные фронт берёт из Convex
// реактивно. Grok решает "что показать", но не "какими данными" — это и есть
// защита из ТЗ §41: ни одной строки разметки от модели.
export const vBlock = v.object({
  id: v.string(),
  type: vBlockType,
  props: v.record(v.string(), v.string()),
});

export const vPlan = v.object({
  name: v.string(),
  usd: v.union(v.number(), v.null()),
  period: v.string(),          // "month" | "year" | "one-time"
  limits: v.string(),
  features: v.array(v.string()),
});

export const vCompanyContext = v.object({
  businessType: v.string(),
  category: v.string(),
  targetSegments: v.array(v.string()),
  pricingModel: v.string(),
  keyProducts: v.array(v.string()),
  keyFeatures: v.array(v.string()),
  positioning: v.string(),
  competitiveDimensions: v.array(v.string()),
  plans: v.array(vPlan),
});

export const vRecommendation = v.object({
  id: v.string(),                                  // "rec_1" | "rec_2" | "rec_3"
  title: v.string(),
  action: v.string(),
  rationale: v.string(),
  expectedImpact: v.string(),
  effort: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  risk: v.union(v.literal("low"), v.literal("medium"), v.literal("high")),
  priority: v.number(),                            // 1..3
  artifactType: v.union(v.literal("battlecard"), v.literal("offer"), v.literal("landing")),
});

export const vAssessment = v.object({
  why: v.string(),
  positionChange: v.string(),
  affectedAreas: v.array(v.string()),
  affectedSegments: v.array(v.string()),
  reactionSpeed: v.string(),
  scoreExplanation: v.string(),
});

export default defineSchema({
  workspaces: defineTable({
    name: v.string(),
    slug: v.string(),                              // демо-воркспейс: "demo"
  }).index("by_slug", ["slug"]),

  companies: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    context: v.union(v.null(), vCompanyContext),
    contextStatus: v.union(
      v.literal("empty"), v.literal("pending"), v.literal("ready"), v.literal("error"),
    ),
    error: v.union(v.null(), v.string()),
  }).index("by_workspace", ["workspaceId"]),

  competitors: defineTable({
    workspaceId: v.id("workspaces"),
    name: v.string(),
    url: v.string(),
    kind: v.string(),                              // "direct" | "adjacent" | "suspected"
    summary: v.string(),
    origin: v.union(v.literal("manual"), v.literal("grok"), v.literal("exa"), v.literal("seed")),
  }).index("by_workspace", ["workspaceId"]),

  sources: defineTable({
    workspaceId: v.id("workspaces"),
    competitorId: v.id("competitors"),
    url: v.string(),
    kind: v.string(),                              // pricing | product | features | homepage | changelog | landing | news
    label: v.string(),
    lastFetchedAt: v.union(v.null(), v.number()),
    lastStatus: v.union(v.null(), v.number()),     // HTTP-код от Firecrawl
  }).index("by_competitor", ["competitorId"])
    .index("by_workspace", ["workspaceId"]),

  snapshots: defineTable({
    workspaceId: v.id("workspaces"),
    sourceId: v.id("sources"),
    fetchedAt: v.number(),
    isBaseline: v.boolean(),
    hash: v.string(),                              // sha-подобный хеш нормализованного markdown
    markdown: v.string(),                          // усечён до 20 000 символов
    plans: v.array(vPlan),
    features: v.array(v.string()),
    headline: v.string(),
    provider: v.union(v.literal("firecrawl"), v.literal("fixture")),
    httpStatus: v.number(),
  }).index("by_source_and_time", ["sourceId", "fetchedAt"]),

  signals: defineTable({
    workspaceId: v.id("workspaces"),
    competitorId: v.id("competitors"),
    sourceId: v.id("sources"),
    type: v.string(),                              // price_change | new_plan | plan_removed | new_feature | ...
    title: v.string(),
    summary: v.string(),
    previousState: v.string(),                      // "Pro $49/mo"
    currentState: v.string(),                       // "Pro $39/mo"
    detectedAt: v.number(),
    status: vSignalStatus,
    kind: v.union(v.literal("threat"), v.literal("opportunity"), v.literal("neutral")),
    severity: vLevel,
    urgency: vLevel,
    score: v.number(),                             // 0..100
    confidence: v.number(),                        // 0..1
    previousSnapshotId: v.union(v.null(), v.id("snapshots")),
    currentSnapshotId: v.union(v.null(), v.id("snapshots")),
    assessment: v.union(v.null(), vAssessment),
    recommendations: v.array(vRecommendation),
    layout: v.array(vBlock),                       // выбор блоков от Grok; пусто → дефолт на фронте
    selectedRecommendationId: v.union(v.null(), v.string()),
    error: v.union(v.null(), v.string()),
  }).index("by_workspace_and_time", ["workspaceId", "detectedAt"])
    .index("by_competitor", ["competitorId"])
    .index("by_workspace_and_status", ["workspaceId", "status"]),

  evidence: defineTable({
    workspaceId: v.id("workspaces"),
    signalId: v.id("signals"),
    kind: v.union(
      v.literal("previous_snapshot"), v.literal("current_snapshot"),
      v.literal("diff"), v.literal("firecrawl_fragment"), v.literal("exa_source"),
    ),
    provider: v.union(v.literal("firecrawl"), v.literal("exa"), v.literal("internal")),
    url: v.string(),
    title: v.string(),
    fragment: v.string(),
    confidence: v.number(),
    observedAt: v.number(),
  }).index("by_signal", ["signalId"]),

  artifacts: defineTable({
    workspaceId: v.id("workspaces"),
    signalId: v.id("signals"),
    recommendationId: v.string(),
    type: v.union(v.literal("battlecard"), v.literal("offer"), v.literal("landing")),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    // payload — дискриминированный union, фронт матчит по .type
    payload: v.union(
      v.object({
        type: v.literal("battlecard"),
        competitorChange: v.string(), threat: v.string(),
        competitorStrengths: v.array(v.string()), competitorWeaknesses: v.array(v.string()),
        ourStrengths: v.array(v.string()), positioning: v.string(),
        objections: v.array(v.object({ objection: v.string(), response: v.string() })),
        talkingPoints: v.array(v.string()),
      }),
      v.object({
        type: v.literal("offer"),
        headline: v.string(), proposition: v.string(), value: v.string(),
        conditions: v.array(v.string()), differentiators: v.array(v.string()), cta: v.string(),
      }),
      v.object({
        type: v.literal("landing"),
        headline: v.string(), subheadline: v.string(), offer: v.string(),
        benefits: v.array(v.object({ title: v.string(), body: v.string() })),
        differentiation: v.string(),
        comparison: v.array(v.object({
          feature: v.string(), us: v.string(), them: v.string(),
        })),
        socialProofPlaceholders: v.array(v.string()),
        cta: v.string(),
        sections: v.array(v.object({ title: v.string(), body: v.string() })),
      }),
      v.object({ type: v.literal("empty") }),      // для status pending/error
    ),
    heroImageUrl: v.union(v.null(), v.string()),
    error: v.union(v.null(), v.string()),
  }).index("by_signal", ["signalId"])
    .index("by_workspace", ["workspaceId"]),

  runs: defineTable({
    workspaceId: v.id("workspaces"),
    competitorId: v.union(v.null(), v.id("competitors")),
    kind: v.union(v.literal("scan"), v.literal("onboarding"), v.literal("verify"), v.literal("artifact")),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    startedAt: v.number(),
    finishedAt: v.union(v.null(), v.number()),
    signalId: v.union(v.null(), v.id("signals")),
    steps: v.array(v.object({
      key: v.string(),                             // "firecrawl" | "diff" | "grok_filter" | "signal"
      label: v.string(),
      status: v.union(
        v.literal("pending"), v.literal("running"), v.literal("done"),
        v.literal("skipped"), v.literal("error"),
      ),
      detail: v.string(),
    })),
    error: v.union(v.null(), v.string()),
  }).index("by_workspace_and_time", ["workspaceId", "startedAt"]),

  chatMessages: defineTable({
    workspaceId: v.id("workspaces"),
    role: v.union(v.literal("user"), v.literal("assistant"), v.literal("system")),
    text: v.string(),
    blocks: v.array(vBlock),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("error")),
    createdAt: v.number(),
  }).index("by_workspace_and_time", ["workspaceId", "createdAt"]),

  apiUsage: defineTable({
    workspaceId: v.id("workspaces"),
    provider: v.union(
      v.literal("xai"), v.literal("firecrawl"), v.literal("exa"), v.literal("fal"),
    ),
    op: v.string(),
    costUsd: v.number(),
    credits: v.number(),
    createdAt: v.number(),
  }).index("by_workspace", ["workspaceId"]),

  mockSite: defineTable({
    slug: v.string(),                              // "acmeflow"
    variant: v.union(v.literal("v1"), v.literal("v2")),
  }).index("by_slug", ["slug"]),
});
