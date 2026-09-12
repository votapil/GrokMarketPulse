import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const createArtifactRun = internalMutation({
  args: {
    signalId: v.id("signals"),
    recommendationId: v.string(),
  },
  returns: v.object({ artifactId: v.id("artifacts"), runId: v.id("runs") }),
  handler: async (ctx, { signalId, recommendationId }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      throw new Error("Signal not found");
    }

    const recommendation = signal.recommendations.find((rec) => rec.id === recommendationId);
    const artifactType = recommendation?.artifactType ?? "offer";

    const artifactId = await ctx.db.insert("artifacts", {
      workspaceId: signal.workspaceId,
      signalId,
      recommendationId,
      type: artifactType,
      status: "pending",
      payload: { type: "empty" },
      heroImageUrl: null,
      error: null,
    });

    const now = Date.now();
    const runId = await ctx.db.insert("runs", {
      workspaceId: signal.workspaceId,
      competitorId: signal.competitorId,
      kind: "artifact",
      status: "running",
      startedAt: now,
      finishedAt: null,
      signalId,
      steps: [
        {
          key: "artifact",
          label: "Generate artifact",
          status: "running",
          detail: recommendationId,
        },
      ],
      error: null,
    });

    return { artifactId, runId };
  },
});

export const generate = action({
  args: {
    signalId: v.id("signals"),
    recommendationId: v.string(),
  },
  returns: v.object({ artifactId: v.id("artifacts") }),
  handler: async (ctx, args): Promise<{ artifactId: Id<"artifacts"> }> => {
    const result = await ctx.runMutation(internal.act.createArtifactRun, args);
    return { artifactId: result.artifactId };
  },
});
