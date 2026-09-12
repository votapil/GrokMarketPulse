import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export function defaultLayout(signalId: string) {
  return [
    { id: "b1", type: "SignalCard" as const, props: { signalId } },
    { id: "b2", type: "DiffView" as const, props: { signalId } },
    { id: "b3", type: "EvidenceCard" as const, props: { signalId } },
    { id: "b4", type: "MetricCards" as const, props: { signalId } },
    { id: "b5", type: "RecommendationCards" as const, props: { signalId } },
  ];
}

export const build = internalMutation({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async () => {
    return null;
  },
});
