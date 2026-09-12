import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { vSignalStatus } from "./schema";

/**
 * T-23 contract: `api.verify.again({ signalId })` → `{ runId }` immediately.
 * The Exa pipeline is scheduled; empty confirmation is a legal later outcome.
 */
export const startRun = internalMutation({
  args: { signalId: v.id("signals") },
  returns: v.object({
    runId: v.id("runs"),
    previousStatus: vSignalStatus,
  }),
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      throw new Error("Signal not found");
    }

    const previousStatus = signal.status;
    if (
      previousStatus === "detected" ||
      previousStatus === "verifying" ||
      previousStatus === "verified" ||
      previousStatus === "low_confidence"
    ) {
      await ctx.db.patch("signals", signalId, { status: "verifying" as const });
    }

    const runId = await ctx.db.insert("runs", {
      workspaceId: signal.workspaceId,
      competitorId: signal.competitorId,
      kind: "verify",
      status: "running",
      startedAt: Date.now(),
      finishedAt: null,
      signalId,
      steps: [
        { key: "query", label: "Build search query", status: "pending", detail: "" },
        { key: "exa", label: "Search external sources", status: "pending", detail: "" },
        { key: "confidence", label: "Recalculate confidence", status: "pending", detail: "" },
      ],
      error: null,
    });

    return { runId, previousStatus };
  },
});

export const again = action({
  args: { signalId: v.id("signals") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { signalId }): Promise<{ runId: Id<"runs"> }> => {
    const started = await ctx.runMutation(internal.verify.startRun, { signalId });
    await ctx.scheduler.runAfter(0, internal.exa.verify, {
      signalId,
      runId: started.runId,
      previousStatus: started.previousStatus,
    });
    return { runId: started.runId };
  },
});
