import type { Infer } from "convex/values";
import { vAssessment, vCompanyContext, vPlan } from "./schema";

export const SLACK_TITLE = "AcmeFlow added Slack integration";
export const SLACK_DETECTED_AT = 1_724_000_000_000;

export const companyContext: Infer<typeof vCompanyContext> = {
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
};

export const fixtureBaselinePlans: Infer<typeof vPlan>[] = [
  {
    name: "Starter",
    usd: 19,
    period: "month",
    limits: "2 seats",
    features: ["Email inbox", "Basic macros"],
  },
  {
    name: "Pro",
    usd: 49,
    period: "month",
    limits: "5 seats",
    features: ["AI inbox", "Email + chat"],
  },
  {
    name: "Business",
    usd: 99,
    period: "month",
    limits: "Unlimited seats",
    features: ["SSO", "SLA", "Audit log"],
  },
];

export const fixtureBaseline = {
  hash: "fixture_v1_pro_49",
  markdown:
    "# AcmeFlow Pricing (demo fixture)\n\n## Starter\n$19 / month\n\n## Pro\n$49 / month\n\n- AI inbox\n- 5 seats\n- Email + chat\n\n## Business\n$99 / month",
  plans: fixtureBaselinePlans,
  features: ["AI inbox", "Email + chat", "SSO"],
  headline: "AcmeFlow Pricing (demo fixture)",
};

export const slackAssessment: Infer<typeof vAssessment> = {
  why: "Slack alerts are table stakes; we already ship them. Logged as resolved history.",
  positionChange: "No material shift versus Helpdesk AI Pro.",
  affectedAreas: ["integrations"],
  affectedSegments: ["SMB"],
  reactionSpeed: "none — already matched",
  scoreExplanation: "Low-score feature add, kept so the feed is not empty before a live scan.",
};

export function slackEvidence(sourceUrl: string) {
  return [
    {
      kind: "current_snapshot" as const,
      provider: "internal" as const,
      url: sourceUrl,
      title: "Pricing page (baseline)",
      fragment: "Integrations: Slack (new)",
      confidence: 0.88,
      observedAt: SLACK_DETECTED_AT,
    },
    {
      kind: "exa_source" as const,
      provider: "exa" as const,
      url: "https://changelog.example/acmeflow-slack",
      title: "AcmeFlow changelog: Slack",
      fragment: "Native Slack alerts for SLA breaches.",
      confidence: 0.7,
      observedAt: SLACK_DETECTED_AT,
    },
  ];
}
