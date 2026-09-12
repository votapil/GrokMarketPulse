/**
 * T-20 Recommend: three concrete countermeasures for an assessed signal.
 * Public action recommend:run — owned file only.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { vRecommendation } from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
} from "./grok";
import { REASONING_SYSTEM_PROMPT } from "./prompts/reasoning";

type EffortRisk = "low" | "medium" | "high";
type ArtifactType = "battlecard" | "offer" | "landing";

export type Recommendation = {
  id: string;
  title: string;
  action: string;
  rationale: string;
  expectedImpact: string;
  effort: EffortRisk;
  risk: EffortRisk;
  priority: number;
  artifactType: ArtifactType;
};

type RecommendBundle = {
  workspaceId: Id<"workspaces">;
  signal: Doc<"signals">;
  competitor: Doc<"competitors">;
  company: Doc<"companies"> | null;
  evidence: Doc<"evidence">[];
};

const EFFORT_RISK = new Set<EffortRisk>(["low", "medium", "high"]);
const ARTIFACT_TYPES = new Set<ArtifactType>([
  "battlecard",
  "offer",
  "landing",
]);

/** Prompt lives here — reasoning.ts has no recommend template yet (owned-file constraint). */
export const RECOMMEND_INSTRUCTIONS = `${REASONING_SYSTEM_PROMPT}

Propose exactly THREE countermeasures for the competitive signal.
Return ONLY JSON matching the schema.

Strategies (distinct — one each, in this order):
1. Hold/defend list price — no permanent across-the-board cut; equip sales to win on value (artifactType: "battlecard").
2. Time-boxed migration / competitive offer with a concrete dollar figure, seat cap, or window (artifactType: "offer").
3. Competitive counter-landing that argues against the competitor's new price or packaging (artifactType: "landing").

Hard rules:
- ids MUST be "rec_1", "rec_2", "rec_3" in order.
- priorities MUST be 1, 2, 3 uniquely (matching order).
- rec_3.artifactType MUST be "landing".
- Every field required: title, action, rationale, expectedImpact, effort, risk, priority, artifactType.
- Each recommendation names a concrete action WITH a number or explicit condition (price, seats, days, %).
- BANNED vague marketing fluff — invalid if you write things like: "Улучшить маркетинг", "improve marketing", "grow awareness", "synergy", "innovative solution", "leverage brand", "boost engagement".
- Anchor to OUR company context pricing (e.g. Pro $45) and the competitor change — not generic advice.
- Never invent HTML or UI markup.`;

export const RECOMMEND_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["recommendations"],
  properties: {
    recommendations: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "id",
          "title",
          "action",
          "rationale",
          "expectedImpact",
          "effort",
          "risk",
          "priority",
          "artifactType",
        ],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          action: { type: "string" },
          rationale: { type: "string" },
          expectedImpact: { type: "string" },
          effort: { type: "string", enum: ["low", "medium", "high"] },
          risk: { type: "string", enum: ["low", "medium", "high"] },
          priority: { type: "number" },
          artifactType: {
            type: "string",
            enum: ["battlecard", "offer", "landing"],
          },
        },
      },
    },
  },
} as const;

const VAGUE_FLUFF =
  /улучшить маркетинг|improve marketing|grow awareness|synergy|innovative solution|leverage brand|boost engagement/i;

function isEffortRisk(value: unknown): value is EffortRisk {
  return typeof value === "string" && EFFORT_RISK.has(value as EffortRisk);
}

function isArtifactType(value: unknown): value is ArtifactType {
  return (
    typeof value === "string" && ARTIFACT_TYPES.has(value as ArtifactType)
  );
}

function isRecommendationShape(value: unknown): value is Recommendation {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    o.title.trim().length > 0 &&
    typeof o.action === "string" &&
    o.action.trim().length > 0 &&
    typeof o.rationale === "string" &&
    o.rationale.trim().length > 0 &&
    typeof o.expectedImpact === "string" &&
    o.expectedImpact.trim().length > 0 &&
    isEffortRisk(o.effort) &&
    isEffortRisk(o.risk) &&
    typeof o.priority === "number" &&
    Number.isFinite(o.priority) &&
    isArtifactType(o.artifactType)
  );
}

function hasConcreteAnchor(text: string): boolean {
  return /\$|\d|%|seat|day|week|month|hour|cap|window|tier|plan/i.test(text);
}

function isVague(rec: Recommendation): boolean {
  const blob = `${rec.title} ${rec.action} ${rec.rationale} ${rec.expectedImpact}`;
  return VAGUE_FLUFF.test(blob);
}

function validateRecommendations(
  value: unknown,
): value is { recommendations: Recommendation[] } {
  if (!value || typeof value !== "object") return false;
  const rows = (value as { recommendations?: unknown }).recommendations;
  if (!Array.isArray(rows) || rows.length !== 3) return false;
  if (!rows.every(isRecommendationShape)) return false;

  const priorities = new Set(rows.map((r) => r.priority));
  if (priorities.size !== 3) return false;
  for (const p of priorities) {
    if (p !== 1 && p !== 2 && p !== 3) return false;
  }

  for (const rec of rows) {
    if (isVague(rec)) return false;
    if (!hasConcreteAnchor(`${rec.action} ${rec.expectedImpact}`)) return false;
  }

  return true;
}

/** Normalize ids / priorities / artifact types — immutable copies. */
function normalizeRecommendations(
  rows: Recommendation[],
): Recommendation[] {
  const byPriority = [...rows].sort((a, b) => a.priority - b.priority);
  // Force strategy → artifact mapping from the prompt (rec_3 must be landing).
  const forcedTypes: ArtifactType[] = ["battlecard", "offer", "landing"];

  return [0, 1, 2].map((i) => {
    const src = byPriority[i]!;
    return {
      id: `rec_${i + 1}`,
      title: src.title.trim(),
      action: src.action.trim(),
      rationale: src.rationale.trim(),
      expectedImpact: src.expectedImpact.trim(),
      effort: src.effort,
      risk: src.risk,
      priority: i + 1,
      artifactType: forcedTypes[i]!,
    };
  });
}

function buildPromptInput(bundle: RecommendBundle): string {
  const { signal, competitor, company, evidence } = bundle;
  const context = company?.context ?? null;
  const evidenceLines = evidence.map(
    (e) =>
      `- [${e.kind}] ${e.title} (${e.provider}): ${e.fragment.slice(0, 400)}`,
  );

  return [
    "Company context (JSON):",
    JSON.stringify(context, null, 2),
    "",
    `Competitor: ${competitor.name} (${competitor.url}) — ${competitor.kind}`,
    `Competitor summary: ${competitor.summary}`,
    "",
    `Signal type: ${signal.type}`,
    `Title: ${signal.title}`,
    `Summary: ${signal.summary}`,
    `Previous state: ${signal.previousState}`,
    `Current state: ${signal.currentState}`,
    `Kind: ${signal.kind}; severity: ${signal.severity}; score: ${signal.score}; confidence: ${signal.confidence}; urgency: ${signal.urgency}`,
    "",
    "Assessment (JSON):",
    JSON.stringify(signal.assessment, null, 2),
    "",
    "Evidence:",
    evidenceLines.length > 0 ? evidenceLines.join("\n") : "(none)",
  ].join("\n");
}

export const loadBundle = internalQuery({
  args: { signalId: v.id("signals") },
  returns: v.union(
    v.null(),
    v.object({
      workspaceId: v.id("workspaces"),
      signal: v.any(),
      competitor: v.any(),
      company: v.union(v.null(), v.any()),
      evidence: v.array(v.any()),
    }),
  ),
  handler: async (ctx, { signalId }): Promise<RecommendBundle | null> => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;

    const competitor = await ctx.db.get("competitors", signal.competitorId);
    if (!competitor) return null;

    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", signal.workspaceId))
      .first();

    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .collect();

    return {
      workspaceId: signal.workspaceId,
      signal,
      competitor,
      company: company ?? null,
      evidence,
    };
  },
});

export const saveRecommendations = internalMutation({
  args: {
    signalId: v.id("signals"),
    recommendations: v.array(vRecommendation),
  },
  returns: v.null(),
  handler: async (ctx, { signalId, recommendations }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      throw new Error("Signal not found");
    }

    // Immutable replace — new array, new status; never mutate signal.recommendations in place.
    await ctx.db.patch("signals", signalId, {
      recommendations: recommendations.map((r) => ({ ...r })),
      status: "recommendations_ready" as const,
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
      status: "error" as const,
      error,
    });
    return null;
  },
});

export const run = action({
  args: { signalId: v.id("signals") },
  returns: v.object({
    recommendations: v.array(vRecommendation),
  }),
  handler: async (
    ctx,
    { signalId },
  ): Promise<{ recommendations: Recommendation[] }> => {
    const bundle: RecommendBundle | null = await ctx.runQuery(
      internal.recommend.loadBundle,
      { signalId },
    );
    if (!bundle) {
      throw new Error("Signal or competitor not found");
    }

    const input = buildPromptInput(bundle);

    const ask = async () =>
      callGrok({
        model: GROK_DEFAULT_MODEL,
        instructions: RECOMMEND_INSTRUCTIONS,
        input,
        schema: {
          name: "recommendations",
          schema: RECOMMEND_JSON_SCHEMA as unknown as Record<string, unknown>,
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
        op: "recommend.run",
        costUsd: ticksToUsd(result.costUsdTicks),
        credits: 0,
      });

      let parsed = parseJsonWithRetry(result.text, validateRecommendations);
      if (!parsed.ok) {
        result = await ask();
        await ctx.runMutation(internal.costs.log, {
          workspaceId: bundle.workspaceId,
          provider: "xai",
          op: "recommend.run.retry",
          costUsd: ticksToUsd(result.costUsdTicks),
          credits: 0,
        });
        parsed = parseJsonWithRetry(result.text, validateRecommendations);
      }

      if (!parsed.ok) {
        const message = `Invalid recommendations JSON after retry: ${parsed.error}`;
        await ctx.runMutation(internal.recommend.markError, {
          signalId,
          error: message,
        });
        throw new Error(message);
      }

      const recommendations = normalizeRecommendations(
        parsed.value.recommendations,
      );

      // Final invariant check after normalize
      if (
        recommendations.length !== 3 ||
        recommendations[2]?.artifactType !== "landing" ||
        new Set(recommendations.map((r) => r.priority)).size !== 3
      ) {
        const message = "Normalized recommendations failed invariants";
        await ctx.runMutation(internal.recommend.markError, {
          signalId,
          error: message,
        });
        throw new Error(message);
      }

      await ctx.runMutation(internal.recommend.saveRecommendations, {
        signalId,
        recommendations,
      });

      return { recommendations };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Recommend failed";
      if (!message.startsWith("Invalid recommendations") && !message.startsWith("Normalized recommendations")) {
        await ctx.runMutation(internal.recommend.markError, {
          signalId,
          error: message,
        });
      }
      throw err instanceof Error ? err : new Error(message);
    }
  },
});
