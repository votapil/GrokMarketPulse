/**
 * T-23 Verify: confirm a detected signal against the open web with Exa.
 *
 * `api.verify.again` returns `{ runId }` immediately. The scheduled job asks
 * Grok for a search query, runs one paid Exa `/search`, stores `exa_source`
 * evidence (deduped by URL), and moves the signal verifying → verified.
 * An empty result is a legal outcome, not an error.
 */

import { type Infer, v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { vSignalStatus } from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
} from "./grok";
import {
  buildQueryPromptInput,
  EXA_QUERY_INSTRUCTIONS,
  EXA_QUERY_JSON_SCHEMA,
  exaSearch,
  makeQueryValidator,
  NO_CONFIRMATION,
  normalizeEvidenceUrl,
  type QuerySubject,
  recalcConfidence,
  toEvidenceRows,
  verifyNote,
} from "./exa";

type ActionCtx = GenericActionCtx<DataModel>;
type SignalStatus = Doc<"signals">["status"];

const VERIFIABLE_STATUSES = new Set<SignalStatus>([
  "detected",
  "verifying",
  "verified",
  "low_confidence",
]);

const QUERY_MAX_OUTPUT_TOKENS = 400;

const vStepStatus = v.union(
  v.literal("pending"),
  v.literal("running"),
  v.literal("done"),
  v.literal("skipped"),
  v.literal("error"),
);

const vStance = v.union(
  v.literal("confirming"),
  v.literal("conflicting"),
  v.literal("related"),
);

const vSubject = v.object({
  workspaceId: v.id("workspaces"),
  competitorName: v.string(),
  competitorUrl: v.string(),
  signal: v.object({
    type: v.string(),
    title: v.string(),
    summary: v.string(),
    previousState: v.string(),
    currentState: v.string(),
  }),
});

type Subject = Infer<typeof vSubject>;

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
    if (VERIFIABLE_STATUSES.has(previousStatus)) {
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

export const loadSubject = internalQuery({
  args: { signalId: v.id("signals") },
  returns: v.union(v.null(), vSubject),
  handler: async (ctx, { signalId }): Promise<Subject | null> => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;
    const competitor = await ctx.db.get("competitors", signal.competitorId);
    if (!competitor) return null;
    return {
      workspaceId: signal.workspaceId,
      competitorName: competitor.name,
      competitorUrl: competitor.url,
      signal: {
        type: signal.type,
        title: signal.title,
        summary: signal.summary,
        previousState: signal.previousState,
        currentState: signal.currentState,
      },
    };
  },
});

export const updateRun = internalMutation({
  args: {
    runId: v.id("runs"),
    steps: v.array(
      v.object({ key: v.string(), status: vStepStatus, detail: v.string() }),
    ),
    runStatus: v.optional(
      v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    ),
    error: v.optional(v.union(v.null(), v.string())),
    failOpenSteps: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("runs", args.runId);
    if (!run) return null;

    const patches = new Map(args.steps.map((step) => [step.key, step]));
    const failure = args.failOpenSteps === true ? args.error ?? "Failed" : null;
    const isOpen = (status: string) => status === "pending" || status === "running";

    const steps = run.steps.map((step) => {
      const patch = patches.get(step.key);
      if (patch) return { ...step, status: patch.status, detail: patch.detail };
      if (failure !== null && isOpen(step.status)) {
        return { ...step, status: "error" as const, detail: failure };
      }
      return step;
    });

    const settled = args.runStatus === "done" || args.runStatus === "error";
    await ctx.db.patch("runs", args.runId, {
      steps,
      ...(args.runStatus === undefined ? {} : { status: args.runStatus }),
      ...(args.error === undefined ? {} : { error: args.error }),
      ...(settled ? { finishedAt: Date.now() } : {}),
    });
    return null;
  },
});

export const saveEvidence = internalMutation({
  args: {
    signalId: v.id("signals"),
    workspaceId: v.id("workspaces"),
    rows: v.array(
      v.object({
        url: v.string(),
        title: v.string(),
        fragment: v.string(),
        confidence: v.number(),
        stance: vStance,
      }),
    ),
  },
  returns: v.object({
    created: v.number(),
    duplicates: v.number(),
    confirming: v.number(),
    conflicting: v.number(),
  }),
  handler: async (ctx, { signalId, workspaceId, rows }) => {
    const existing = await ctx.db
      .query("evidence")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .collect();
    const seen = new Set(existing.map((row) => normalizeEvidenceUrl(row.url)));

    const observedAt = Date.now();
    let created = 0;
    let duplicates = 0;
    let confirming = 0;
    let conflicting = 0;

    for (const row of rows) {
      const key = normalizeEvidenceUrl(row.url);
      if (key.length === 0 || seen.has(key)) {
        duplicates += 1;
        continue;
      }
      seen.add(key);

      await ctx.db.insert("evidence", {
        workspaceId,
        signalId,
        kind: "exa_source" as const,
        provider: "exa" as const,
        url: row.url,
        title: row.title,
        fragment: row.fragment,
        confidence: row.confidence,
        observedAt,
      });

      created += 1;
      if (row.stance === "confirming") confirming += 1;
      if (row.stance === "conflicting") conflicting += 1;
    }

    return { created, duplicates, confirming, conflicting };
  },
});

export const applyVerification = internalMutation({
  args: {
    signalId: v.id("signals"),
    confirming: v.number(),
    conflicting: v.number(),
  },
  returns: v.object({ confidence: v.number(), status: vSignalStatus }),
  handler: async (ctx, { signalId, confirming, conflicting }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) {
      throw new Error(`Signal not found: ${signalId}`);
    }

    const confidence = recalcConfidence(signal.confidence, confirming, conflicting);
    const status: SignalStatus = VERIFIABLE_STATUSES.has(signal.status)
      ? "verified"
      : signal.status;

    await ctx.db.patch("signals", signalId, { confidence, status, error: null });
    return { confidence, status };
  },
});

export const failVerification = internalMutation({
  args: {
    signalId: v.id("signals"),
    previousStatus: vSignalStatus,
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { signalId, previousStatus, error }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;
    await ctx.db.patch("signals", signalId, { status: previousStatus, error });
    return null;
  },
});

async function buildQuery(ctx: ActionCtx, subject: Subject): Promise<string> {
  const validate = makeQueryValidator(subject.competitorName);
  const querySubject: QuerySubject = {
    competitorName: subject.competitorName,
    competitorUrl: subject.competitorUrl,
    signal: subject.signal,
  };

  const ask = async (op: string) => {
    const result = await callGrok({
      model: GROK_DEFAULT_MODEL,
      instructions: EXA_QUERY_INSTRUCTIONS,
      input: buildQueryPromptInput(querySubject),
      schema: {
        name: "exa_search_query",
        schema: EXA_QUERY_JSON_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
      maxOutputTokens: QUERY_MAX_OUTPUT_TOKENS,
      reasoningEffort: "low",
    });
    await ctx.runMutation(internal.costs.log, {
      workspaceId: subject.workspaceId,
      provider: "xai",
      op,
      costUsd: ticksToUsd(result.costUsdTicks),
      credits: 0,
    });
    return result;
  };

  let parsed = parseJsonWithRetry((await ask("verify.query")).text, validate);
  if (!parsed.ok) {
    parsed = parseJsonWithRetry((await ask("verify.query.retry")).text, validate);
  }
  if (!parsed.ok) {
    throw new Error(`Grok returned an unusable Exa query: ${parsed.error}`);
  }
  return parsed.value.query.trim();
}

type OpenStep = {
  key: string;
  status: "running" | "done" | "skipped";
  detail: string;
};

async function runVerification(
  ctx: ActionCtx,
  signalId: Id<"signals">,
  runId: Id<"runs">,
  subject: Subject,
): Promise<void> {
  const patch = (steps: OpenStep[], runStatus?: "done") =>
    ctx.runMutation(internal.verify.updateRun, {
      runId,
      steps,
      ...(runStatus === undefined ? {} : { runStatus, error: null }),
    });

  await patch([{ key: "query", status: "running", detail: "Grok is writing the query" }]);
  const query = await buildQuery(ctx, subject);
  await patch([
    { key: "query", status: "done", detail: query },
    { key: "exa", status: "running", detail: "Searching the open web" },
  ]);

  const outcome = await exaSearch(query);
  if (outcome.costUsd > 0) {
    await ctx.runMutation(internal.costs.log, {
      workspaceId: subject.workspaceId,
      provider: "exa",
      op: "verify.search",
      costUsd: outcome.costUsd,
      credits: 0,
    });
  }
  if (!outcome.ok) {
    throw new Error(`Exa: ${outcome.detail}`);
  }

  const saved = await ctx.runMutation(internal.verify.saveEvidence, {
    signalId,
    workspaceId: subject.workspaceId,
    rows: toEvidenceRows(
      outcome.hits,
      subject.signal.previousState,
      subject.signal.currentState,
    ),
  });

  const found = outcome.hits.length;
  const note = verifyNote(found, saved.created, saved.conflicting);
  await patch([
    {
      key: "exa",
      status: found === 0 ? "skipped" : "done",
      detail: found === 0 ? NO_CONFIRMATION : `${found} result${found === 1 ? "" : "s"}`,
    },
    { key: "confidence", status: "running", detail: "Scoring external evidence" },
  ]);

  const applied = await ctx.runMutation(internal.verify.applyVerification, {
    signalId,
    confirming: saved.confirming,
    conflicting: saved.conflicting,
  });

  await patch(
    [{ key: "confidence", status: "done", detail: `${note} · confidence ${applied.confidence}` }],
    "done",
  );
}

export const execute = internalAction({
  args: {
    signalId: v.id("signals"),
    runId: v.id("runs"),
    previousStatus: vSignalStatus,
  },
  returns: v.null(),
  handler: async (ctx, { signalId, runId, previousStatus }) => {
    const subject = await ctx.runQuery(internal.verify.loadSubject, { signalId });
    if (!subject) {
      await ctx.runMutation(internal.verify.updateRun, {
        runId,
        steps: [],
        runStatus: "error",
        error: "Signal or competitor missing",
        failOpenSteps: true,
      });
      return null;
    }

    try {
      await runVerification(ctx, signalId, runId, subject);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Verify failed";
      await ctx.runMutation(internal.verify.updateRun, {
        runId,
        steps: [],
        runStatus: "error",
        error: message,
        failOpenSteps: true,
      });
      await ctx.runMutation(internal.verify.failVerification, {
        signalId,
        previousStatus,
        error: message,
      });
    }
    return null;
  },
});

export const again = action({
  args: { signalId: v.id("signals") },
  returns: v.object({ runId: v.id("runs") }),
  handler: async (ctx, { signalId }): Promise<{ runId: Id<"runs"> }> => {
    const started = await ctx.runMutation(internal.verify.startRun, { signalId });
    await ctx.scheduler.runAfter(0, internal.verify.execute, {
      signalId,
      runId: started.runId,
      previousStatus: started.previousStatus,
    });
    return { runId: started.runId };
  },
});
