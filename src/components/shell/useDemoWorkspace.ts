import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { fixtureCompetitor, fixtureWorkspace } from "@/lib/fixtures";

export type DemoWorkspaceView = {
  companyName: string;
  planLabel: string;
  segment: string;
  competitorName: string;
  fromConvex: boolean;
};

export function useDemoWorkspace() {
  const demo = useQuery(api.workspace.demo);

  if (demo === undefined) {
    return { kind: "loading" as const };
  }

  if (demo === null) {
    const plan = fixtureWorkspace.company.context.plans[0];
    return {
      kind: "ready" as const,
      data: {
        companyName: fixtureWorkspace.company.name,
        planLabel: plan ? `Pro $${plan.usd}` : "Pro $45",
        segment: fixtureWorkspace.company.context.targetSegments[0] ?? "SMB",
        competitorName: fixtureCompetitor.name,
        fromConvex: false,
      } satisfies DemoWorkspaceView,
    };
  }

  const plan = demo.company.context?.plans.find((item) => item.name === "Pro");
  return {
    kind: "ready" as const,
    data: {
      companyName: demo.company.name,
      planLabel: plan?.usd != null ? `Pro $${plan.usd}` : "Pro $45",
      segment: demo.company.context?.targetSegments[0] ?? "SMB",
      competitorName: demo.competitors[0]?.name ?? fixtureCompetitor.name,
      fromConvex: true,
    } satisfies DemoWorkspaceView,
  };
}
