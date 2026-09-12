import { useCallback, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { canStartScan } from "@/lib/scanUi";

/**
 * Shared Run Scan launcher for AppHeader and PulseScreen.
 * Prefers the seeded AcmeFlow competitor so Exa watchlist rows do not steal the CTA.
 */
export function useRunScan() {
  const demo = useQuery(api.workspace.demo);
  const runScan = useAction(api.scan.run);
  const [scanPending, setScanPending] = useState(false);
  const [scanLaunchError, setScanLaunchError] = useState<string | null>(null);

  const workspaceId = demo?.workspace._id;
  const competitorId =
    demo?.competitors.find((row) => row.origin === "seed")?._id ??
    demo?.competitors[0]?._id ??
    null;

  const anyLatestRun = useQuery(
    api.runs.latest,
    workspaceId !== undefined ? { workspaceId } : "skip",
  );
  const latestRun = anyLatestRun?.kind === "scan" ? anyLatestRun : null;
  const isScanning = scanPending || latestRun?.status === "running";

  const startScan = useCallback(() => {
    if (competitorId == null || !canStartScan(competitorId, isScanning)) {
      return;
    }
    const targetId = competitorId;
    setScanLaunchError(null);
    setScanPending(true);
    void runScan({ competitorId: targetId })
      .then(() => {
        /* progress comes from api.runs.latest realtime */
      })
      .catch((error: unknown) => {
        const message =
          error instanceof Error ? error.message : "Scan failed to start";
        setScanLaunchError(message);
      })
      .finally(() => {
        setScanPending(false);
      });
  }, [competitorId, isScanning, runScan]);

  return {
    demo,
    workspaceId,
    competitorId,
    latestRun,
    isScanning,
    startScan,
    scanLaunchError,
  };
}
