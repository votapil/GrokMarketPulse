import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

const FIXTURE_AT = 1_725_086_400_000;

const fixtureRunSteps = [
  { key: "firecrawl", label: "Scrape pricing", status: "done" as const, detail: "200 OK" },
  { key: "diff", label: "Diff snapshots", status: "done" as const, detail: "$49 → $39" },
  {
    key: "grok_filter",
    label: "Filter noise",
    status: "done" as const,
    detail: "Material price_change",
  },
  {
    key: "signal",
    label: "Persist signal",
    status: "done" as const,
    detail: "recommendations_ready",
  },
];

const fixtureAssessment = {
  why: "AcmeFlow cut Pro from $49 to $39 — undercuts our $45 Pro on list price.",
  positionChange: "Price leadership shifts toward AcmeFlow for SMB seats.",
  affectedAreas: ["pricing", "SMB acquisition"],
  affectedSegments: ["SMB", "mid-market"],
  reactionSpeed: "72 hours",
  scoreExplanation: "High severity price cut with clear evidence and high confidence.",
};

const fixtureRecommendations = [
  {
    id: "rec_1",
    title: "Match SMB list price",
    action: "Introduce a limited SMB Pro at $39 with clear seat caps.",
    rationale: "Neutralizes AcmeFlow's headline undercut without full margin hit.",
    expectedImpact: "Protect SMB win rate within 2 weeks.",
    effort: "medium" as const,
    risk: "medium" as const,
    priority: 1,
    artifactType: "offer" as const,
  },
  {
    id: "rec_2",
    title: "Battlecard for AEs",
    action: "Ship a battlecard emphasizing AI quality and SLA vs cheaper seats.",
    rationale: "Sales needs a crisp answer when prospects quote $39.",
    expectedImpact: "Shorter competitive deal cycles.",
    effort: "low" as const,
    risk: "low" as const,
    priority: 2,
    artifactType: "battlecard" as const,
  },
  {
    id: "rec_3",
    title: "Counter-landing",
    action: "Publish a landing that contrasts $39 empty seats vs our AI outcomes.",
    rationale: "Own the narrative on value, not only list price.",
    expectedImpact: "Higher demo conversion from price-shoppers.",
    effort: "high" as const,
    risk: "low" as const,
    priority: 3,
    artifactType: "landing" as const,
  },
];

function layoutForSignal(signalId: string) {
  return [
    { id: "b1", type: "SignalCard" as const, props: { signalId } },
    { id: "b2", type: "DiffView" as const, props: { signalId } },
    { id: "b3", type: "EvidenceCard" as const, props: { signalId } },
    { id: "b4", type: "MetricCards" as const, props: { signalId } },
    {
      id: "b5",
      type: "RecommendationCards" as const,
      props: { signalId },
    },
  ];
}

export const ensureDemo = internalMutation({
  args: {},
  returns: v.object({ workspaceId: v.id("workspaces") }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();

    if (existing) {
      const run = await ctx.db
        .query("runs")
        .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", existing._id))
        .order("desc")
        .first();

      if (!run) {
        const competitor = await ctx.db
          .query("competitors")
          .withIndex("by_workspace", (q) => q.eq("workspaceId", existing._id))
          .first();
        const signal = await ctx.db
          .query("signals")
          .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", existing._id))
          .order("desc")
          .first();

        await ctx.db.insert("runs", {
          workspaceId: existing._id,
          competitorId: competitor?._id ?? null,
          kind: "scan",
          status: "done",
          startedAt: FIXTURE_AT - 60_000,
          finishedAt: FIXTURE_AT,
          signalId: signal?._id ?? null,
          steps: fixtureRunSteps,
          error: null,
        });
      }

      return { workspaceId: existing._id };
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
      context: {
        businessType: "B2B SaaS",
        category: "customer support / helpdesk",
        targetSegments: ["SMB", "mid-market"],
        pricingModel: "seat-based subscription",
        keyProducts: ["Inbox", "AI Copilot", "Knowledge Base"],
        keyFeatures: ["omnichannel inbox", "AI draft replies", "SLA policies"],
        positioning: "AI-native helpdesk for SMB and mid-market teams in EU/US",
        competitiveDimensions: ["price", "AI quality", "time-to-value", "integrations"],
        plans: [
          {
            name: "Pro",
            usd: 45,
            period: "month",
            limits: "10 seats",
            features: ["AI drafts", "SLA", "SSO"],
          },
        ],
      },
      error: null,
    });

    const competitorId = await ctx.db.insert("competitors", {
      workspaceId,
      name: "AcmeFlow",
      url: "https://acmeflow.example/mock/acmeflow/pricing",
      kind: "direct",
      summary: "Direct competitor in AI helpdesk pricing.",
      origin: "seed",
    });

    const sourceId = await ctx.db.insert("sources", {
      workspaceId,
      competitorId,
      url: "https://acmeflow.example/mock/acmeflow/pricing",
      kind: "pricing",
      label: "AcmeFlow Pricing",
      lastFetchedAt: FIXTURE_AT,
      lastStatus: 200,
    });

    const snapshotV1Id = await ctx.db.insert("snapshots", {
      workspaceId,
      sourceId,
      fetchedAt: FIXTURE_AT - 86_400_000,
      isBaseline: true,
      hash: "hash_v1_pro_49",
      markdown:
        "# AcmeFlow Pricing\n\n## Pro\n$49 / month\n\n- AI inbox\n- 5 seats\n- Email + chat",
      plans: [
        {
          name: "Pro",
          usd: 49,
          period: "month",
          limits: "5 seats",
          features: ["AI inbox", "Email + chat"],
        },
      ],
      features: ["AI inbox", "Email + chat"],
      headline: "AcmeFlow Pricing",
      provider: "fixture",
      httpStatus: 200,
    });

    const snapshotV2Id = await ctx.db.insert("snapshots", {
      workspaceId,
      sourceId,
      fetchedAt: FIXTURE_AT,
      isBaseline: false,
      hash: "hash_v2_pro_39",
      markdown:
        "# AcmeFlow Pricing\n\n## Pro\n$39 / month\n\n- AI inbox\n- 5 seats\n- Email + chat\n- Priority support",
      plans: [
        {
          name: "Pro",
          usd: 39,
          period: "month",
          limits: "5 seats",
          features: ["AI inbox", "Email + chat", "Priority support"],
        },
      ],
      features: ["AI inbox", "Email + chat", "Priority support"],
      headline: "AcmeFlow Pricing",
      provider: "fixture",
      httpStatus: 200,
    });

    const signalId = await ctx.db.insert("signals", {
      workspaceId,
      competitorId,
      sourceId,
      type: "price_change",
      title: "AcmeFlow Pro $49 → $39",
      summary: "Competitor cut Pro monthly price from $49 to $39.",
      previousState: "Pro $49/mo",
      currentState: "Pro $39/mo",
      detectedAt: FIXTURE_AT,
      status: "recommendations_ready",
      kind: "threat",
      severity: "high",
      urgency: "high",
      score: 82,
      confidence: 0.91,
      previousSnapshotId: snapshotV1Id,
      currentSnapshotId: snapshotV2Id,
      assessment: fixtureAssessment,
      recommendations: fixtureRecommendations,
      layout: [],
      selectedRecommendationId: null,
      error: null,
    });

    await ctx.db.patch(signalId, {
      layout: layoutForSignal(signalId),
    });

    const sourceUrl = "https://acmeflow.example/mock/acmeflow/pricing";
    const evidenceRows = [
      {
        kind: "previous_snapshot" as const,
        provider: "internal" as const,
        url: sourceUrl,
        title: "Baseline pricing snapshot",
        fragment: "Pro $49 / month",
        confidence: 0.99,
        observedAt: FIXTURE_AT - 86_400_000,
      },
      {
        kind: "current_snapshot" as const,
        provider: "firecrawl" as const,
        url: sourceUrl,
        title: "Current pricing snapshot",
        fragment: "Pro $39 / month",
        confidence: 0.98,
        observedAt: FIXTURE_AT,
      },
      {
        kind: "diff" as const,
        provider: "internal" as const,
        url: sourceUrl,
        title: "Price diff",
        fragment: "- Pro $49 / month\n+ Pro $39 / month",
        confidence: 0.97,
        observedAt: FIXTURE_AT,
      },
      {
        kind: "exa_source" as const,
        provider: "exa" as const,
        url: "https://news.example/acmeflow-price-cut",
        title: "AcmeFlow announces lower Pro pricing",
        fragment: "AcmeFlow said Pro now starts at $39 per month.",
        confidence: 0.7,
        observedAt: FIXTURE_AT,
      },
      {
        kind: "exa_source" as const,
        provider: "exa" as const,
        url: "https://blog.example/helpdesk-price-war",
        title: "Helpdesk vendors race on list price",
        fragment: "Several AI helpdesks cut entry prices this week.",
        confidence: 0.62,
        observedAt: FIXTURE_AT,
      },
    ];

    for (const row of evidenceRows) {
      await ctx.db.insert("evidence", { workspaceId, signalId, ...row });
    }

    await ctx.db.insert("artifacts", {
      workspaceId,
      signalId,
      recommendationId: "rec_3",
      type: "landing",
      status: "ready",
      payload: {
        type: "landing",
        headline: "Outcomes beat empty seats",
        subheadline: "Why $39 list price is not the same as AI that closes tickets.",
        offer: "Book a 15-minute demo of Helpdesk AI Pro.",
        benefits: [
          { title: "AI that drafts", body: "Replies grounded in your knowledge base." },
          { title: "SLA you can trust", body: "Policies that sales and CS share." },
        ],
        differentiation: "We optimize for resolution rate, not only list price.",
        comparison: [
          { feature: "List price", us: "$45/mo", them: "$39/mo" },
          { feature: "AI drafts", us: "Yes", them: "Limited" },
        ],
        socialProofPlaceholders: ["Logo: EU SaaS", "Logo: US SMB"],
        cta: "See the difference",
        sections: [{ title: "Why now", body: "AcmeFlow cut price — compete on value." }],
      },
      heroImageUrl: null,
      error: null,
    });

    await ctx.db.insert("artifacts", {
      workspaceId,
      signalId,
      recommendationId: "rec_2",
      type: "battlecard",
      status: "ready",
      payload: {
        type: "battlecard",
        competitorChange: "Pro $49 → $39",
        threat: "Headline price undercut on SMB seats.",
        competitorStrengths: ["Lower list price", "Simple packaging"],
        competitorWeaknesses: ["Weaker AI drafts", "Fewer SLA controls"],
        ourStrengths: ["AI quality", "EU/US mid-market fit"],
        positioning: "Pay for outcomes, not empty seats.",
        objections: [
          {
            objection: "They are $6 cheaper.",
            response: "Compare resolution rate and CSAT, not sticker price.",
          },
        ],
        talkingPoints: ["Ask about AI draft acceptance rate", "Ask about SLA breach handling"],
      },
      heroImageUrl: null,
      error: null,
    });

    await ctx.db.insert("artifacts", {
      workspaceId,
      signalId,
      recommendationId: "rec_1",
      type: "offer",
      status: "ready",
      payload: {
        type: "offer",
        headline: "SMB Pro at $39",
        proposition: "Match AcmeFlow list price for ≤5 seats for 90 days.",
        value: "Keep SMB deals without rewriting mid-market packaging.",
        conditions: ["Max 5 seats", "90-day window", "Annual optional"],
        differentiators: ["Full AI drafts", "SLA policies included"],
        cta: "Enable SMB Pro",
      },
      heroImageUrl: null,
      error: null,
    });

    await ctx.db.insert("mockSite", { slug: "acmeflow", variant: "v1" });

    await ctx.db.insert("runs", {
      workspaceId,
      competitorId,
      kind: "scan",
      status: "done",
      startedAt: FIXTURE_AT - 60_000,
      finishedAt: FIXTURE_AT,
      signalId,
      steps: fixtureRunSteps,
      error: null,
    });

    await ctx.db.insert("chatMessages", {
      workspaceId,
      role: "assistant",
      text: "AcmeFlow dropped Pro to $39. I prepared three responses.",
      blocks: layoutForSignal(signalId).slice(0, 2),
      status: "ready",
      createdAt: FIXTURE_AT,
    });

    const usageRows = [
      { provider: "xai" as const, op: "assess", costUsd: 0.42, credits: 0 },
      { provider: "firecrawl" as const, op: "scrape", costUsd: 0, credits: 12 },
      { provider: "exa" as const, op: "verify", costUsd: 0.07, credits: 0 },
    ];

    for (const row of usageRows) {
      await ctx.db.insert("apiUsage", {
        workspaceId,
        ...row,
        createdAt: FIXTURE_AT,
      });
    }

    return { workspaceId };
  },
});

export const ensure = action({
  args: {},
  returns: v.object({ workspaceId: v.id("workspaces") }),
  handler: async (ctx): Promise<{ workspaceId: Id<"workspaces"> }> => {
    return await ctx.runMutation(internal.seed.ensureDemo, {});
  },
});
