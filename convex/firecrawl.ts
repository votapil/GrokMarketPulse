import { v } from "convex/values";
import { action, env, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";

type ActionCtx = GenericActionCtx<DataModel>;

type ScrapeResult = {
  ok: boolean;
  snapshotId: Id<"snapshots"> | null;
  detail: string;
  httpStatus: number;
  reused: boolean;
};

const MARKDOWN_LIMIT = 20_000;
const SCRAPE_TIMEOUT_MS = 60_000;
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/scrape";

const scrapeResult = v.object({
  ok: v.boolean(),
  snapshotId: v.union(v.id("snapshots"), v.null()),
  detail: v.string(),
  httpStatus: v.number(),
  reused: v.boolean(),
});

export const scrapeSource = action({
  args: {
    sourceId: v.id("sources"),
    isBaseline: v.optional(v.boolean()),
  },
  returns: scrapeResult,
  handler: async (ctx, args): Promise<ScrapeResult> => {
    return await runScrape(ctx, args.sourceId, args.isBaseline ?? false);
  },
});

export const scrape = internalAction({
  args: {
    sourceId: v.id("sources"),
    isBaseline: v.boolean(),
  },
  returns: scrapeResult,
  handler: async (ctx, args): Promise<ScrapeResult> => {
    return await runScrape(ctx, args.sourceId, args.isBaseline);
  },
});

async function runScrape(
  ctx: ActionCtx,
  sourceId: Id<"sources">,
  isBaseline: boolean,
): Promise<ScrapeResult> {
    const source = await ctx.runQuery(internal.snapshots.getSource, {
      sourceId,
    });
    if (!source) {
      return {
        ok: false,
        snapshotId: null,
        detail: "Source not found",
        httpStatus: 0,
        reused: false,
      };
    }

    const key = (env as Record<string, string | undefined>).FIRECRAWL_API_KEY;
    if (!key) {
      return {
        ok: false,
        snapshotId: null,
        detail: "FIRECRAWL_API_KEY is not set",
        httpStatus: 0,
        reused: false,
      };
    }

    const fetchedAt = Date.now();
    const scraped = await scrapeMarkdown(source.url, key);

    if (scraped.charged) {
      await ctx.runMutation(internal.snapshots.recordUsage, {
        workspaceId: source.workspaceId,
        createdAt: fetchedAt,
        credits: 1,
      });
    }

    if (!scraped.ok) {
      return {
        ok: false,
        snapshotId: null,
        detail: scraped.detail,
        httpStatus: scraped.httpStatus,
        reused: false,
      };
    }

    const markdown = scraped.markdown.slice(0, MARKDOWN_LIMIT);
    const parsed = parsePricingMarkdown(markdown);
    const hash = await hashMarkdown(markdown);

    const saved = await ctx.runMutation(internal.snapshots.persist, {
      workspaceId: source.workspaceId,
      sourceId,
      fetchedAt,
      isBaseline,
      hash,
      markdown,
      plans: parsed.plans,
      features: parsed.features,
      headline: parsed.headline,
      provider: "firecrawl",
      httpStatus: scraped.httpStatus,
    });

    return {
      ok: true,
      snapshotId: saved.snapshotId,
      detail: saved.reused ? "Unchanged — reused previous snapshot" : "Scraped",
      httpStatus: scraped.httpStatus,
      reused: saved.reused,
    };
}

type ScrapeOutcome =
  | { ok: true; markdown: string; httpStatus: number; charged: boolean; detail: string }
  | { ok: false; markdown: ""; httpStatus: number; charged: boolean; detail: string };

async function scrapeMarkdown(url: string, apiKey: string): Promise<ScrapeOutcome> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCRAPE_TIMEOUT_MS);

  try {
    const response = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["markdown"],
        onlyMainContent: true,
        maxAge: 86_400_000,
        timeout: SCRAPE_TIMEOUT_MS,
      }),
      signal: controller.signal,
    });

    if (response.status === 402) {
      return {
        ok: false,
        markdown: "",
        httpStatus: 402,
        charged: false,
        detail: "Firecrawl credits exhausted (402)",
      };
    }

    const payload = (await response.json()) as {
      success?: boolean;
      error?: string;
      data?: {
        markdown?: string;
        metadata?: { statusCode?: number; title?: string };
      };
    };

    const pageStatus = payload.data?.metadata?.statusCode ?? response.status;
    const markdown = payload.data?.markdown?.trim() ?? "";
    const charged = Boolean(payload.data);

    if (pageStatus === 403 || pageStatus === 404) {
      return {
        ok: false,
        markdown: "",
        httpStatus: pageStatus,
        charged,
        detail: `Page returned ${pageStatus}`,
      };
    }

    if (!response.ok || payload.success === false) {
      return {
        ok: false,
        markdown: "",
        httpStatus: response.status,
        charged,
        detail: payload.error ?? `Firecrawl HTTP ${response.status}`,
      };
    }

    if (!markdown) {
      return {
        ok: false,
        markdown: "",
        httpStatus: pageStatus,
        charged,
        detail: "Empty markdown from Firecrawl",
      };
    }

    return {
      ok: true,
      markdown,
      httpStatus: pageStatus,
      charged: true,
      detail: "Scraped",
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "AbortError" || /timeout/i.test(error.message));
    return {
      ok: false,
      markdown: "",
      httpStatus: 0,
      charged: false,
      detail: timedOut ? "Firecrawl timed out" : "Firecrawl request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function parsePricingMarkdown(markdown: string) {
  const headline = markdown.split("\n").find((line) => line.startsWith("# "))?.slice(2).trim()
    ?? "Pricing";
  const plans: Array<{
    name: string;
    usd: number | null;
    period: string;
    limits: string;
    features: string[];
  }> = [];

  const blockRe = /(?:^|\n)#{2,3}\s+([^\n]+)([\s\S]*?)(?=\n#{2,3}\s+|$)/g;
  for (const match of markdown.matchAll(blockRe)) {
    const name = match[1].trim();
    const body = match[2];
    const price = body.match(/\$(\d+(?:\.\d+)?)/);
    const features = [...body.matchAll(/^\s*[-*]\s+(.+)$/gm)].map((item) => item[1].trim());
    plans.push({
      name,
      usd: price ? Number(price[1]) : null,
      period: /year/i.test(body) ? "year" : "month",
      limits: "",
      features,
    });
  }

  const features = [...new Set(plans.flatMap((plan) => plan.features))];
  return { headline, plans, features };
}

async function hashMarkdown(markdown: string): Promise<string> {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
