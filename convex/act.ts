/**
 * T-21 Act: the last step of Monitor → Detect → Assess → Recommend → Act.
 *
 * `act.generate` returns an artifactId immediately with `status: "pending"` so
 * the UI can navigate to /artifact/:id and wait there; the artifact itself is
 * filled in by a scheduled job. Generation rules live in prompts/artifacts.ts.
 */

import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";
import { callGrok, GROK_ARTIFACT_MODEL, ticksToUsd } from "./grok";
import type { ArtifactType } from "./prompts/artifacts";
import {
  buildArtifactInput,
  rulesFor,
  toPayload,
} from "./prompts/artifacts";

export type ArtifactBundle = {
  workspaceId: Id<"workspaces">;
  company: Doc<"companies"> | null;
  competitor: Doc<"competitors">;
  signal: Doc<"signals">;
  evidence: Doc<"evidence">[];
  recommendation: Doc<"signals">["recommendations"][number];
};

const vArtifactType = v.union(
  v.literal("battlecard"),
  v.literal("offer"),
  v.literal("landing"),
);

/**
 * Idempotent: one artifact per (signal, recommendation). A second Generate on
 * the same recommendation resets the existing row instead of adding a copy —
 * the UI navigates by artifactId, so a new id per click would strand the old
 * page and leave orphan rows behind.
 */
export const createArtifactRun = internalMutation({
  args: {
    signalId: v.id("signals"),
    recommendationId: v.string(),
  },
  returns: v.object({
    artifactId: v.id("artifacts"),
    runId: v.id("runs"),
    type: vArtifactType,
  }),
  handler: async (ctx, { signalId, recommendationId }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      throw new Error("Signal not found");
    }

    const recommendation = signal.recommendations.find(
      (rec) => rec.id === recommendationId,
    );
    if (!recommendation) {
      throw new Error(
        `Recommendation ${recommendationId} is not on signal ${signalId}`,
      );
    }
    const type: ArtifactType = recommendation.artifactType;

    const existing = await ctx.db
      .query("artifacts")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .collect();
    const previous = existing.find(
      (row) => row.recommendationId === recommendationId,
    );

    const blank = {
      type,
      status: "pending" as const,
      payload: { type: "empty" as const },
      heroImageUrl: null,
      error: null,
    };

    let artifactId: Id<"artifacts">;
    if (previous) {
      await ctx.db.patch("artifacts", previous._id, blank);
      artifactId = previous._id;
    } else {
      artifactId = await ctx.db.insert("artifacts", {
        workspaceId: signal.workspaceId,
        signalId,
        recommendationId,
        ...blank,
      });
    }

    // The user committed to a countermeasure the moment they hit Generate.
    await ctx.db.patch("signals", signalId, {
      selectedRecommendationId: recommendationId,
      status: "action_selected" as const,
    });

    const runId = await ctx.db.insert("runs", {
      workspaceId: signal.workspaceId,
      competitorId: signal.competitorId,
      kind: "artifact",
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
      signalId,
      steps: [
        {
          key: "artifact",
          label: `Generate ${type}`,
          status: "running",
          detail: recommendation.title,
        },
      ],
      error: null,
    });

    return { artifactId, runId, type };
  },
});

export const loadBundle = internalQuery({
  args: {
    signalId: v.id("signals"),
    recommendationId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      workspaceId: v.id("workspaces"),
      company: v.union(v.null(), v.any()),
      competitor: v.any(),
      signal: v.any(),
      evidence: v.array(v.any()),
      recommendation: v.any(),
    }),
  ),
  handler: async (
    ctx,
    { signalId, recommendationId },
  ): Promise<ArtifactBundle | null> => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;

    const recommendation = signal.recommendations.find(
      (rec) => rec.id === recommendationId,
    );
    if (!recommendation) return null;

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
      company: company ?? null,
      competitor,
      signal,
      evidence,
      recommendation,
    };
  },
});

export const saveArtifact = internalMutation({
  args: {
    artifactId: v.id("artifacts"),
    runId: v.id("runs"),
    payload: schema.doc("artifacts").fields.payload,
  },
  returns: v.null(),
  handler: async (ctx, { artifactId, runId, payload }) => {
    const artifact = await ctx.db.get("artifacts", artifactId);
    if (!artifact) {
      throw new Error("Artifact not found");
    }

    await ctx.db.patch("artifacts", artifactId, {
      status: "ready" as const,
      payload,
      error: null,
    });

    await ctx.db.patch("signals", artifact.signalId, {
      status: "artifact_generated" as const,
      error: null,
    });

    await finishRun(ctx, runId, "done", "Artifact ready", null);
    return null;
  },
});

export const markError = internalMutation({
  args: {
    artifactId: v.id("artifacts"),
    runId: v.id("runs"),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { artifactId, runId, error }) => {
    await ctx.db.patch("artifacts", artifactId, {
      status: "error" as const,
      payload: { type: "empty" as const },
      error,
    });

    await finishRun(ctx, runId, "error", error, error);
    return null;
  },
});

/**
 * Closes the run row. Without this every Generate leaves a permanently
 * "running" row, and the Pulse progress strip reads `runs`.
 */
async function finishRun(
  ctx: MutationCtx,
  runId: Id<"runs">,
  status: "done" | "error",
  detail: string,
  error: string | null,
): Promise<void> {
  const run = await ctx.db.get("runs", runId);
  if (!run) return;

  const steps = run.steps.map((step) =>
    step.key === "artifact" ? { ...step, status, detail } : step,
  );

  await ctx.db.patch("runs", runId, {
    status,
    finishedAt: Date.now(),
    steps,
    error,
  });
}

/**
 * Runs off the scheduler so `generate` can hand the UI an artifactId in one
 * round trip. Every exit path either saves a payload or records an error —
 * an artifact must never be left pending.
 */
export const run = internalAction({
  args: {
    artifactId: v.id("artifacts"),
    runId: v.id("runs"),
    signalId: v.id("signals"),
    recommendationId: v.string(),
    type: vArtifactType,
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const { artifactId, runId, signalId, recommendationId, type } = args;

    const fail = async (message: string): Promise<null> => {
      await ctx.runMutation(internal.act.markError, {
        artifactId,
        runId,
        error: message,
      });
      return null;
    };

    try {
      const bundle: ArtifactBundle | null = await ctx.runQuery(
        internal.act.loadBundle,
        { signalId, recommendationId },
      );
      if (!bundle) {
        return await fail("Signal, competitor or recommendation not found");
      }

      const rules = rulesFor(type);
      const input = buildArtifactInput(bundle);

      const ask = async (op: string) => {
        const result = await callGrok({
          model: GROK_ARTIFACT_MODEL,
          instructions: rules.instructions,
          input,
          schema: {
            name: rules.schemaName,
            schema: rules.schema,
            strict: true,
          },
          maxOutputTokens: rules.maxOutputTokens,
          reasoningEffort: "low",
        });
        await ctx.runMutation(internal.costs.log, {
          workspaceId: bundle.workspaceId,
          provider: "xai",
          op,
          costUsd: ticksToUsd(result.costUsdTicks),
          credits: 0,
        });
        return result.text;
      };

      const accept = (text: string): unknown | null => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          return null;
        }
        return rules.validate(parsed) ? parsed : null;
      };

      // One retry: the schema is strict, so a rejection is usually banned
      // fluff or a missing number rather than malformed JSON.
      let value = accept(await ask("act.generate"));
      if (value === null) {
        value = accept(await ask("act.generate.retry"));
      }
      if (value === null) {
        return await fail(
          `Grok returned an invalid ${type} after one retry — missing required fields, banned phrasing, or no concrete number to argue with.`,
        );
      }

      await ctx.runMutation(internal.act.saveArtifact, {
        artifactId,
        runId,
        payload: toPayload(type, value),
      });
      return null;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Artifact generation failed";
      return await fail(message);
    }
  },
});

export const generate = action({
  args: {
    signalId: v.id("signals"),
    recommendationId: v.string(),
  },
  returns: v.object({ artifactId: v.id("artifacts") }),
  handler: async (ctx, args): Promise<{ artifactId: Id<"artifacts"> }> => {
    const created: {
      artifactId: Id<"artifacts">;
      runId: Id<"runs">;
      type: ArtifactType;
    } = await ctx.runMutation(internal.act.createArtifactRun, args);

    await ctx.scheduler.runAfter(0, internal.act.run, {
      artifactId: created.artifactId,
      runId: created.runId,
      signalId: args.signalId,
      recommendationId: args.recommendationId,
      type: created.type,
    });

    return { artifactId: created.artifactId };
  },
});
