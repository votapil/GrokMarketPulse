import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import schema from "./schema";

/** Read-only demo snapshot. First open seeds via `api.seed.ensure` (PulseScreen). */

export const demo = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      workspace: schema.doc("workspaces"),
      company: schema.doc("companies"),
      competitors: v.array(schema.doc("competitors")),
      sources: v.array(schema.doc("sources")),
    }),
  ),
  handler: async (ctx) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();
    if (!workspace) {
      return null;
    }

    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .first();
    if (!company) {
      return null;
    }

    const competitors = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspace._id))
      .collect();

    return { workspace, company, competitors, sources };
  },
});

/** True only when slug `demo` exists. Empty onboard-* workspaces do not count. */
export const hasDemo = query({
  args: {},
  returns: v.boolean(),
  handler: async (ctx) => {
    const workspace = await ctx.db
      .query("workspaces")
      .withIndex("by_slug", (q) => q.eq("slug", "demo"))
      .unique();
    return workspace !== null;
  },
});

const vOrigin = v.union(
  v.literal("manual"),
  v.literal("exa"),
  v.literal("grok"),
);

function tryHttpUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed;
  } catch {
    return null;
  }
}

function normalizeWatchUrl(url: URL): string {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const path = url.pathname.replace(/\/+$/, "");
  return `${url.protocol}//${host}${path}${url.search}`;
}

function nameFromUrl(url: URL): string {
  return url.hostname.replace(/^www\./, "");
}

function storedKey(raw: string): string {
  const parsed = tryHttpUrl(raw);
  return parsed ? normalizeWatchUrl(parsed) : raw.trim().toLowerCase();
}

/**
 * One writer for competitors/sources. Never patches existing demo rows —
 * a foreign URL inserts a new competitor/source. Empty list is a no-op.
 * A calls this from onboarding.analyze; discovery (T-35) will too.
 */
export const upsertWatchlist = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    urls: v.array(v.string()),
    origin: vOrigin,
  },
  returns: v.object({
    competitorIds: v.array(v.id("competitors")),
    createdSourceIds: v.array(v.id("sources")),
    errors: v.array(v.object({ url: v.string(), detail: v.string() })),
  }),
  handler: async (ctx, { workspaceId, urls, origin }) => {
    const workspace = await ctx.db.get("workspaces", workspaceId);
    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const existing = await ctx.db
      .query("competitors")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .collect();
    const byUrl = new Map(
      existing.map((row) => [storedKey(row.url), row._id] as const),
    );

    const competitorIds: Id<"competitors">[] = [];
    const createdSourceIds: Id<"sources">[] = [];
    const errors: Array<{ url: string; detail: string }> = [];
    const seenInBatch = new Set<string>();

    for (const raw of urls) {
      const parsed = tryHttpUrl(raw);
      if (!parsed) {
        if (raw.trim().length > 0) {
          errors.push({ url: raw, detail: "Not a valid http(s) URL" });
        }
        continue;
      }

      const key = normalizeWatchUrl(parsed);
      if (seenInBatch.has(key)) continue;
      seenInBatch.add(key);

      const found = byUrl.get(key);
      if (found) {
        competitorIds.push(found);
        continue;
      }

      const name = nameFromUrl(parsed);
      const competitorId = await ctx.db.insert("competitors", {
        workspaceId,
        name,
        url: key,
        kind: "direct",
        summary: "Added from setup watchlist",
        origin,
      });
      const sourceId = await ctx.db.insert("sources", {
        workspaceId,
        competitorId,
        url: key,
        kind: "pricing",
        label: `${name} pricing`,
        lastFetchedAt: null,
        lastStatus: null,
      });
      byUrl.set(key, competitorId);
      competitorIds.push(competitorId);
      createdSourceIds.push(sourceId);
    }

    return { competitorIds, createdSourceIds, errors };
  },
});

export const beginSetupRun = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    detail: v.string(),
  },
  returns: v.id("runs"),
  handler: async (ctx, { workspaceId, detail }) => {
    return await ctx.db.insert("runs", {
      workspaceId,
      competitorId: null,
      kind: "onboarding",
      status: "done",
      startedAt: Date.now(),
      finishedAt: Date.now(),
      signalId: null,
      steps: [
        {
          key: "watchlist",
          label: "Set watchlist baseline",
          status: "done",
          detail,
        },
      ],
      error: null,
    });
  },
});

/**
 * Public intake. Seeds demo if missing (AcmeFlow stays first), then inserts
 * new competitor URLs only. Never patches demo company or AcmeFlow rows.
 * Does not call onboarding.analyze when context is already ready.
 */
export const setupWatchlist = action({
  args: {
    companyUrl: v.string(),
    competitorUrls: v.array(v.string()),
  },
  returns: v.object({
    workspaceId: v.id("workspaces"),
    runId: v.id("runs"),
    competitorIds: v.array(v.id("competitors")),
  }),
  handler: async (
    ctx,
    { companyUrl, competitorUrls },
  ): Promise<{
    workspaceId: Id<"workspaces">;
    runId: Id<"runs">;
    competitorIds: Id<"competitors">[];
  }> => {
    const seeded: { workspaceId: Id<"workspaces"> } = await ctx.runAction(
      api.seed.ensure,
      {},
    );
    const workspaceId: Id<"workspaces"> = seeded.workspaceId;

    const demo = await ctx.runQuery(api.workspace.demo, {});
    const companyReady = demo?.company.contextStatus === "ready";

    let runId: Id<"runs">;
    if (!companyReady && tryHttpUrl(companyUrl)) {
      const analyzed = await ctx.runAction(api.onboarding.analyze, {
        companyUrl,
        competitorUrls,
      });
      runId = analyzed.runId;
    } else {
      runId = await ctx.runMutation(internal.workspace.beginSetupRun, {
        workspaceId,
        detail:
          competitorUrls.length === 0
            ? "No competitor URLs — watchlist unchanged"
            : `Watchlist ${competitorUrls.length} URL(s); demo company left intact`,
      });
    }

    const upserted: {
      competitorIds: Id<"competitors">[];
      createdSourceIds: Id<"sources">[];
      errors: Array<{ url: string; detail: string }>;
    } = await ctx.runMutation(internal.workspace.upsertWatchlist, {
      workspaceId,
      urls: competitorUrls,
      origin: "manual",
    });

    for (const sourceId of upserted.createdSourceIds) {
      try {
        await ctx.runAction(internal.firecrawl.scrape, {
          sourceId,
          isBaseline: true,
        });
      } catch {
        // One Firecrawl miss must not roll back the other new sources.
      }
    }

    return {
      workspaceId,
      runId,
      competitorIds: upserted.competitorIds,
    };
  },
});
