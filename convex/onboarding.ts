import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const createRun = internalMutation({
  args: {
    companyUrl: v.string(),
    competitorUrls: v.array(v.string()),
  },
  returns: v.object({ runId: v.id("runs"), workspaceId: v.id("workspaces") }),
  handler: async (ctx, { companyUrl, competitorUrls }) => {
    const demo = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();

    const workspaceId =
      demo?._id ??
      (await ctx.db.insert("workspaces", {
        name: "Onboarding workspace",
        slug: `onboard-${Date.now()}`,
      }));

    const now = Date.now();
    const runId = await ctx.db.insert("runs", {
      workspaceId,
      competitorId: null,
      kind: "onboarding",
      status: "running",
      startedAt: now,
      finishedAt: null,
      signalId: null,
      steps: [
        {
          key: "onboarding",
          label: "Analyze company",
          status: "running",
          detail: `${companyUrl} + ${competitorUrls.length} competitors`,
        },
      ],
      error: null,
    });

    return { runId, workspaceId };
  },
});

export const analyze = action({
  args: {
    companyUrl: v.string(),
    competitorUrls: v.array(v.string()),
  },
  returns: v.object({
    runId: v.id("runs"),
    workspaceId: v.id("workspaces"),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ runId: Id<"runs">; workspaceId: Id<"workspaces"> }> => {
    return await ctx.runMutation(internal.onboarding.createRun, args);
  },
});
