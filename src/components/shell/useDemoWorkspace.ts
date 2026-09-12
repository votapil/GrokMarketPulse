import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { fixtureCompetitor, fixtureWorkspace } from "@/lib/fixtures";
import { workspacePlanLabel, workspaceSegment } from "@/lib/workspaceView";

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
    const context = fixtureWorkspace.company.context;
    return {
      kind: "ready" as const,
      data: {
        companyName: fixtureWorkspace.company.name,
        planLabel: workspacePlanLabel(context.plans),
        segment: workspaceSegment(context.targetSegments),
        competitorName: fixtureCompetitor.name,
        fromConvex: false,
      } satisfies DemoWorkspaceView,
    };
  }

  return {
    kind: "ready" as const,
    data: {
      companyName: demo.company.name,
      planLabel: workspacePlanLabel(demo.company.context?.plans ?? []),
      segment: workspaceSegment(demo.company.context?.targetSegments),
      competitorName: demo.competitors[0]?.name ?? fixtureCompetitor.name,
      fromConvex: true,
    } satisfies DemoWorkspaceView,
  };
}
