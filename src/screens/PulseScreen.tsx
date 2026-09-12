import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Activity } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { SignalsFeed } from "@/components/SignalsFeed";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { ActionPanel } from "@/components/ActionPanel";
import { EmptyState } from "@/components/state/EmptyState";
import { Skeleton } from "@/components/state/Skeleton";

/**
 * T-15 contract: three-pane Pulse composition owned by track A.
 * Callers: shell PulsePage (route `/`). Uses workspace.demo + seed.ensure;
 * SignalsFeed / BlockRenderer / ActionPanel on selected signalId.
 */
export function PulseScreen() {
  const demo = useQuery(api.workspace.demo);
  const ensureSeed = useAction(api.seed.ensure);
  const [selectedSignalId, setSelectedSignalId] = useState<Id<"signals"> | null>(
    null,
  );
  const [seedStarted, setSeedStarted] = useState(false);

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

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className="flex w-[var(--size-feed)] shrink-0 flex-col gap-[var(--space-3)] border-r border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-3)]"
        aria-label="Signals feed"
      >
        <div className="flex items-center gap-[var(--space-2)] text-[var(--color-text-muted)]">
          <Activity aria-hidden="true" className="h-4 w-4" />
          <h2 className="font-[family-name:var(--font-mono)] text-[13px] uppercase">
            Signals
          </h2>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SignalsFeed
            workspaceId={workspaceId}
            selectedSignalId={selectedSignalId}
            onSelectSignal={setSelectedSignalId}
          />
        </div>
      </aside>

      <section
        className="min-w-0 flex-1 overflow-y-auto p-[var(--space-4)]"
        aria-label="Signal workspace"
      >
        {demo === undefined ? (
          <Skeleton />
        ) : selectedSignalId ? (
          <BlockRenderer signalId={selectedSignalId} />
        ) : (
          <EmptyState
            title="Select a signal"
            body="Pick a row in the feed to assemble DiffView, evidence, and metrics."
          />
        )}
      </section>

      <aside
        className="flex w-[var(--size-action)] shrink-0 flex-col overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
        aria-label="AI action panel"
      >
        <ActionPanel signalId={selectedSignalId} />
      </aside>
    </div>
  );
}
