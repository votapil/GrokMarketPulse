import { useMemo, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { DemoToggle } from "@/components/DemoToggle";
import { SourceRow } from "@/components/SourceRow";
import { fixtureWorkspace } from "@/lib/fixtures";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { Skeleton } from "@/components/state/Skeleton";

const DEFAULT_COMPANY = fixtureWorkspace.company.url;

export function SourcesPage() {
  const demo = useQuery(api.workspace.demo);
  const mockUrl = useQuery(api.mock.siteUrl);
  const setup = useAction(api.workspace.setupWatchlist);
  const [companyUrl, setCompanyUrl] = useState(DEFAULT_COMPANY);
  const [competitorText, setCompetitorText] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const competitorsPrefill = competitorText ?? mockUrl ?? "";

  const sources = useMemo(() => {
    if (!demo) return [];
    return demo.sources.map((source) => {
      const competitor = demo.competitors.find((row) => row._id === source.competitorId);
      return {
        id: source._id,
        label: source.label || competitor?.name || source.url,
        kind: source.kind,
        lastFetchedAt: source.lastFetchedAt,
        lastStatus: source.lastStatus,
      };
    });
  }, [demo]);

  async function onAnalyze() {
    setError(null);
    setPending(true);
    try {
      const competitorUrls = competitorsPrefill
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 3);
      await setup({ companyUrl, competitorUrls });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Setup failed");
    } finally {
      setPending(false);
    }
  }

  const context = demo?.company.context;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-[var(--space-5)] px-[var(--space-4)] py-[var(--space-6)]">
      <div>
        <h1 className="text-[20px] font-[number:var(--weight-bold)]">Setup</h1>
        <p className="mt-[var(--space-2)] text-[14px] text-[var(--color-text-muted)]">
          Your site and competitor URLs. Demo Helpdesk / AcmeFlow is never overwritten.
        </p>
      </div>

      <form
        className="flex flex-col gap-[var(--space-4)]"
        onSubmit={(event) => {
          event.preventDefault();
          void onAnalyze();
        }}
      >
        <label className="flex flex-col gap-[var(--space-2)]">
          <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase text-[var(--color-text-muted)]">
            Your website
          </span>
          <input
            type="url"
            value={companyUrl}
            onChange={(event) => setCompanyUrl(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[14px] text-[var(--color-text)]"
          />
        </label>
        <label className="flex flex-col gap-[var(--space-2)]">
          <span className="font-[family-name:var(--font-mono)] text-[12px] uppercase text-[var(--color-text-muted)]">
            Competitor websites
          </span>
          <textarea
            rows={3}
            value={competitorsPrefill}
            onChange={(event) => setCompetitorText(event.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]"
            placeholder={"https://competitor.example/pricing\nhttps://other.example/pricing"}
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-bold)] text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Analyzing…" : "Analyze & set baseline"}
        </button>
      </form>

      {pending ? <Skeleton label="Setting watchlist baseline" /> : null}

      {error ? (
        <ErrorState
          title="One URL failed"
          body={error}
          actionLabel="Retry"
          onRetry={() => void onAnalyze()}
        />
      ) : null}

      {context ? (
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
          <h2 className="font-[family-name:var(--font-mono)] text-[12px] uppercase text-[var(--color-text-muted)]">
            Company context
          </h2>
          <p className="mt-[var(--space-2)] text-[14px] text-[var(--color-text)]">
            {context.businessType} · {context.category}
          </p>
          <p className="mt-[var(--space-1)] text-[14px] text-[var(--color-text-muted)]">
            {context.pricingModel} · {context.targetSegments.join(", ")}
          </p>
        </section>
      ) : null}

      <section>
        <h2 className="mb-[var(--space-3)] font-[family-name:var(--font-mono)] text-[12px] uppercase text-[var(--color-text-muted)]">
          Watchlist
        </h2>
        {demo === undefined ? (
          <Skeleton label="Loading watchlist" />
        ) : sources.length === 0 ? (
          <EmptyState
            title="Add a page to watch"
            body="The demo workspace ships with AcmeFlow pricing. Add a URL if the list is empty."
          />
        ) : (
          <ul className="flex flex-col gap-[var(--space-2)]">
            {sources.map((source) => (
              <SourceRow
                key={source.id}
                label={source.label}
                kind={source.kind}
                lastFetchedAt={source.lastFetchedAt}
                lastStatus={source.lastStatus}
              />
            ))}
          </ul>
        )}
      </section>

      <DemoToggle />
    </div>
  );
}
