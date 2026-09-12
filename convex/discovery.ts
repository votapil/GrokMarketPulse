/**
 * T-35 Exa discovery: find nearby / same-niche competitors and persist them
 * through the single watchlist writer (`internal.workspace.upsertWatchlist`).
 *
 * T-31 budget.ts is not in yet — we honor a local Exa USD cap so a public demo
 * cannot loop paid `/search`. T-40 reads `api.discovery.list`.
 */

import { v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { api, internal } from "./_generated/api";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
} from "./grok";
import {
  EXA_SEARCH_COST_USD,
  EXA_SEARCH_TYPE,
  EXA_SEARCH_URL,
  readExaApiKey,
  type ExaHit,
  type ExaSearchOutcome,
} from "./exa";
import {
  DISCOVERY_EXA_BUDGET_USD,
  DISCOVERY_GROK_INSTRUCTIONS,
  DISCOVERY_GROK_SCHEMA,
  DISCOVERY_MAX,
  blockedHosts,
  buildDiscoveryQuery,
  competitorIdForUrl,
  decodeSuggestionMeta,
  encodeSuggestionMeta,
  hostKey,
  isGrokCandidatePayload,
  isOverExaBudget,
  kindFromSameProduct,
  parseGrokCandidates,
  pickUniqueHits,
  rankWithoutGrok,
  type RankedCandidate,
} from "./discoveryLogic";

type ActionCtx = GenericActionCtx<DataModel>;

const EXA_TIMEOUT_MS = 30_000;
const GROK_MAX_OUTPUT_TOKENS = 700;
const SEARCH_NUM_RESULTS = 10;

const vOrigin = v.union(
  v.literal("manual"),
  v.literal("grok"),
  v.literal("exa"),
  v.literal("seed"),
);

const vSuggestion = v.object({
  competitorId: v.union(v.null(), v.id("competitors")),
  url: v.string(),
  name: v.string(),
  origin: vOrigin,
  rationale: v.string(),
  sameProduct: v.boolean(),
  region: v.union(v.null(), v.string()),
  distanceKm: v.union(v.null(), v.number()),
});

const vSuggestResult = v.object({
  skipped: v.boolean(),
  reason: v.union(v.null(), v.string()),
  added: v.number(),
  candidates: v.array(vSuggestion),
});

type SuggestResult = {
  skipped: boolean;
  reason: string | null;
  added: number;
  candidates: Array<{
    competitorId: Id<"competitors"> | null;
    url: string;
    name: string;
    origin: "manual" | "grok" | "exa" | "seed";
    rationale: string;
    sameProduct: boolean;
    region: string | null;
    distanceKm: number | null;
  }>;
};

const vContext = v.object({
  workspaceId: v.id("workspaces"),
  companyUrl: v.string(),
  companyName: v.string(),
  category: v.string(),
  products: v.array(v.string()),
  positioning: v.string(),
  competitorUrls: v.array(v.string()),
});

export const loadContext = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.union(v.null(), vContext),
  handler: async (ctx, { workspaceId }) => {
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (!workspace) return null;

    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();
    if (!company) return null;

    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(64);

    return {
      workspaceId,
      companyUrl: company.url,
      companyName: company.name,
      category: company.context?.category ?? "",
      products: company.context?.keyProducts ?? [],
      positioning: company.context?.positioning ?? "",
      competitorUrls: competitors.map((row) => row.url),
    };
  },
});

export const stampExa = internalMutation({
  args: {
    patches: v.array(
      v.object({
        competitorId: v.id("competitors"),
        name: v.string(),
        kind: v.union(v.literal("direct"), v.literal("adjacent")),
        summary: v.string(),
      }),
    ),
  },
  returns: v.number(),
  handler: async (ctx, { patches }) => {
    let stamped = 0;
    for (const patch of patches) {
      const row = await ctx.db.get("competitors", patch.competitorId);
      if (!row || row.origin !== "exa") continue;
      await ctx.db.patch("competitors", patch.competitorId, {
        name: patch.name,
        kind: patch.kind,
        summary: patch.summary,
      });
      stamped += 1;
    }
    return stamped;
  },
});

export const competitorIndex = internalQuery({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(
    v.object({
      competitorId: v.id("competitors"),
      url: v.string(),
      origin: vOrigin,
    }),
  ),
  handler: async (ctx, { workspaceId }) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(64);

    return competitors.map((row) => ({
      competitorId: row._id,
      url: row.url,
      origin: row.origin,
    }));
  },
});

/** Competitors with niche/geo fields T-40 filters on. */
export const list = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(vSuggestion),
  handler: async (ctx, { workspaceId }) => {
    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .take(64);

    return competitors.map((row) => {
      const meta = decodeSuggestionMeta(row.summary, row.kind);
      return {
        competitorId: row._id,
        url: row.url,
        name: row.name,
        origin: row.origin,
        rationale: meta.rationale,
        sameProduct: meta.sameProduct,
        region: meta.region,
        distanceKm: meta.distanceKm,
      };
    });
  },
});

function readErrorDetail(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const message = payload as { error?: unknown; message?: unknown };
    if (typeof message.error === "string") return `${message.error} (HTTP ${status})`;
    if (typeof message.message === "string") return `${message.message} (HTTP ${status})`;
  }
  return `Exa HTTP ${status}`;
}

function readCostUsd(payload: unknown): number {
  if (!payload || typeof payload !== "object") return EXA_SEARCH_COST_USD;
  const cost = (payload as { costDollars?: { total?: unknown } }).costDollars;
  const total = cost?.total;
  return typeof total === "number" && Number.isFinite(total)
    ? total
    : EXA_SEARCH_COST_USD;
}

function toHit(row: unknown): ExaHit | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as {
    url?: unknown;
    title?: unknown;
    text?: unknown;
    highlights?: unknown;
    publishedDate?: unknown;
  };
  if (typeof raw.url !== "string" || raw.url.trim().length === 0) return null;
  const url = raw.url.trim();
  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title.trim()
      : url;
  let fragment = "";
  if (Array.isArray(raw.highlights)) {
    const best = raw.highlights.find(
      (item) => typeof item === "string" && item.trim().length > 0,
    );
    if (typeof best === "string") fragment = best.trim();
  }
  if (fragment.length === 0 && typeof raw.text === "string") {
    fragment = raw.text.trim();
  }
  return {
    url,
    title: title.slice(0, 200),
    fragment: fragment.slice(0, 600),
    publishedDate:
      typeof raw.publishedDate === "string" ? raw.publishedDate : null,
  };
}

/** One `/search` with `category: "company"` — not the verify search. */
async function searchCompanies(query: string): Promise<ExaSearchOutcome> {
  const apiKey = readExaApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);

  try {
    const response = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        type: EXA_SEARCH_TYPE,
        category: "company",
        numResults: SEARCH_NUM_RESULTS,
        contents: { highlights: true },
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      return {
        ok: false,
        hits: [],
        costUsd: 0,
        detail: `Exa returned non-JSON (HTTP ${response.status})`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        hits: [],
        costUsd: 0,
        detail: readErrorDetail(payload, response.status),
      };
    }

    const results = (payload as { results?: unknown }).results;
    const hits = Array.isArray(results)
      ? results.flatMap((row) => {
          const hit = toHit(row);
          return hit ? [hit] : [];
        })
      : [];

    return { ok: true, hits, costUsd: readCostUsd(payload) };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /timeout/i.test(error.message));
    return {
      ok: false,
      hits: [],
      costUsd: 0,
      detail: timedOut ? "Exa search timed out" : "Exa search request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function fillToMax(
  ranked: RankedCandidate[],
  pool: RankedCandidate[],
): RankedCandidate[] {
  if (ranked.length >= DISCOVERY_MAX) return ranked.slice(0, DISCOVERY_MAX);
  const seen = new Set(ranked.map((row) => hostKey(row.url)));
  const filled = [...ranked];
  for (const row of pool) {
    const host = hostKey(row.url);
    if (host.length === 0 || seen.has(host)) continue;
    seen.add(host);
    filled.push(row);
    if (filled.length >= DISCOVERY_MAX) break;
  }
  return filled;
}

async function rankWithGrok(
  ctx: ActionCtx,
  workspaceId: Id<"workspaces">,
  companyName: string,
  category: string,
  positioning: string,
  hits: Array<{ url: string; title: string; fragment: string }>,
): Promise<RankedCandidate[]> {
  const fallback = rankWithoutGrok(hits, new Set());
  const known = new Set(hits.map((hit) => hostKey(hit.url)));
  const hitLines = hits
    .map(
      (hit) =>
        `- ${hit.url}\n  title: ${hit.title}\n  excerpt: ${hit.fragment.slice(0, 280)}`,
    )
    .join("\n");

  try {
    const result = await callGrok({
      model: GROK_DEFAULT_MODEL,
      instructions: DISCOVERY_GROK_INSTRUCTIONS,
      input: [
        `OUR company: ${companyName}`,
        `Category: ${category || "unknown"}`,
        `Positioning: ${positioning || "unknown"}`,
        "",
        "Hits:",
        hitLines,
      ].join("\n"),
      schema: {
        name: "exa_discovery",
        schema: DISCOVERY_GROK_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
      maxOutputTokens: GROK_MAX_OUTPUT_TOKENS,
      reasoningEffort: "low",
    });
    await ctx.runMutation(internal.costs.log, {
      workspaceId,
      provider: "xai",
      op: "discovery.rank",
      costUsd: ticksToUsd(result.costUsdTicks),
      credits: 0,
    });
    const parsed = parseJsonWithRetry(result.text, isGrokCandidatePayload);
    if (!parsed.ok) return fallback;
    return fillToMax(parseGrokCandidates(parsed.value, known), fallback);
  } catch {
    return fallback;
  }
}

export const suggest = action({
  args: { workspaceId: v.id("workspaces") },
  returns: vSuggestResult,
  handler: async (ctx, { workspaceId }): Promise<SuggestResult> => {
    const empty = (reason: string, skipped: boolean): SuggestResult => ({
      skipped,
      reason,
      added: 0,
      candidates: [],
    });

    const context = await ctx.runQuery(internal.discovery.loadContext, {
      workspaceId,
    });
    if (!context) {
      return empty("Workspace or company not found", true);
    }

    const usage = await ctx.runQuery(api.usage.summary, { workspaceId });
    if (isOverExaBudget(usage.exaUsd, DISCOVERY_EXA_BUDGET_USD)) {
      return empty(
        `Exa budget cap reached ($${DISCOVERY_EXA_BUDGET_USD.toFixed(2)}) — T-31 stand-in`,
        true,
      );
    }

    const query = buildDiscoveryQuery({
      name: context.companyName,
      category: context.category,
      products: context.products,
      positioning: context.positioning,
    });

    const outcome = await searchCompanies(query);
    if (outcome.costUsd > 0) {
      await ctx.runMutation(internal.costs.log, {
        workspaceId,
        provider: "exa",
        op: "discovery.search",
        costUsd: outcome.costUsd,
        credits: 0,
      });
    }
    if (!outcome.ok) {
      return empty(outcome.detail, true);
    }

    const blocked = blockedHosts(context.companyUrl, context.competitorUrls);
    const pool = pickUniqueHits(outcome.hits, blocked);
    if (pool.length === 0) {
      return empty("No competitors matched. Widen the radius", false);
    }

    const ranked = await rankWithGrok(
      ctx,
      workspaceId,
      context.companyName,
      context.category,
      context.positioning,
      pool,
    );
    if (ranked.length === 0) {
      return empty("No competitors matched. Widen the radius", false);
    }

    const upserted: {
      createdSourceIds: Id<"sources">[];
    } = await ctx.runMutation(internal.workspace.upsertWatchlist, {
      workspaceId,
      urls: ranked.map((row) => row.url),
      origin: "exa" as const,
    });

    const stored: Array<{
      competitorId: Id<"competitors">;
      url: string;
      origin: SuggestResult["candidates"][number]["origin"];
    }> = await ctx.runQuery(internal.discovery.competitorIndex, {
      workspaceId,
    });

    const patches = ranked.flatMap((row) => {
      const competitorId = competitorIdForUrl(stored, row.url);
      if (!competitorId) return [];
      return [
        {
          competitorId,
          name: row.name,
          kind: kindFromSameProduct(row.sameProduct),
          summary: encodeSuggestionMeta(row),
        },
      ];
    });

    await ctx.runMutation(internal.discovery.stampExa, { patches });

    const candidates: SuggestResult["candidates"] = ranked.map((row) => ({
      competitorId: competitorIdForUrl(stored, row.url) ?? null,
      url: row.url,
      name: row.name,
      origin: "exa" as const,
      rationale: row.rationale,
      sameProduct: row.sameProduct,
      region: row.region,
      distanceKm: row.distanceKm,
    }));

    return {
      skipped: false,
      reason: null,
      added: upserted.createdSourceIds.length,
      candidates,
    };
  },
});
