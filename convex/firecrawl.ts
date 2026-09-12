import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const scrape = internalAction({
  args: { sourceId: v.id("sources"), url: v.string() },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
