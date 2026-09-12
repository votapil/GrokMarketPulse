import { ExternalLink, RefreshCw } from "lucide-react";

import type { BlockProps, EvidenceItem } from "./DiffView";
import { resolveEvidenceUrl, useSignalBundle } from "./DiffView";
import { cn } from "@/lib/utils";

export function formatDetectedAt(timestamp: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}%`;
}

/** Provider badge labels shown in the Evidence zone. */
export type ProviderBadge = "Firecrawl" | "Exa" | "fixture" | "cached snapshot";

/**
 * Maps evidence.provider (+ snapshot/fixture cases) to a visible badge.
 * `provider: "fixture"` (or internal snapshot cache) → honest `cached snapshot` placka.
 */
export function providerBadgeFor(item: EvidenceItem): ProviderBadge {
  const provider = item.provider.toLowerCase();

  if (provider === "firecrawl") {
    return "Firecrawl";
  }
  if (provider === "exa") {
    return "Exa";
  }
  if (provider === "fixture") {
    return "cached snapshot";
  }
  if (provider === "internal") {
    return "cached snapshot";
  }
  return "fixture";
}

const EVIDENCE_ORDER: Record<string, number> = {
  current_snapshot: 0,
  firecrawl_fragment: 1,
  previous_snapshot: 2,
  exa_source: 3,
  diff: 4,
};

function sortEvidence(items: EvidenceItem[]): EvidenceItem[] {
  return [...items]
    .filter((item) => item.kind !== "diff")
    .sort((a, b) => {
      const rankA = EVIDENCE_ORDER[a.kind] ?? 99;
      const rankB = EVIDENCE_ORDER[b.kind] ?? 99;
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return b.observedAt - a.observedAt;
    });
}

function EvidenceSkeleton() {
  return (
    <section
      aria-busy="true"
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]"
    >
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        Loading evidence
      </p>
      <div className="mt-[var(--space-3)] h-3 w-2/3 animate-pulse rounded bg-[var(--palette-border)]" />
      <div className="mt-[var(--space-3)] h-3 w-full animate-pulse rounded bg-[var(--palette-border)]" />
      <div className="mt-[var(--space-2)] h-3 w-4/5 animate-pulse rounded bg-[var(--palette-border)]" />
    </section>
  );
}

function EvidenceEmpty() {
  return (
    <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]">
      <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted)]">
        No evidence attached
      </p>
    </section>
  );
}

function EvidenceError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--palette-recessed)] p-[var(--space-4)]">
      <p className="font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
        Source page did not open
      </p>
      <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--color-surface)]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </section>
  );
}

function EvidenceRow({ item }: { item: EvidenceItem }) {
  const badge = providerBadgeFor(item);
  const href = resolveEvidenceUrl(item.url);
  const isHighConfidence = item.confidence >= 0.8;
  const isCached = badge === "cached snapshot";

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-3)]">
      <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
        <div className="flex flex-wrap items-center gap-[var(--space-2)]">
          <span
            className={cn(
              "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text)]",
              isCached && "border-[var(--palette-amber)] text-[var(--palette-amber)]",
            )}
          >
            {badge}
          </span>
        </div>
        <time
          dateTime={new Date(item.observedAt).toISOString()}
          className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]"
        >
          Detected {formatDetectedAt(item.observedAt)} UTC
        </time>
      </div>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {item.title}
      </p>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-[var(--space-1)] flex items-center gap-[var(--space-1)] truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--palette-info)] underline-offset-2 hover:underline"
      >
        <span className="truncate">{href}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </a>
      <blockquote className="mt-[var(--space-3)] border-l-2 border-[var(--color-border)] pl-[var(--space-3)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
        &ldquo;{item.fragment.replace(/\n/g, " · ")}&rdquo;
      </blockquote>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text)]">
        Confidence{" "}
        <span
          className={cn(
            isHighConfidence ? "text-[var(--palette-ok)]" : "text-[var(--color-text)]",
          )}
        >
          {formatConfidence(item.confidence)}
        </span>
      </p>
    </article>
  );
}

/** Reserved slot — T-13 fills assessment copy; dashed = AI analysis zone. */
function AiAnalysisPlaceholder() {
  return (
    <section
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]"
      aria-label="AI analysis"
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="h-2 w-2 rounded-full bg-[var(--palette-info)]" aria-hidden />
        <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text)]">
          AI analysis
        </h3>
      </div>
      <p className="mt-[var(--space-1)] text-[11px] text-[var(--color-text-muted)]">
        Model inference — verify against evidence
      </p>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted)]">
        Assessment pending
      </p>
    </section>
  );
}

function EvidenceReady({ evidence }: { evidence: EvidenceItem[] }) {
  const items = sortEvidence(evidence);

  return (
    <div className="space-y-[var(--space-3)]">
      <section className="space-y-[var(--space-3)]">
        <header>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
            Evidence · {items.length} source{items.length === 1 ? "" : "s"}
          </p>
        </header>
        {items.map((item) => (
          <EvidenceRow key={item.id} item={item} />
        ))}
      </section>
      <AiAnalysisPlaceholder />
    </div>
  );
}

export function EvidenceCard({ signalId }: BlockProps) {
  const state = useSignalBundle(signalId);

  if (state.kind === "loading") {
    return <EvidenceSkeleton />;
  }

  if (state.kind === "empty") {
    return <EvidenceEmpty />;
  }

  if (state.kind === "error") {
    return (
      <EvidenceError
        message={state.message}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  if (state.data.evidence.length === 0) {
    return <EvidenceEmpty />;
  }

  return <EvidenceReady evidence={state.data.evidence} />;
}

export default EvidenceCard;
