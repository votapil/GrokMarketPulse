import { useSearchParams } from "react-router-dom";
import { fixtureCompetitor, fixtureSource } from "@/lib/fixtures";
import { DemoToggle } from "@/components/DemoToggle";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { Skeleton } from "@/components/state/Skeleton";

export function SourcesPage() {
  const [params] = useSearchParams();
  const view = params.get("view");

  if (view === "loading") {
    return (
      <div className="flex flex-col gap-[var(--space-3)] p-[var(--space-6)]">
        <div className="h-12 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)]" />
        <div className="h-12 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)]" />
        <Skeleton label="Loading watchlist" />
        <DemoToggle />
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="p-[var(--space-6)]">
        <ErrorState
          title="URL did not open"
          body="Firecrawl could not fetch the pricing page. Check metadata.statusCode and retry."
          actionLabel="Retry"
        />
        <DemoToggle />
      </div>
    );
  }

  if (view === "empty") {
    return (
      <div className="p-[var(--space-6)]">
        <EmptyState
          title="Add a page to watch"
          body="The demo workspace ships with AcmeFlow pricing. Add a URL if the list is empty."
        />
        <DemoToggle />
      </div>
    );
  }

  return (
    <div className="p-[var(--space-6)]">
      <h1 className="text-[20px] font-[number:var(--weight-bold)]">Sources</h1>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
        {fixtureCompetitor.name} · {fixtureSource.label}
      </p>
      <p className="mt-[var(--space-2)] text-[14px] text-[var(--color-text)]">
        Watchlist is prefilled. Flip the fixture, then Run Scan on Pulse.
      </p>
      <DemoToggle />
    </div>
  );
}
