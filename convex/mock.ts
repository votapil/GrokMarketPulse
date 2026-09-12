import { v } from "convex/values";
import { action, env, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { MOCK_PRICING_PATH, MOCK_SLUG } from "./mockHtml";

export const state = query({
  args: {},
  returns: v.object({
    slug: v.string(),
    variant: v.union(v.literal("v1"), v.literal("v2")),
  }),
  handler: async (ctx) => {
    const site = await ctx.db
      .query("mockSite")
      .withIndex("by_slug", (q) => q.eq("slug", MOCK_SLUG))
      .unique();

    return {
      slug: MOCK_SLUG,
      variant: site?.variant ?? "v1",
    };
  },
});

export const flipVariant = internalMutation({
  args: { variant: v.union(v.literal("v1"), v.literal("v2")) },
  returns: v.null(),
  handler: async (ctx, { variant }) => {
    const existing = await ctx.db
      .query("mockSite")
      .withIndex("by_slug", (q) => q.eq("slug", MOCK_SLUG))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { variant });
    } else {
      await ctx.db.insert("mockSite", { slug: MOCK_SLUG, variant });
    }
    return null;
  },
});

export const flip = action({
  args: { variant: v.union(v.literal("v1"), v.literal("v2")) },
  returns: v.null(),
  handler: async (ctx, { variant }) => {
    await ctx.runMutation(internal.mock.flipVariant, { variant });
    return null;
  },
});

export const siteUrl = query({
  args: {},
  returns: v.string(),
  handler: async () => {
    return `${env.CONVEX_SITE_URL.replace(/\/$/, "")}${MOCK_PRICING_PATH}`;
  },
});
