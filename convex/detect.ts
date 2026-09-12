import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const run = internalMutation({
  args: { workspaceId: v.id("workspaces"), sourceId: v.id("sources") },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
