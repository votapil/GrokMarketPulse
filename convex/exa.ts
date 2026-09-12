import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { vSignalStatus } from "./schema";

/**
 * T-23 contract hook. The scheduled verify run is opened by `api.verify.again`.
 * Implementation (Exa search + evidence) lands in the ready commit.
 */
export const verify = internalAction({
  args: {
    signalId: v.id("signals"),
    runId: v.id("runs"),
    previousStatus: vSignalStatus,
  },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
