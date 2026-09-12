/**
 * T-33 Fal.ai hero image for landing artifacts.
 *
 * Scheduled after Act marks the artifact ready so the page is visible first.
 * Any Fal/env/network failure leaves `heroImageUrl` null and never throws —
 * Act must not fail because a picture did not render.
 */

import { v } from "convex/values";
import type { GenericActionCtx } from "convex/server";
import type { DataModel, Id } from "./_generated/dataModel";
import {
  env,
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";

type ActionCtx = GenericActionCtx<DataModel>;

const FAL_URL = "https://fal.run/fal-ai/flux/schnell";
const FAL_TIMEOUT_MS = 30_000;
/** Flux Schnell bills $0.003 per megapixel; landscape_16_9 rounds up to 1 MP. */
const FLUX_SCHNELL_COST_USD = 0.003;

const vArtifactType = v.union(
  v.literal("battlecard"),
  v.literal("offer"),
  v.literal("landing"),
);

const heroResult = v.union(v.null(), v.string());

type ArtifactRow = {
  workspaceId: Id<"workspaces">;
  type: "battlecard" | "offer" | "landing";
  payload: unknown;
};

type LandingCopy = {
  headline: string;
  subheadline: string;
  differentiation: string;
};

export function buildHeroPrompt(landing: LandingCopy): string {
  const headline = landing.headline.trim();
  const positioning =
    landing.differentiation.trim() || landing.subheadline.trim();
  return [
    "Photorealistic cinematic hero image for a B2B SaaS landing page.",
    headline ? `Headline: ${headline}.` : "",
    positioning ? `Positioning: ${positioning}.` : "",
    "Wide 16:9 composition, professional lighting, no text, no logos, no watermarks, no UI chrome.",
  ]
    .filter((part) => part.length > 0)
    .join(" ");
}

export const getArtifact = internalQuery({
  args: { artifactId: v.id("artifacts") },
  returns: v.union(
    v.null(),
    v.object({
      workspaceId: v.id("workspaces"),
      type: vArtifactType,
      payload: schema.doc("artifacts").fields.payload,
    }),
  ),
  handler: async (ctx, { artifactId }) => {
    const artifact = await ctx.db.get("artifacts", artifactId);
    if (!artifact) return null;
    return {
      workspaceId: artifact.workspaceId,
      type: artifact.type,
      payload: artifact.payload,
    };
  },
});

export const setHeroImageUrl = internalMutation({
  args: {
    artifactId: v.id("artifacts"),
    heroImageUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, { artifactId, heroImageUrl }) => {
    const artifact = await ctx.db.get("artifacts", artifactId);
    if (!artifact || artifact.type !== "landing") return null;
    await ctx.db.patch("artifacts", artifactId, { heroImageUrl });
    return null;
  },
});

/**
 * Internal so Act can `scheduler.runAfter(0, internal.fal.hero, …)`.
 * `npx convex run fal:hero` still reaches this (CLI can invoke internal).
 */
export const hero = internalAction({
  args: { artifactId: v.id("artifacts") },
  returns: heroResult,
  handler: async (ctx, { artifactId }): Promise<string | null> => {
    return await runHero(ctx, artifactId);
  },
});

async function runHero(
  ctx: ActionCtx,
  artifactId: Id<"artifacts">,
): Promise<string | null> {
  try {
    const artifact: ArtifactRow | null = await ctx.runQuery(
      internal.fal.getArtifact,
      { artifactId },
    );
    if (!artifact || artifact.type !== "landing") return null;

    const landing = landingCopy(artifact.payload);
    if (!landing) return null;

    const key = (env as Record<string, string | undefined>).FAL_KEY;
    if (!key) return null;

    const imageUrl = await requestFalImage(key, buildHeroPrompt(landing));
    if (!imageUrl) return null;

    await ctx.runMutation(internal.fal.setHeroImageUrl, {
      artifactId,
      heroImageUrl: imageUrl,
    });

    try {
      await ctx.runMutation(internal.costs.log, {
        workspaceId: artifact.workspaceId,
        provider: "fal",
        op: "fal.hero",
        costUsd: FLUX_SCHNELL_COST_USD,
        credits: 0,
      });
    } catch {
      // Spend log must not undo a written URL.
    }

    return imageUrl;
  } catch {
    return null;
  }
}

function landingCopy(payload: unknown): LandingCopy | null {
  if (!payload || typeof payload !== "object") return null;
  const row = payload as {
    type?: unknown;
    headline?: unknown;
    subheadline?: unknown;
    differentiation?: unknown;
  };
  if (row.type !== "landing") return null;
  if (typeof row.headline !== "string") return null;
  if (typeof row.subheadline !== "string") return null;
  if (typeof row.differentiation !== "string") return null;
  return {
    headline: row.headline,
    subheadline: row.subheadline,
    differentiation: row.differentiation,
  };
}

async function requestFalImage(
  apiKey: string,
  prompt: string,
): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FAL_TIMEOUT_MS);
  try {
    const response = await fetch(FAL_URL, {
      method: "POST",
      headers: {
        Authorization: `Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt,
        image_size: "landscape_16_9",
        num_images: 1,
        num_inference_steps: 4,
        enable_safety_checker: true,
        output_format: "jpeg",
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    let payload: unknown;
    try {
      payload = (await response.json()) as unknown;
    } catch {
      return null;
    }
    return extractImageUrl(payload);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { images?: unknown; data?: { images?: unknown } };
  const images = Array.isArray(root.images)
    ? root.images
    : Array.isArray(root.data?.images)
      ? root.data.images
      : null;
  if (!images || images.length === 0) return null;
  const first = images[0];
  if (!first || typeof first !== "object") return null;
  const url = (first as { url?: unknown }).url;
  return typeof url === "string" && url.length > 0 ? url : null;
}
