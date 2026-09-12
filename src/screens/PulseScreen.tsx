import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SignalsFeed } from "@/components/SignalsFeed";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { ActionPanel } from "@/components/ActionPanel";
import { EmptyState } from "@/components/state/EmptyState";
import { Skeleton } from "@/components/state/Skeleton";
import { CompanyBar } from "@/components/CompanyBar";
import { RunScanButton } from "@/components/RunScanButton";
import { ScanProgress } from "@/components/ScanProgress";

/**
 * T-15: Pulse composition. Callers: App `/` / shell PulsePage.
 * Feed and ActionPanel own their column chrome (aside/border/width) —
 * do not wrap them again or borders/padding double up.
 * Run Scan + steps via api.scan.run / api.runs.latest.
 */
export function PulseScreen() {
  const demo = useQuery(api.workspace.demo);
  const ensureSeed = useAction(api.seed.ensure);
  const runScan = useAction(api.scan.run);
  const [selectedSignalId, setSelectedSignalId] = useState<Id<"signals"> | null>(
    null,
  );
  const [seedStarted, setSeedStarted] = useState(false);
  const [scanPending, setScanPending] = useState(false);
  const [scanLaunchError, setScanLaunchError] = useState<string | null>(null);
  const handledDoneRunIdRef = useRef<Id<"runs"> | null>(null);

  useEffect(() => {
    if (demo !== null || seedStarted) {
      return;
    }
    setSeedStarted(true);
    void ensureSeed({}).catch(() => {
      /* seed may race; feed falls back to fixtures */
    });
  }, [demo, ensureSeed, seedStarted]);

  const workspaceId = demo?.workspace._id;
  const competitorId = demo?.competitors[0]?._id ?? null;

  const anyLatestRun = useQuery(
    api.runs.latest,
    workspaceId !== undefined ? { workspaceId } : "skip",
  );
  // runs.latest отдаёт последний прогон любого вида. Прогресс, блокировка CTA и
  // автовыбор сигнала — только по scan: artifact/verify показывают ход у себя,
  // иначе незакрытый verify-run навсегда гасит Run Scan.
  const latestRun = anyLatestRun?.kind === "scan" ? anyLatestRun : null;

  const isScanning = scanPending || latestRun?.status === "running";
  const showScanProgress =
    latestRun != null &&
    (latestRun.status === "running" || latestRun.status === "error");

  useEffect(() => {
    if (latestRun == null || latestRun.status !== "done") {
      return;
    }
    if (latestRun.signalId == null) {
      return;
    }
    if (handledDoneRunIdRef.current === latestRun._id) {
      return;
    }
    handledDoneRunIdRef.current = latestRun._id;
    setSelectedSignalId(latestRun.signalId);
  }, [latestRun]);

  const startScan = useCallback(() => {
    if (competitorId == null || isScanning) {
      return;
    }
    setScanLaunchError(null);
    setScanPending(true);
    void runScan({ competitorId })
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

  const statusHint =
    competitorId == null
      ? "Seed workspace to enable Run Scan"
      : isScanning
        ? "Scan in progress"
        : latestRun == null
          ? "Ready to scan"
          : latestRun.status === "error"
            ? "Last scan failed"
            : "Monitor competitors";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* T-39: «моя компания» — одна предзаполненная строка, не визард. */}
      <CompanyBar />

      <div className="flex shrink-0 items-center justify-between gap-[var(--space-3)] border-b border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)]">
        <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
          {statusHint}
        </p>
        <RunScanButton
          disabled={competitorId == null}
          isScanning={isScanning}
          onClick={startScan}
        />
      </div>

      {scanLaunchError ? (
        <p
          role="alert"
          className="border-b border-[var(--color-border)] bg-[var(--palette-recessed)] px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]"
        >
          {scanLaunchError}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <SignalsFeed
          workspaceId={workspaceId}
          selectedSignalId={selectedSignalId}
          onSelectSignal={setSelectedSignalId}
        />

        <section
          className="min-w-0 flex-1 overflow-y-auto p-[var(--space-4)]"
          aria-label="Signal workspace"
        >
          {demo === undefined ? (
            <Skeleton />
          ) : showScanProgress ? (
            <ScanProgress run={latestRun} onRetry={startScan} />
          ) : selectedSignalId ? (
            <BlockRenderer signalId={selectedSignalId} />
          ) : (
            <EmptyState
              title="Select a signal"
              body="Pick a row in the feed to assemble DiffView, evidence, and metrics — or Run Scan to watch competitors."
            />
          )}
        </section>

        <ActionPanel signalId={selectedSignalId} />
      </div>
    </div>
  );
}
