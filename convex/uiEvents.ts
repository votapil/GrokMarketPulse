import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

export const handleEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    blockId: v.string(),
    action: v.string(),
    payload: v.string(),
  },
  returns: v.union(v.object({ messageId: v.id("chatMessages") }), v.null()),
  handler: async (ctx, { workspaceId, blockId, action, payload }) => {
    if (action === "noop") {
      return null;
    }

    const messageId = await ctx.db.insert("chatMessages", {
      workspaceId,
      role: "system",
      text: `UI event on ${blockId}: ${action} (${payload})`,
      blocks: [],
      status: "ready",
      createdAt: Date.now(),
    });

    return { messageId };
  },
});

export const send = action({
  args: {
    workspaceId: v.id("workspaces"),
    blockId: v.string(),
    action: v.string(),
    payload: v.string(),
  },
  returns: v.union(v.object({ messageId: v.id("chatMessages") }), v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<{ messageId: Id<"chatMessages"> } | null> => {
    return await ctx.runMutation(internal.uiEvents.handleEvent, args);
  },
});
