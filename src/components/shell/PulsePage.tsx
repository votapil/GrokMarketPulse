import { useSearchParams } from "react-router-dom";
import { Activity } from "lucide-react";
import { fixtureSignal } from "@/lib/fixtures";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { Skeleton } from "@/components/state/Skeleton";
import { useDemoWorkspace } from "./useDemoWorkspace";

const HISTORICAL = {
  title: "AcmeFlow added Slack integration",
  status: "resolved",
};

function FeedRow({
  title,
  status,
  active,
}: {
  title: string;
  status: string;
  active?: boolean;
}) {
  const led =
    status === "resolved"
      ? "bg-[var(--severity-low)]"
      : "bg-[var(--severity-high)]";
  return (
    <div
      className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)] ${
        active ? "outline outline-1 outline-[var(--color-text-muted)]" : ""
      }`}
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <span aria-hidden="true" className={`h-2 w-2 shrink-0 rounded-full ${led}`} />
        <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">
          {status}
        </p>
      </div>
      <p className="mt-[var(--space-2)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
        {title}
      </p>
    </div>
  );
}

export function PulsePage() {
  const [params] = useSearchParams();
  const view = params.get("view");
  const workspace = useDemoWorkspace();

  const center =
    view === "loading" || workspace.kind === "loading" ? (
      <Skeleton />
    ) : view === "empty" ? (
      <EmptyState
        title="No signals yet"
        body="Watchlist is ready. Run a scan to pull the competitor pricing page."
        actionLabel="Run Scan"
      />
    ) : view === "error" ? (
      <ErrorState
        title="Scan did not finish"
        body="Firecrawl returned 402 or timed out. Credits or the pricing URL need a retry."
        actionLabel="Retry scan"
      />
    ) : (
      <section className="flex h-full flex-col gap-[var(--space-4)]">
        <h1 className="text-[32px] font-[number:var(--weight-black)] leading-tight text-[var(--color-text)]">
          Your competitor moved.
        </h1>
        <div className="flex flex-1 flex-col items-start justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-6)]">
          <p className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
            DiffView
          </p>
          <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text-muted)]">
            $49 → $39
          </p>
        </div>
      </section>
    );

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
        {view === "empty" ? (
          <p className="text-[13px] text-[var(--color-text-muted)]">No signals yet</p>
        ) : (
          <>
            <FeedRow title={fixtureSignal.title} status={fixtureSignal.status} active />
            <FeedRow title={HISTORICAL.title} status={HISTORICAL.status} />
          </>
        )}
      </aside>
      <section className="min-w-0 flex-1 p-[var(--space-4)]">{center}</section>
      <aside
        className="flex w-[var(--size-action)] shrink-0 flex-col gap-[var(--space-3)] border-l border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
        aria-label="AI action panel"
      >
        <h2 className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
          Assessment
        </h2>
        <p className="text-[14px] text-[var(--color-text-muted)]">
          AI panel fills after Grok scores the scan. Slot reserved for track A.
        </p>
      </aside>
    </div>
  );
}
