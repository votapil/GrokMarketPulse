import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const run = internalMutation({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
