/**
 * Assess: threat scoring + explanation (T-18).
 * Public action `assess:run` — Grok scores a signal vs our Company Context.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { vAssessment, vCompanyContext, vLevel } from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
} from "./grok";
import { REASONING_SYSTEM_PROMPT } from "./prompts/reasoning";

const MAX_EVIDENCE = 8;
const MAX_PRIOR_SIGNALS = 5;
const MAX_FRAGMENT_CHARS = 400;

const ASSESS_INSTRUCTIONS = `Assess a competitive signal for OUR company.
Return ONLY JSON matching the schema.

Rules:
- Compare the competitor change against OUR plans and positioning from company context (e.g. our Pro at $45/mo) — never abstract market averages alone.
- kind: threat | opportunity | neutral
- severity and urgency: low | medium | high | critical
- score: integer 0–100; confidence: number 0–1
- assessment.scoreExplanation is REQUIRED and must explain the numeric score with concrete evidence (empty = invalid)
- assessment.why must be specific (price delta vs us, segment overlap, reaction window)
- Prefer short arrays (max 6). No HTML or UI markup.`;

const ASSESS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "severity", "score", "confidence", "urgency", "assessment"],
  properties: {
    kind: { type: "string", enum: ["threat", "opportunity", "neutral"] },
    severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
    score: { type: "number" },
    confidence: { type: "number" },
    urgency: { type: "string", enum: ["low", "medium", "high", "critical"] },
    assessment: {
      type: "object",
      additionalProperties: false,
      required: [
        "why",
        "positionChange",
        "affectedAreas",
        "affectedSegments",
        "reactionSpeed",
        "scoreExplanation",
      ],
      properties: {
        why: { type: "string" },
        positionChange: { type: "string" },
        affectedAreas: { type: "array", items: { type: "string" } },
        affectedSegments: { type: "array", items: { type: "string" } },
        reactionSpeed: { type: "string" },
        scoreExplanation: { type: "string" },
      },
    },
  },
} as const;

type Level = "low" | "medium" | "high" | "critical";
type Kind = "threat" | "opportunity" | "neutral";

type AssessmentBody = {
  why: string;
  positionChange: string;
  affectedAreas: string[];
  affectedSegments: string[];
  reactionSpeed: string;
  scoreExplanation: string;
};

type AssessResult = {
  kind: Kind;
  severity: Level;
  score: number;
  confidence: number;
  urgency: Level;
  assessment: AssessmentBody;
};

type PriorSignalSummary = {
  title: string;
  type: string;
  previousState: string;
  currentState: string;
  kind: Kind;
  score: number;
  status: string;
};

type EvidenceSummary = {
  kind: string;
  title: string;
  fragment: string;
  confidence: number;
  url: string;
};

type CompanyContext = {
  businessType: string;
  category: string;
  targetSegments: string[];
  pricingModel: string;
  keyProducts: string[];
  keyFeatures: string[];
  positioning: string;
  competitiveDimensions: string[];
  plans: Array<{
    name: string;
    usd: number | null;
    period: string;
    limits: string;
    features: string[];
  }>;
};

type AssessBundle = {
  signalId: Id<"signals">;
  workspaceId: Id<"workspaces">;
  signal: {
    type: string;
    title: string;
    summary: string;
    previousState: string;
    currentState: string;
    status: string;
  };
  competitor: { name: string; url: string; kind: string; summary: string };
  company: {
    name: string;
    url: string;
    context: CompanyContext | null;
  };
  evidence: EvidenceSummary[];
  priorSignals: PriorSignalSummary[];
};

const kindValidator = v.union(
  v.literal("threat"),
  v.literal("opportunity"),
  v.literal("neutral"),
);

const statusOutValidator = v.union(
  v.literal("assessed"),
  v.literal("low_confidence"),
);

function isLevel(value: unknown): value is Level {
  return value === "low" || value === "medium" || value === "high" || value === "critical";
}

function isKind(value: unknown): value is Kind {
  return value === "threat" || value === "opportunity" || value === "neutral";
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((x) => typeof x === "string");
}

function isAssessmentBody(value: unknown): value is AssessmentBody {
  if (!value || typeof value !== "object") return false;
  const a = value as Record<string, unknown>;
  return (
    typeof a.why === "string" &&
    a.why.trim().length > 0 &&
    typeof a.positionChange === "string" &&
    isStringArray(a.affectedAreas) &&
    isStringArray(a.affectedSegments) &&
    typeof a.reactionSpeed === "string" &&
    typeof a.scoreExplanation === "string" &&
    a.scoreExplanation.trim().length > 0
  );
}

function isAssessResult(value: unknown): value is AssessResult {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (!isKind(o.kind) || !isLevel(o.severity) || !isLevel(o.urgency)) return false;
  if (typeof o.score !== "number" || !Number.isFinite(o.score)) return false;
  if (o.score < 0 || o.score > 100) return false;
  if (typeof o.confidence !== "number" || !Number.isFinite(o.confidence)) return false;
  if (o.confidence < 0 || o.confidence > 1) return false;
  return isAssessmentBody(o.assessment);
}

function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n…[truncated]`;
}

function buildUserPrompt(bundle: AssessBundle): string {
  const ourPlans = bundle.company.context?.plans ?? [];
  const planAnchor =
    ourPlans.length > 0
      ? `Our list plans (compare against these):\n${JSON.stringify(ourPlans, null, 2)}`
      : "Our list plans are empty in stored context — for scoring, treat OUR Pro list price as $45/mo (demo default) and compare the competitor change against that.";

  return [
    "## Our company",
    `Name: ${bundle.company.name}`,
    `URL: ${bundle.company.url}`,
    `Company context (JSON):\n${JSON.stringify(bundle.company.context, null, 2)}`,
    planAnchor,
    "",
    "## Competitor",
    `Name: ${bundle.competitor.name}`,
    `URL: ${bundle.competitor.url}`,
    `Kind: ${bundle.competitor.kind}`,
    `Summary: ${bundle.competitor.summary}`,
    "",
    "## Signal",
    `Type: ${bundle.signal.type}`,
    `Title: ${bundle.signal.title}`,
    `Summary: ${bundle.signal.summary}`,
    `Previous state: ${bundle.signal.previousState}`,
    `Current state: ${bundle.signal.currentState}`,
    "",
    "## Evidence",
    JSON.stringify(bundle.evidence, null, 2),
    "",
    "## Prior related signals (same competitor)",
    JSON.stringify(bundle.priorSignals, null, 2),
  ].join("\n");
}

export const loadBundle = internalQuery({
  args: { signalId: v.id("signals") },
  returns: v.union(
    v.null(),
    v.object({
      signalId: v.id("signals"),
      workspaceId: v.id("workspaces"),
      signal: v.object({
        type: v.string(),
        title: v.string(),
        summary: v.string(),
        previousState: v.string(),
        currentState: v.string(),
        status: v.string(),
      }),
      competitor: v.object({
        name: v.string(),
        url: v.string(),
        kind: v.string(),
        summary: v.string(),
      }),
      company: v.object({
        name: v.string(),
        url: v.string(),
        context: v.union(v.null(), vCompanyContext),
      }),
      evidence: v.array(
        v.object({
          kind: v.string(),
          title: v.string(),
          fragment: v.string(),
          confidence: v.number(),
          url: v.string(),
        }),
      ),
      priorSignals: v.array(
        v.object({
          title: v.string(),
          type: v.string(),
          previousState: v.string(),
          currentState: v.string(),
          kind: kindValidator,
          score: v.number(),
          status: v.string(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { signalId }): Promise<AssessBundle | null> => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;

    const competitor = await ctx.db.get("competitors", signal.competitorId);
    if (!competitor) return null;

    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", signal.workspaceId))
      .first();
    if (!company) return null;

    const evidenceRows = await ctx.db
      .query("evidence")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .collect();

    const evidence: EvidenceSummary[] = evidenceRows.slice(0, MAX_EVIDENCE).map((row) => ({
      kind: row.kind,
      title: row.title,
      fragment: clip(row.fragment, MAX_FRAGMENT_CHARS),
      confidence: row.confidence,
      url: row.url,
    }));

    const siblingSignals = await ctx.db
      .query("signals")
      .withIndex("by_competitor", (q) => q.eq("competitorId", signal.competitorId))
      .collect();

    const priorSignals: PriorSignalSummary[] = [...siblingSignals]
      .filter((s) => s._id !== signalId)
      .sort((a, b) => b.detectedAt - a.detectedAt)
      .slice(0, MAX_PRIOR_SIGNALS)
      .map((s) => ({
        title: s.title,
        type: s.type,
        previousState: s.previousState,
        currentState: s.currentState,
        kind: s.kind,
        score: s.score,
        status: s.status,
      }));

    return {
      signalId,
      workspaceId: signal.workspaceId,
      signal: {
        type: signal.type,
        title: signal.title,
        summary: signal.summary,
        previousState: signal.previousState,
        currentState: signal.currentState,
        status: signal.status,
      },
      competitor: {
        name: competitor.name,
        url: competitor.url,
        kind: competitor.kind,
        summary: competitor.summary,
      },
      company: {
        name: company.name,
        url: company.url,
        context: company.context,
      },
      evidence,
      priorSignals,
    };
  },
});

export const applyAssessment = internalMutation({
  args: {
    signalId: v.id("signals"),
    kind: kindValidator,
    severity: vLevel,
    score: v.number(),
    confidence: v.number(),
    urgency: vLevel,
    assessment: vAssessment,
    status: statusOutValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const signal = await ctx.db.get("signals", args.signalId);
    if (!signal) {
      throw new Error(`Signal not found: ${args.signalId}`);
    }

    // Immutable patch: replace scalar fields + whole assessment object (no in-place mutate).
    const assessment: AssessmentBody = {
      why: args.assessment.why,
      positionChange: args.assessment.positionChange,
      affectedAreas: [...args.assessment.affectedAreas],
      affectedSegments: [...args.assessment.affectedSegments],
      reactionSpeed: args.assessment.reactionSpeed,
      scoreExplanation: args.assessment.scoreExplanation,
    };

    await ctx.db.patch("signals", args.signalId, {
      kind: args.kind,
      severity: args.severity,
      score: args.score,
      confidence: args.confidence,
      urgency: args.urgency,
      assessment,
      status: args.status,
      error: null,
    });
    return null;
  },
});

export const markError = internalMutation({
  args: {
    signalId: v.id("signals"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { signalId, error }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;
    await ctx.db.patch("signals", signalId, {
      status: "error",
      error,
    });
    return null;
  },
});

export const run = action({
  args: { signalId: v.id("signals") },
  returns: v.object({
    signalId: v.id("signals"),
    status: statusOutValidator,
    kind: kindValidator,
    severity: vLevel,
    score: v.number(),
    confidence: v.number(),
    urgency: vLevel,
    assessment: vAssessment,
  }),
  handler: async (
    ctx,
    { signalId },
  ): Promise<{
    signalId: Id<"signals">;
    status: "assessed" | "low_confidence";
    kind: Kind;
    severity: Level;
    score: number;
    confidence: number;
    urgency: Level;
    assessment: AssessmentBody;
  }> => {
    const bundle: AssessBundle | null = await ctx.runQuery(internal.assess.loadBundle, {
      signalId,
    });
    if (!bundle) {
      throw new Error(`Cannot assess: signal/company/competitor missing for ${signalId}`);
    }
    if (!bundle.company.context) {
      throw new Error("Company context is empty — run onboarding before assess");
    }

    const input = buildUserPrompt(bundle);

    const ask = async () =>
      callGrok({
        model: GROK_DEFAULT_MODEL,
        instructions: `${REASONING_SYSTEM_PROMPT}\n\n${ASSESS_INSTRUCTIONS}`,
        input,
        schema: {
          name: "signal_assessment",
          schema: ASSESS_JSON_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
        maxOutputTokens: 1600,
        reasoningEffort: "low",
      });

    try {
      let result = await ask();
      await ctx.runMutation(internal.costs.log, {
        workspaceId: bundle.workspaceId,
        provider: "xai",
        op: "assess",
        costUsd: ticksToUsd(result.costUsdTicks),
        credits: 0,
      });

      let parsed = parseJsonWithRetry(result.text, isAssessResult);
      if (!parsed.ok) {
        // score without scoreExplanation (or other schema miss) → one retry
        result = await ask();
        await ctx.runMutation(internal.costs.log, {
          workspaceId: bundle.workspaceId,
          provider: "xai",
          op: "assess.retry",
          costUsd: ticksToUsd(result.costUsdTicks),
          credits: 0,
        });
        parsed = parseJsonWithRetry(result.text, isAssessResult);
      }

      if (!parsed.ok) {
        const message = `Invalid assessment JSON after retry: ${parsed.error}`;
        await ctx.runMutation(internal.assess.markError, { signalId, error: message });
        throw new Error(message);
      }

      const value = parsed.value;
      const status = value.confidence < 0.5 ? "low_confidence" : "assessed";

      const assessment: AssessmentBody = {
        why: value.assessment.why,
        positionChange: value.assessment.positionChange,
        affectedAreas: [...value.assessment.affectedAreas],
        affectedSegments: [...value.assessment.affectedSegments],
        reactionSpeed: value.assessment.reactionSpeed,
        scoreExplanation: value.assessment.scoreExplanation,
      };

      await ctx.runMutation(internal.assess.applyAssessment, {
        signalId,
        kind: value.kind,
        severity: value.severity,
        score: value.score,
        confidence: value.confidence,
        urgency: value.urgency,
        assessment,
        status,
      });

      // Холст под сигнал собирает Grok — но только после оценки: состав блоков
      // зависит от assessment. Отдельным заданием, чтобы не удлинять этот вызов
      // и чтобы падение layout не откатывало уже записанную оценку.
      await ctx.scheduler.runAfter(0, internal.layout.build, { signalId });

      return {
        signalId,
        status,
        kind: value.kind,
        severity: value.severity,
        score: value.score,
        confidence: value.confidence,
        urgency: value.urgency,
        assessment,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Assess failed";
      if (!message.startsWith("Invalid assessment JSON")) {
        await ctx.runMutation(internal.assess.markError, { signalId, error: message });
      }
      throw err instanceof Error ? err : new Error(message);
    }
  },
});
