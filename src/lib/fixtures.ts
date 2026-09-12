import type { BlockType, Level, SignalStatus, UiBlock } from "./types";

/** Frontend fixtures — no imports from convex/. Read-only after T-02. */

export const FIXTURE_AT = 1_725_086_400_000;

export const fixtureWorkspace = {
  id: "fixture_workspace",
  name: "Helpdesk AI",
  slug: "demo",
  company: {
    id: "fixture_company",
    name: "Helpdesk AI",
    url: "https://helpdesk.ai",
    contextStatus: "ready" as const,
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
  },
};

export const fixtureCompetitor = {
  id: "fixture_competitor",
  name: "AcmeFlow",
  url: "https://acmeflow.example/mock/acmeflow/pricing",
  kind: "direct",
  summary: "Direct competitor in AI helpdesk pricing.",
  origin: "seed" as const,
};

export const fixtureSource = {
  id: "fixture_source",
  competitorId: fixtureCompetitor.id,
  url: "https://acmeflow.example/mock/acmeflow/pricing",
  kind: "pricing",
  label: "AcmeFlow Pricing",
  lastFetchedAt: FIXTURE_AT,
  lastStatus: 200,
};

export const fixtureSnapshotV1 = {
  id: "fixture_snap_v1",
  sourceId: fixtureSource.id,
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
  provider: "fixture" as const,
  httpStatus: 200,
};

export const fixtureSnapshotV2 = {
  id: "fixture_snap_v2",
  sourceId: fixtureSource.id,
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
  provider: "fixture" as const,
  httpStatus: 200,
};

export const fixtureLayout: UiBlock[] = [
  { id: "b1", type: "SignalCard" as BlockType, props: { signalId: "fixture_signal" } },
  { id: "b2", type: "DiffView" as BlockType, props: { signalId: "fixture_signal" } },
  { id: "b3", type: "EvidenceCard" as BlockType, props: { signalId: "fixture_signal" } },
  { id: "b4", type: "MetricCards" as BlockType, props: { signalId: "fixture_signal" } },
  {
    id: "b5",
    type: "RecommendationCards" as BlockType,
    props: { signalId: "fixture_signal" },
  },
];

export const fixtureAssessment = {
  why: "AcmeFlow cut Pro from $49 to $39 — undercuts our $45 Pro on list price.",
  positionChange: "Price leadership shifts toward AcmeFlow for SMB seats.",
  affectedAreas: ["pricing", "SMB acquisition"],
  affectedSegments: ["SMB", "mid-market"],
  reactionSpeed: "72 hours",
  scoreExplanation: "High severity price cut with clear evidence and high confidence.",
};

export const fixtureRecommendations = [
  {
    id: "rec_1",
    title: "Match SMB list price",
    action: "Introduce a limited SMB Pro at $39 with clear seat caps.",
    rationale: "Neutralizes AcmeFlow’s headline undercut without full margin hit.",
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

export const fixtureSignal = {
  id: "fixture_signal",
  workspaceId: fixtureWorkspace.id,
  competitorId: fixtureCompetitor.id,
  sourceId: fixtureSource.id,
  type: "price_change",
  title: "AcmeFlow Pro $49 → $39",
  summary: "Competitor cut Pro monthly price from $49 to $39.",
  previousState: "Pro $49/mo",
  currentState: "Pro $39/mo",
  detectedAt: FIXTURE_AT,
  status: "recommendations_ready" as SignalStatus,
  kind: "threat" as const,
  severity: "high" as Level,
  urgency: "high" as Level,
  score: 82,
  confidence: 0.91,
  previousSnapshotId: fixtureSnapshotV1.id,
  currentSnapshotId: fixtureSnapshotV2.id,
  assessment: fixtureAssessment,
  recommendations: fixtureRecommendations,
  layout: fixtureLayout,
  selectedRecommendationId: null as string | null,
  error: null as string | null,
};

export const fixtureEvidence = [
  {
    id: "ev_prev",
    signalId: fixtureSignal.id,
    kind: "previous_snapshot" as const,
    provider: "internal" as const,
    url: fixtureSource.url,
    title: "Baseline pricing snapshot",
    fragment: "Pro $49 / month",
    confidence: 0.99,
    observedAt: fixtureSnapshotV1.fetchedAt,
  },
  {
    id: "ev_curr",
    signalId: fixtureSignal.id,
    kind: "current_snapshot" as const,
    provider: "firecrawl" as const,
    url: fixtureSource.url,
    title: "Current pricing snapshot",
    fragment: "Pro $39 / month",
    confidence: 0.98,
    observedAt: fixtureSnapshotV2.fetchedAt,
  },
  {
    id: "ev_diff",
    signalId: fixtureSignal.id,
    kind: "diff" as const,
    provider: "internal" as const,
    url: fixtureSource.url,
    title: "Price diff",
    fragment: "- Pro $49 / month\n+ Pro $39 / month",
    confidence: 0.97,
    observedAt: FIXTURE_AT,
  },
  {
    id: "ev_exa_1",
    signalId: fixtureSignal.id,
    kind: "exa_source" as const,
    provider: "exa" as const,
    url: "https://news.example/acmeflow-price-cut",
    title: "AcmeFlow announces lower Pro pricing",
    fragment: "AcmeFlow said Pro now starts at $39 per month.",
    confidence: 0.7,
    observedAt: FIXTURE_AT,
  },
  {
    id: "ev_exa_2",
    signalId: fixtureSignal.id,
    kind: "exa_source" as const,
    provider: "exa" as const,
    url: "https://blog.example/helpdesk-price-war",
    title: "Helpdesk vendors race on list price",
    fragment: "Several AI helpdesks cut entry prices this week.",
    confidence: 0.62,
    observedAt: FIXTURE_AT,
  },
];

export const fixtureArtifactLanding = {
  id: "fixture_artifact_landing",
  signalId: fixtureSignal.id,
  recommendationId: "rec_3",
  type: "landing" as const,
  status: "ready" as const,
  payload: {
    type: "landing" as const,
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
  heroImageUrl: null as string | null,
  error: null as string | null,
};

export const fixtureArtifactBattlecard = {
  id: "fixture_artifact_battlecard",
  signalId: fixtureSignal.id,
  recommendationId: "rec_2",
  type: "battlecard" as const,
  status: "ready" as const,
  payload: {
    type: "battlecard" as const,
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
  heroImageUrl: null as string | null,
  error: null as string | null,
};

export const fixtureArtifactOffer = {
  id: "fixture_artifact_offer",
  signalId: fixtureSignal.id,
  recommendationId: "rec_1",
  type: "offer" as const,
  status: "ready" as const,
  payload: {
    type: "offer" as const,
    headline: "SMB Pro at $39",
    proposition: "Match AcmeFlow list price for ≤5 seats for 90 days.",
    value: "Keep SMB deals without rewriting mid-market packaging.",
    conditions: ["Max 5 seats", "90-day window", "Annual optional"],
    differentiators: ["Full AI drafts", "SLA policies included"],
    cta: "Enable SMB Pro",
  },
  heroImageUrl: null as string | null,
  error: null as string | null,
};

export const fixtureRunSteps = [
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

export const fixtureRun = {
  id: "fixture_run",
  workspaceId: fixtureWorkspace.id,
  competitorId: fixtureCompetitor.id,
  kind: "scan" as const,
  status: "done" as const,
  startedAt: FIXTURE_AT - 60_000,
  finishedAt: FIXTURE_AT,
  signalId: fixtureSignal.id,
  steps: fixtureRunSteps,
  error: null as string | null,
};

export const fixtureTimeline = [
  {
    at: fixtureSnapshotV1.fetchedAt,
    label: "Baseline Pro $49",
    price: 49,
    signalId: null as string | null,
  },
  {
    at: FIXTURE_AT,
    label: "Pro cut to $39",
    price: 39,
    signalId: fixtureSignal.id,
  },
];

export const fixtureUsage = {
  xaiUsd: 0.42,
  firecrawlCredits: 12,
  exaUsd: 0.07,
  falUsd: 0,
  totalUsd: 0.49,
};

export const fixtureChatMessages = [
  {
    id: "fixture_chat_1",
    workspaceId: fixtureWorkspace.id,
    role: "assistant" as const,
    text: "AcmeFlow dropped Pro to $39. I prepared three responses.",
    blocks: fixtureLayout.slice(0, 2),
    status: "ready" as const,
    createdAt: FIXTURE_AT,
  },
];
