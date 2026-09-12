import { v } from "convex/values";
import { internalAction } from "./_generated/server";

export const verify = internalAction({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
