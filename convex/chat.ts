import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import schema from "./schema";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(schema.doc("chatMessages")),
  handler: async (ctx, { workspaceId }) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
      .order("asc")
      .collect();
  },
});

export const insertExchange = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    text: v.string(),
  },
  returns: v.object({ messageId: v.id("chatMessages") }),
  handler: async (ctx, { workspaceId, text }) => {
    const now = Date.now();
    await ctx.db.insert("chatMessages", {
      workspaceId,
      role: "user",
      text,
      blocks: [],
      status: "ready",
      createdAt: now,
    });

    const messageId = await ctx.db.insert("chatMessages", {
      workspaceId,
      role: "assistant",
      text: "AcmeFlow dropped Pro to $39. I prepared three responses.",
      blocks: [],
      status: "ready",
      createdAt: now + 1,
    });

    return { messageId };
  },
});

export const ask = action({
  args: {
    workspaceId: v.id("workspaces"),
    text: v.string(),
  },
  returns: v.object({ messageId: v.id("chatMessages") }),
  handler: async (ctx, args): Promise<{ messageId: Id<"chatMessages"> }> => {
    return await ctx.runMutation(internal.chat.insertExchange, args);
  },
});
