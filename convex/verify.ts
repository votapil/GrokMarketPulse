import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const createRun = internalMutation({
  args: { signalId: v.id("signals") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { signalId }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      throw new Error("Signal not found");
    }

    const now = Date.now();
    const runId = await ctx.db.insert("runs", {
      workspaceId: signal.workspaceId,
      competitorId: signal.competitorId,
      kind: "verify",
      status: "running",
      startedAt: now,
      finishedAt: null,
      signalId,
      steps: [
        { key: "exa", label: "External verify", status: "running", detail: "Queued" },
      ],
      error: null,
    });

    return { runId };
  },
});

export const again = action({
  args: { signalId: v.id("signals") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { signalId }): Promise<{ runId: Id<"runs"> }> => {
    return await ctx.runMutation(internal.verify.createRun, { signalId });
  },
});
