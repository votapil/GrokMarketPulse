/**
 * T-16: scan orchestrator.
 * Public `scan.run` creates the `runs` record and returns `runId` immediately;
 * the pipeline itself runs in a scheduled internal action and reports progress
 * through `runs.steps` (firecrawl → diff → grok_filter → signal).
 *
 * Callers: PulseScreen Run Scan button (T-15) reads progress via api.runs.latest.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { api, internal } from "./_generated/api";

/** A run still marked `running` after this window is treated as abandoned. */
const ACTIVE_RUN_TTL_MS = 3 * 60_000;
/** How many recent runs to scan when looking for an in-flight one. */
const ACTIVE_RUN_LOOKBACK = 25;
/** Upper bound on Grok assessments scheduled by a single scan. */
const MAX_ASSESS_PER_RUN = 5;
/**
 * One scrape can surface several changes at once (new plans, feature edits).
 * The price change is the one the product is about, so it becomes the run's
 * headline signal and the one PulseScreen selects.
 */
const HEADLINE_TYPE_PRIORITY = ["price_change", "new_plan", "packaging"] as const;

const STEP_BLUEPRINT = [
  { key: "firecrawl", label: "Scrape pricing" },
  { key: "diff", label: "Diff snapshots" },
  { key: "grok_filter", label: "Filter noise" },
  { key: "signal", label: "Persist signal" },
] as const;

const vStepStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("done"),
  v.literal("skipped"),
  v.literal("error"),
);

const vRunStatus = v.union(v.literal("running"), v.literal("done"), v.literal("error"));

type StepStatus = "pending" | "running" | "done" | "skipped" | "error";
type StepPatch = { key: string; status: StepStatus; detail: string };

type CreateRunResult = {
  runId: Id<"runs">;
  reused: boolean;
  blocked: boolean;
  sourceId: Id<"sources"> | null;
};

export const createRun = internalMutation({
  args: { competitorId: v.id("competitors") },
  returns: v.object({
    runId: v.id("runs"),
    reused: v.boolean(),
    blocked: v.boolean(),
    sourceId: v.union(v.null(), v.id("sources")),
  }),
  handler: async (ctx, { competitorId }): Promise<CreateRunResult> => {
    const competitor = await ctx.db.get("competitors", competitorId);
    if (!competitor) {
      throw new Error("Competitor not found");
    }

    const now = Date.now();

    const budget: {
      ok: boolean;
      reason: string | null;
    } = await ctx.runQuery(api.budget.check, {
      workspaceId: competitor.workspaceId,
      now,
    });
    if (!budget.ok) {
      const runId = await ctx.db.insert("runs", {
        workspaceId: competitor.workspaceId,
        competitorId,
        kind: "scan",
        status: "error",
        startedAt: now,
        finishedAt: now,
        signalId: null,
        steps: [
          {
            key: "budget",
            label: "Budget guard",
            status: "error",
            detail: budget.reason ?? "Daily sponsor cap reached",
          },
        ],
        error: budget.reason ?? "Daily sponsor cap reached",
      });
      return { runId, reused: false, blocked: true, sourceId: null };
    }

    // Guard: a second Run Scan while one is in flight joins the existing run
    // instead of producing a duplicate signal.
    const recent = await ctx.db
      .query("runs")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", competitor.workspaceId))
      .order("desc")
      .take(ACTIVE_RUN_LOOKBACK);

    const active = recent.find(
      (run) =>
        run.kind === "scan" &&
        run.status === "running" &&
        run.competitorId === competitorId &&
        now - run.startedAt < ACTIVE_RUN_TTL_MS,
    );

    if (active) {
      return { runId: active._id, reused: true, blocked: false, sourceId: null };
    }

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
      .collect();
    const source = sources.find((item) => item.kind === "pricing") ?? sources[0] ?? null;

    const runId = await ctx.db.insert("runs", {
      workspaceId: competitor.workspaceId,
      competitorId,
      kind: "scan",
      status: "running",
      startedAt: now,
      finishedAt: null,
      signalId: null,
      steps: STEP_BLUEPRINT.map((step) => ({
        key: step.key,
        label: step.label,
        status: "pending" as const,
        detail: "",
      })),
      error: null,
    });

    return { runId, reused: false, blocked: false, sourceId: source?._id ?? null };
  },
});

export const signalTypes = internalQuery({
  args: { signalIds: v.array(v.id("signals")) },
  returns: v.array(v.object({ signalId: v.id("signals"), type: v.string() })),
  handler: async (ctx, { signalIds }) => {
    const rows = await Promise.all(signalIds.map((id) => ctx.db.get("signals", id)));
    return rows.flatMap((row) => (row ? [{ signalId: row._id, type: row.type }] : []));
  },
});

/**
 * One transaction per pipeline stage: patches any subset of steps and,
 * optionally, the run-level status. Keeps the orchestrator to one write per step.
 */
export const updateRun = internalMutation({
  args: {
    runId: v.id("runs"),
    steps: v.array(
      v.object({ key: v.string(), status: vStepStatus, detail: v.string() }),
    ),
    runStatus: v.optional(vRunStatus),
    error: v.optional(v.union(v.null(), v.string())),
    signalId: v.optional(v.union(v.null(), v.id("signals"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("runs", args.runId);
    if (!run) return null;

    const patches = new Map(args.steps.map((step) => [step.key, step]));
    const steps = run.steps.map((step) => {
      const patch = patches.get(step.key);
      return patch ? { ...step, status: patch.status, detail: patch.detail } : step;
    });

    const settled = args.runStatus === "done" || args.runStatus === "error";

    await ctx.db.patch("runs", args.runId, {
      steps,
      ...(args.runStatus === undefined ? {} : { status: args.runStatus }),
      ...(args.error === undefined ? {} : { error: args.error }),
      ...(args.signalId === undefined ? {} : { signalId: args.signalId }),
      ...(settled ? { finishedAt: Date.now() } : {}),
    });

    return null;
  },
});

export const execute = internalAction({
  args: {
    runId: v.id("runs"),
    competitorId: v.id("competitors"),
    sourceId: v.union(v.null(), v.id("sources")),
  },
  returns: v.null(),
  handler: async (ctx, { runId, competitorId, sourceId }) => {
    const fail = async (step: StepPatch, message: string) => {
      await ctx.runMutation(internal.scan.updateRun, {
        runId,
        steps: [step],
        runStatus: "error",
        error: message,
      });
    };

    try {
      if (!sourceId) {
        await fail(
          { key: "firecrawl", status: "error", detail: "No page to watch" },
          "Competitor has no source page configured",
        );
        return null;
      }

      await ctx.runMutation(internal.scan.updateRun, {
        runId,
        steps: [{ key: "firecrawl", status: "running", detail: "Fetching pricing page" }],
      });

      const scrape = await ctx.runAction(internal.firecrawl.scrape, {
        sourceId,
        isBaseline: false,
      });

      if (!scrape.ok) {
        await fail(
          { key: "firecrawl", status: "error", detail: scrape.detail },
          `Firecrawl: ${scrape.detail}`,
        );
        return null;
      }

      await ctx.runMutation(internal.scan.updateRun, {
        runId,
        steps: [
          {
            key: "firecrawl",
            status: "done",
            detail: scrape.reused ? "Unchanged page" : `HTTP ${scrape.httpStatus}`,
          },
          { key: "diff", status: "running", detail: "Comparing snapshots" },
        ],
      });

      // detect.compare covers both the structural diff and the Grok noise filter,
      // so one call settles the `diff` and `grok_filter` steps together.
      const compare = await ctx.runAction(api.detect.compare, { competitorId });

      if (compare.skippedReason) {
        await ctx.runMutation(internal.scan.updateRun, {
          runId,
          steps: [
            { key: "diff", status: "skipped", detail: compare.skippedReason },
            { key: "grok_filter", status: "skipped", detail: "Nothing to filter" },
            { key: "signal", status: "skipped", detail: "No change detected" },
          ],
          runStatus: "done",
          error: null,
        });
        return null;
      }

      await ctx.runMutation(internal.scan.updateRun, {
        runId,
        steps: [
          {
            key: "diff",
            status: "done",
            detail: `${compare.structuralFound} structural change${
              compare.structuralFound === 1 ? "" : "s"
            }`,
          },
          {
            key: "grok_filter",
            status: compare.grokFound > 0 ? "done" : "skipped",
            detail:
              compare.grokFound > 0
                ? `${compare.grokFound} material beyond pricing`
                : "No material leftover",
          },
          { key: "signal", status: "running", detail: "Writing signal" },
        ],
      });

      const created = await ctx.runQuery(internal.scan.signalTypes, {
        signalIds: compare.signalIds,
      });
      const headline =
        HEADLINE_TYPE_PRIORITY.map((type) =>
          created.find((item) => item.type === type),
        ).find((item) => item !== undefined) ?? created[0];
      const signalId = headline?.signalId ?? null;

      if (!signalId) {
        await ctx.runMutation(internal.scan.updateRun, {
          runId,
          steps: [
            {
              key: "signal",
              status: "skipped",
              detail:
                compare.deduped > 0 ? "Already reported" : "No material change",
            },
          ],
          runStatus: "done",
          error: null,
        });
        return null;
      }

      await ctx.runMutation(internal.scan.updateRun, {
        runId,
        steps: [
          {
            key: "signal",
            status: "done",
            detail: compare.created > 1 ? `${compare.created} signals` : "Signal created",
          },
        ],
        runStatus: "done",
        error: null,
        signalId,
      });

      // Assessment must not hold up the run: the signals are already on screen.
      // Headline first so the pane the user is looking at fills in soonest.
      const toAssess = [
        signalId,
        ...created
          .map((item) => item.signalId)
          .filter((id) => id !== signalId),
      ].slice(0, MAX_ASSESS_PER_RUN);

      for (const id of toAssess) {
        await ctx.scheduler.runAfter(0, internal.scan.assessSignal, { signalId: id });
      }

      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Scan failed";
      const run = await ctx.runQuery(internal.runs.byId, { runId });
      const pending = (run?.steps ?? [])
        .filter((step) => step.status === "running" || step.status === "pending")
        .map((step) => ({
          key: step.key,
          status: "error" as const,
          detail: message,
        }));

      await ctx.runMutation(internal.scan.updateRun, {
        runId,
        steps: pending,
        runStatus: "error",
        error: message,
      });
      return null;
    }
  },
});

/**
 * Assess runs detached from the scan so a Grok hiccup cannot fail the run
 * that already produced a visible signal.
 */
export const assessSignal = internalAction({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async (ctx, { signalId }) => {
    try {
      await ctx.runAction(api.assess.run, { signalId });
    } catch (error) {
      // assess.run already records the failure on the signal itself.
      console.error(
        `scan.assessSignal failed for ${signalId}:`,
        error instanceof Error ? error.message : error,
      );
    }
    return null;
  },
});

export const run = action({
  args: { competitorId: v.id("competitors") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { competitorId }): Promise<{ runId: Id<"runs"> }> => {
    const created: CreateRunResult = await ctx.runMutation(internal.scan.createRun, {
      competitorId,
    });

    if (!created.reused && !created.blocked) {
      await ctx.scheduler.runAfter(0, internal.scan.execute, {
        runId: created.runId,
        competitorId,
        sourceId: created.sourceId,
      });
    }

    return { runId: created.runId };
  },
});

export const listDemoScanTargets = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      workspaceId: v.id("workspaces"),
      competitorId: v.id("competitors"),
    }),
  ),
  handler: async (ctx) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();
    if (!workspace) return [];

    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .take(16);

    return competitors
      .filter((row) => row.origin === "seed" || row.origin === "manual")
      .map((row) => ({
        workspaceId: workspace._id,
        competitorId: row._id,
      }));
  },
});

/**
 * Cron target. Does not flip the mock site. One competitor at a time so a
 * budget stop mid-loop does not fan out more scrapes.
 */
export const scanAll = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const targets: Array<{
      workspaceId: Id<"workspaces">;
      competitorId: Id<"competitors">;
    }> = await ctx.runQuery(internal.scan.listDemoScanTargets, {});
    if (targets.length === 0) return null;

    for (const target of targets) {
      await ctx.runAction(api.scan.run, { competitorId: target.competitorId });
    }
    return null;
  },
});
