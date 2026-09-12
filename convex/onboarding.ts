import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, env, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { vCompanyContext } from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
  truncateMarkdown,
} from "./grok";
import {
  COMPANY_CONTEXT_INSTRUCTIONS,
  COMPANY_CONTEXT_JSON_SCHEMA,
} from "./prompts/reasoning";

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

type RunStep = {
  key: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  detail: string;
};

function isCompanyContext(value: unknown): value is CompanyContext {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  return (
    typeof o.businessType === "string" &&
    typeof o.category === "string" &&
    Array.isArray(o.targetSegments) &&
    typeof o.pricingModel === "string" &&
    Array.isArray(o.keyProducts) &&
    Array.isArray(o.keyFeatures) &&
    typeof o.positioning === "string" &&
    Array.isArray(o.competitiveDimensions) &&
    Array.isArray(o.plans)
  );
}

async function scrapeCompanyMarkdown(url: string): Promise<{
  markdown: string;
  httpStatus: number;
}> {
  const apiKey = (env as Record<string, string | undefined>).FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error(
      "FIRECRAWL_API_KEY is not set on the Convex deployment — add it via npx convex env set FIRECRAWL_API_KEY",
    );
  }

  const response = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["markdown"],
      onlyMainContent: true,
      maxAge: 86_400_000,
    }),
  });

  const rawText = await response.text();
  let raw: unknown;
  try {
    raw = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error(`Firecrawl returned non-JSON (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed: HTTP ${response.status}`);
  }

  const data =
    raw && typeof raw === "object" && "data" in raw
      ? (raw as { data?: { markdown?: string; metadata?: { statusCode?: number } } }).data
      : (raw as { markdown?: string; metadata?: { statusCode?: number } } | undefined);

  const markdown = typeof data?.markdown === "string" ? data.markdown : "";
  const httpStatus =
    typeof data?.metadata?.statusCode === "number" ? data.metadata.statusCode : response.status;

  if (!markdown.trim()) {
    throw new Error("Firecrawl returned empty markdown");
  }

  return { markdown, httpStatus };
}

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
          key: "firecrawl",
          label: "Scrape company page",
          status: "running",
          detail: companyUrl,
        },
        {
          key: "grok_context",
          label: "Extract Company Context",
          status: "pending",
          detail: `${competitorUrls.length} competitor URLs noted`,
        },
      ],
      error: null,
    });

    return { runId, workspaceId };
  },
});

export const patchRun = internalMutation({
  args: {
    runId: v.id("runs"),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("error")),
    steps: v.array(
      v.object({
        key: v.string(),
        label: v.string(),
        status: v.union(
          v.literal("pending"),
          v.literal("running"),
          v.literal("done"),
          v.literal("skipped"),
          v.literal("error"),
        ),
        detail: v.string(),
      }),
    ),
    error: v.union(v.null(), v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { runId, status, steps, error }) => {
    await ctx.db.patch("runs", runId, {
      status,
      steps,
      error,
      finishedAt: status === "running" ? null : Date.now(),
    });
    return null;
  },
});

export const saveCompanyContext = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    companyUrl: v.string(),
    context: vCompanyContext,
  },
  returns: v.id("companies"),
  handler: async (ctx, { workspaceId, companyUrl, context }) => {
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    if (existing) {
      await ctx.db.patch("companies", existing._id, {
        url: companyUrl,
        context,
        contextStatus: "ready",
        error: null,
      });
      return existing._id;
    }

    return await ctx.db.insert("companies", {
      workspaceId,
      name: context.keyProducts[0] ?? context.category ?? "Company",
      url: companyUrl,
      context,
      contextStatus: "ready",
      error: null,
    });
  },
});

export const markCompanyPending = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    companyUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { workspaceId, companyUrl }) => {
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
    if (existing) {
      await ctx.db.patch("companies", existing._id, {
        url: companyUrl,
        contextStatus: "pending",
        error: null,
      });
    } else {
      await ctx.db.insert("companies", {
        workspaceId,
        name: "Company",
        url: companyUrl,
        context: null,
        contextStatus: "pending",
        error: null,
      });
    }
    return null;
  },
});

export const markCompanyError = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    companyUrl: v.string(),
    error: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { workspaceId, companyUrl, error }) => {
    const existing = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
    if (existing) {
      await ctx.db.patch("companies", existing._id, {
        url: companyUrl,
        contextStatus: "error",
        error,
      });
    } else {
      await ctx.db.insert("companies", {
        workspaceId,
        name: "Company",
        url: companyUrl,
        context: null,
        contextStatus: "error",
        error,
      });
    }
    return null;
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
    const { runId, workspaceId } = await ctx.runMutation(internal.onboarding.createRun, args);

    const steps: RunStep[] = [
      {
        key: "firecrawl",
        label: "Scrape company page",
        status: "running",
        detail: args.companyUrl,
      },
      {
        key: "grok_context",
        label: "Extract Company Context",
        status: "pending",
        detail: "",
      },
    ];

    try {
      await ctx.runMutation(internal.onboarding.markCompanyPending, {
        workspaceId,
        companyUrl: args.companyUrl,
      });

      const scraped = await scrapeCompanyMarkdown(args.companyUrl);
      const truncated = truncateMarkdown(scraped.markdown);
      steps[0] = {
        ...steps[0],
        status: "done",
        detail: `HTTP ${scraped.httpStatus}; ${truncated.length} chars kept`,
      };
      steps[1] = { ...steps[1], status: "running", detail: "Calling Grok" };
      await ctx.runMutation(internal.onboarding.patchRun, {
        runId,
        status: "running",
        steps,
        error: null,
      });

      const ask = async () =>
        callGrok({
          model: GROK_DEFAULT_MODEL,
          instructions: COMPANY_CONTEXT_INSTRUCTIONS,
          input: `Company URL: ${args.companyUrl}\n\nPage markdown:\n${truncated}`,
          schema: {
            name: "company_context",
            schema: COMPANY_CONTEXT_JSON_SCHEMA as unknown as Record<string, unknown>,
            strict: true,
          },
          maxOutputTokens: 1200,
          reasoningEffort: "low",
        });

      let result = await ask();
      await ctx.runMutation(internal.costs.log, {
        workspaceId,
        provider: "xai",
        op: "onboarding.analyze",
        costUsd: ticksToUsd(result.costUsdTicks),
        credits: 0,
      });

      let parsed = parseJsonWithRetry(result.text, isCompanyContext);
      if (!parsed.ok) {
        result = await ask();
        await ctx.runMutation(internal.costs.log, {
          workspaceId,
          provider: "xai",
          op: "onboarding.analyze.retry",
          costUsd: ticksToUsd(result.costUsdTicks),
          credits: 0,
        });
        parsed = parseJsonWithRetry(result.text, isCompanyContext);
      }

      if (!parsed.ok) {
        const message = `Invalid Company Context JSON after retry: ${parsed.error}`;
        steps[1] = { ...steps[1], status: "error", detail: message };
        await ctx.runMutation(internal.onboarding.markCompanyError, {
          workspaceId,
          companyUrl: args.companyUrl,
          error: message,
        });
        await ctx.runMutation(internal.onboarding.patchRun, {
          runId,
          status: "error",
          steps,
          error: message,
        });
        return { runId, workspaceId };
      }

      await ctx.runMutation(internal.onboarding.saveCompanyContext, {
        workspaceId,
        companyUrl: args.companyUrl,
        context: parsed.value,
      });

      steps[1] = {
        ...steps[1],
        status: "done",
        detail: `${parsed.value.category}; ${parsed.value.plans.length} plans`,
      };
      await ctx.runMutation(internal.onboarding.patchRun, {
        runId,
        status: "done",
        steps,
        error: null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Onboarding failed";
      const failedKey = steps[0].status === "done" ? "grok_context" : "firecrawl";
      const nextSteps = steps.map((s) =>
        s.key === failedKey ? { ...s, status: "error" as const, detail: message } : s,
      );
      await ctx.runMutation(internal.onboarding.markCompanyError, {
        workspaceId,
        companyUrl: args.companyUrl,
        error: message,
      });
      await ctx.runMutation(internal.onboarding.patchRun, {
        runId,
        status: "error",
        steps: nextSteps,
        error: message,
      });
    }

    return { runId, workspaceId };
  },
});
