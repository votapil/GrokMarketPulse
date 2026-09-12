import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const persist = internalMutation({
  args: { sourceId: v.id("sources"), markdown: v.string() },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
