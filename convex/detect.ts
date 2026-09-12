/**
 * Detect: structural plan/price diff → optional Grok noise filter on leftover text → signals.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
  truncateMarkdown,
} from "./grok";
import {
  comparePlans,
  computeTextLeftover,
  isTrivialLeftover,
  type StructuralChange,
} from "./diff";

const NOISE_FILTER_INSTRUCTIONS = `You are a competitive intelligence filter.
Given a text leftover diff from a competitor page (after structured plan/price changes were already extracted), decide which changes are business-meaningful.

DISCARD as noise: HTML/DOM artifacts, navigation/menus, timestamps, view counters, cookie banners, whitespace-only edits, reordered identical menu items, tracking IDs, footers.

KEEP only material changes: new/removed features, packaging, positioning claims, limits, product copy that affects buying decisions.

Return ONLY JSON matching the schema. If nothing material remains, return {"changes":[]}.`;

const NOISE_FILTER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["changes"],
  properties: {
    changes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "type",
          "title",
          "summary",
          "previousState",
          "currentState",
          "fragment",
        ],
        properties: {
          type: { type: "string" },
          title: { type: "string" },
          summary: { type: "string" },
          previousState: { type: "string" },
          currentState: { type: "string" },
          fragment: { type: "string" },
        },
      },
    },
  },
} as const;

type GrokChange = {
  type: string;
  title: string;
  summary: string;
  previousState: string;
  currentState: string;
  fragment: string;
};

type CandidateChange = GrokChange;

type CompareContext = {
  source: Doc<"sources">;
  previous: Doc<"snapshots">;
  current: Doc<"snapshots">;
};

type PersistResult = {
  signalId: Id<"signals"> | null;
  deduped: boolean;
};

function isGrokChanges(value: unknown): value is { changes: GrokChange[] } {
  if (!value || typeof value !== "object") return false;
  const o = value as { changes?: unknown };
  if (!Array.isArray(o.changes)) return false;
  return o.changes.every((row) => {
    if (!row || typeof row !== "object") return false;
    const c = row as Record<string, unknown>;
    return (
      typeof c.type === "string" &&
      typeof c.title === "string" &&
      typeof c.summary === "string" &&
      typeof c.previousState === "string" &&
      typeof c.currentState === "string" &&
      typeof c.fragment === "string"
    );
  });
}

function structuralToCandidate(change: StructuralChange): CandidateChange {
  return {
    type: change.type,
    title: change.title,
    summary: change.summary,
    previousState: change.previousState,
    currentState: change.currentState,
    fragment: change.fragment,
  };
}

/** T-02 stub retained for scan orchestration callers. */
export const run = internalMutation({
  args: { workspaceId: v.id("workspaces"), sourceId: v.id("sources") },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});

export const loadCompareContext = internalQuery({
  args: {
    sourceId: v.optional(v.id("sources")),
    competitorId: v.optional(v.id("competitors")),
  },
  returns: v.union(
    v.object({
      skippedReason: v.string(),
      source: v.null(),
      previous: v.null(),
      current: v.null(),
    }),
    v.object({
      skippedReason: v.null(),
      source: schema.doc("sources"),
      previous: schema.doc("snapshots"),
      current: schema.doc("snapshots"),
    }),
  ),
  handler: async (ctx, args) => {
    let sourceId = args.sourceId ?? null;

    if (!sourceId && args.competitorId) {
      const sources = await ctx.db
        .query("sources")
        .withIndex("by_competitor", (q) => q.eq("competitorId", args.competitorId!))
        .collect();
      const pricing = sources.find((s) => s.kind === "pricing");
      sourceId = (pricing ?? sources[0])?._id ?? null;
    }

    if (!sourceId) {
      return {
        skippedReason: "source_not_found",
        source: null,
        previous: null,
        current: null,
      };
    }

    const source = await ctx.db.get("sources", sourceId);
    if (!source) {
      return {
        skippedReason: "source_not_found",
        source: null,
        previous: null,
        current: null,
      };
    }

    const latest = await ctx.db
      .query("snapshots")
      .withIndex("by_source_and_time", (q) => q.eq("sourceId", sourceId))
      .order("desc")
      .take(2);

    if (latest.length === 0) {
      return {
        skippedReason: "no_snapshots",
        source: null,
        previous: null,
        current: null,
      };
    }

    if (latest.length === 1) {
      // Baseline alone (or any single snapshot) must not create a signal (ТЗ §10).
      return {
        skippedReason: "baseline_only",
        source: null,
        previous: null,
        current: null,
      };
    }

    const current = latest[0]!;
    const previous = latest[1]!;

    if (current.isBaseline) {
      return {
        skippedReason: "baseline_only",
        source: null,
        previous: null,
        current: null,
      };
    }

    return {
      skippedReason: null,
      source,
      previous,
      current,
    };
  },
});

/**
 * Public compare entry: load two latest snapshots for a source (or competitor's pricing source),
 * structural plan/price diff first, Grok only on leftover text, persist signals + evidence.
 *
 * Signature:
 *   detect:compare
 *   args: { sourceId?: Id<"sources"> } | { competitorId?: Id<"competitors"> }
 *         (provide exactly one)
 *   returns: {
 *     created, signalIds, structuralFound, grokFound, deduped, skippedReason
 *   }
 */
export const compare = action({
  args: {
    sourceId: v.optional(v.id("sources")),
    competitorId: v.optional(v.id("competitors")),
  },
  returns: v.object({
    created: v.number(),
    signalIds: v.array(v.id("signals")),
    structuralFound: v.number(),
    grokFound: v.number(),
    deduped: v.number(),
    skippedReason: v.union(v.null(), v.string()),
  }),
  handler: async (ctx, args) => {
    if (!args.sourceId && !args.competitorId) {
      throw new Error("Provide sourceId or competitorId");
    }
    if (args.sourceId && args.competitorId) {
      throw new Error("Provide sourceId or competitorId, not both");
    }

    const loaded: {
      skippedReason: string | null;
      source: Doc<"sources"> | null;
      previous: Doc<"snapshots"> | null;
      current: Doc<"snapshots"> | null;
    } = await ctx.runQuery(internal.detect.loadCompareContext, {
      sourceId: args.sourceId,
      competitorId: args.competitorId,
    });

    if (loaded.skippedReason || !loaded.source || !loaded.previous || !loaded.current) {
      return {
        created: 0,
        signalIds: [] as Id<"signals">[],
        structuralFound: 0,
        grokFound: 0,
        deduped: 0,
        skippedReason: loaded.skippedReason ?? "insufficient_snapshots",
      };
    }

    const context: CompareContext = {
      source: loaded.source,
      previous: loaded.previous,
      current: loaded.current,
    };

    const structural = comparePlans(context.previous.plans, context.current.plans);
    const candidates: CandidateChange[] = structural.map(structuralToCandidate);
    const hasStructuralPrice = structural.some((c) => c.type === "price_change");

    const leftover = computeTextLeftover(
      context.previous.markdown,
      context.current.markdown,
      structural,
    );

    // Feature lines already present on plan objects are covered by structural context;
    // do not send them to Grok (avoids free-form currentState that breaks dedupe).
    const knownFeatures = new Set(
      [...context.previous.plans, ...context.current.plans].flatMap((p) =>
        p.features.map((f) => f.trim().toLowerCase()),
      ),
    );
    const leftoverLines = leftover
      .split("\n")
      .map((line) => line.replace(/^[-+\s]+/, "").trim())
      .filter(Boolean);
    const leftoverBeyondFeatures = leftoverLines.filter(
      (line) => !knownFeatures.has(line.toLowerCase()),
    );
    const shouldAskGrok =
      !isTrivialLeftover(leftover) && leftoverBeyondFeatures.length > 0;

    let grokFound = 0;
    if (shouldAskGrok) {
      const truncated = truncateMarkdown(leftover, 12_000);
      try {
        const result = await callGrok({
          model: GROK_DEFAULT_MODEL,
          instructions: NOISE_FILTER_INSTRUCTIONS,
          input: `Source URL: ${context.source.url}\n\nLeftover text diff (after structural plan/price extraction):\n${truncated}`,
          schema: {
            name: "noise_filter_changes",
            schema: NOISE_FILTER_SCHEMA as unknown as Record<string, unknown>,
            strict: true,
          },
          maxOutputTokens: 800,
          reasoningEffort: "low",
        });

        await ctx.runMutation(internal.costs.log, {
          workspaceId: context.source.workspaceId,
          provider: "xai",
          op: "detect.noise_filter",
          costUsd: ticksToUsd(result.costUsdTicks),
          credits: 0,
        });

        const parsed = parseJsonWithRetry(result.text, isGrokChanges);
        if (!parsed.ok) {
          console.error(
            "detect.compare Grok noise filter JSON invalid:",
            parsed.error,
          );
        }
        if (parsed.ok) {
          const structuralTypes = new Set(["price_change", "new_plan", "plan_removed"]);
          for (const change of parsed.value.changes) {
            const type = change.type.trim() || "copy_change";
            // Structural path owns plan/price — never double-emit via Grok.
            if (structuralTypes.has(type)) {
              continue;
            }
            if (
              hasStructuralPrice &&
              /price|pricing|\$\d+/i.test(`${type} ${change.title} ${change.summary} ${change.currentState}`)
            ) {
              continue;
            }
            const currentState = change.currentState.trim() || change.title.trim();
            if (!currentState) continue;
            candidates.push({
              type,
              title: change.title.trim() || type,
              summary: change.summary.trim() || change.title.trim(),
              previousState: change.previousState.trim() || "(none)",
              currentState,
              fragment: change.fragment.trim() || currentState,
            });
            grokFound += 1;
          }
        }
      } catch (err) {
        // Structural signals still persist; leftover filter failure must not swallow the run.
        console.error(
          "detect.compare Grok noise filter failed:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    const signalIds: Id<"signals">[] = [];
    let deduped = 0;

    for (const change of candidates) {
      const persisted: PersistResult = await ctx.runMutation(
        internal.signals.insertDetected,
        {
          workspaceId: context.source.workspaceId,
          competitorId: context.source.competitorId,
          sourceId: context.source._id,
          type: change.type,
          title: change.title,
          summary: change.summary,
          previousState: change.previousState,
          currentState: change.currentState,
          previousSnapshotId: context.previous._id,
          currentSnapshotId: context.current._id,
          sourceUrl: context.source.url,
          diffFragment: change.fragment,
          previousFragment: change.previousState,
          currentFragment: change.currentState,
          previousObservedAt: context.previous.fetchedAt,
          currentObservedAt: context.current.fetchedAt,
        },
      );

      if (persisted.deduped) {
        deduped += 1;
        continue;
      }
      if (persisted.signalId) {
        signalIds.push(persisted.signalId);
      }
    }

    return {
      created: signalIds.length,
      signalIds,
      structuralFound: structural.length,
      grokFound,
      deduped,
      skippedReason: null,
    };
  },
});
