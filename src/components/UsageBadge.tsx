import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const ZERO_LINE = "Grok $0.00 · Firecrawl 0 credits · Exa $0.00";

const shellClassName =
  "bg-[var(--color-bg)] py-[var(--space-1)] font-mono font-[family-name:var(--font-mono)] text-[11px] leading-[16px] text-[var(--color-text-muted)]";

function formatUsd(value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  return `$${amount.toFixed(2)}`;
}

function formatCredits(value: number): string {
  const credits = Number.isFinite(value) ? value : 0;
  return String(Math.round(credits));
}

function formatUsageLine(
  xaiUsd: number,
  firecrawlCredits: number,
  exaUsd: number,
): string {
  return `Grok ${formatUsd(xaiUsd)} · Firecrawl ${formatCredits(firecrawlCredits)} credits · Exa ${formatUsd(exaUsd)}`;
}

/**
 * T-26: quiet live spend line (Grok / Firecrawl / Exa). Track A mounts this on Pulse.
 * Fal is in the API payload and is intentionally omitted from the visible string.
 */
export function UsageBadge({
  workspaceId,
}: {
  workspaceId: Id<"workspaces"> | null | undefined;
}) {
  const summary = useQuery(
    api.usage.summary,
    workspaceId ? { workspaceId } : "skip",
  );

  if (workspaceId && summary === undefined) {
    return (
      <p
        role="status"
        aria-busy="true"
        aria-live="polite"
        aria-label="Loading API usage"
        className={shellClassName}
      >
        <span
          aria-hidden="true"
          className="block h-[11px] w-[280px] max-w-full animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-border)]"
        />
      </p>
    );
  }

  const line =
    summary === undefined
      ? ZERO_LINE
      : formatUsageLine(summary.xaiUsd, summary.firecrawlCredits, summary.exaUsd);

  return (
    <p aria-live="polite" aria-label="Sponsor API usage" className={shellClassName}>
      {line}
    </p>
  );
}
