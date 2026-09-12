import { useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  fixtureCompetitor,
  fixtureEvidence,
  fixtureSignal,
  fixtureSource,
} from "@/lib/fixtures";
import type { LoadState } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Props for DiffView / EvidenceCard — registry wraps `block.props.signalId`. */
export type BlockProps = {
  signalId: string;
};

export type EvidenceItem = {
  id: string;
  kind: string;
  provider: string;
  url: string;
  title: string;
  fragment: string;
  confidence: number;
  observedAt: number;
};

export type SignalRecord = {
  id: string;
  type: string;
  title: string;
  summary: string;
  previousState: string;
  currentState: string;
  detectedAt: number;
  severity: string;
  confidence: number;
  error: string | null;
};

export type SignalBundle = {
  signal: SignalRecord;
  evidence: EvidenceItem[];
  competitor: { name: string; url: string };
  source: { url: string; label: string };
};

export type DiffLine = {
  type: "add" | "remove";
  text: string;
};

function isFixtureSignalId(signalId: string): boolean {
  return signalId.startsWith("fixture_");
}

function fixtureBundle(): SignalBundle {
  return {
    signal: fixtureSignal,
    evidence: fixtureEvidence,
    competitor: fixtureCompetitor,
    source: fixtureSource,
  };
}

export function useSignalBundle(signalId: string | undefined): LoadState<SignalBundle> {
  const isFixture = signalId !== undefined && isFixtureSignalId(signalId);
  const data = useQuery(
    api.signals.get,
    signalId && !isFixture ? { signalId: signalId as Id<"signals"> } : "skip",
  );

  if (!signalId) {
    return { kind: "empty" };
  }

  if (isFixture) {
    if (signalId === fixtureSignal.id) {
      return { kind: "ready", data: fixtureBundle() };
    }
    return { kind: "error", message: `Fixture signal "${signalId}" not found` };
  }

  if (data === undefined) {
    return { kind: "loading" };
  }

  if (data === null) {
    return { kind: "empty" };
  }

  if (data.signal.error) {
    return { kind: "error", message: data.signal.error };
  }

  return {
    kind: "ready",
    data: {
      signal: {
        id: data.signal._id,
        type: data.signal.type,
        title: data.signal.title,
        summary: data.signal.summary,
        previousState: data.signal.previousState,
        currentState: data.signal.currentState,
        detectedAt: data.signal.detectedAt,
        severity: data.signal.severity,
        confidence: data.signal.confidence,
        error: data.signal.error,
      },
      evidence: data.evidence.map((item) => ({
        id: item._id,
        kind: item.kind,
        provider: item.provider,
        url: item.url,
        title: item.title,
        fragment: item.fragment,
        confidence: item.confidence,
        observedAt: item.observedAt,
      })),
      competitor: {
        name: data.competitor.name,
        url: data.competitor.url,
      },
      source: {
        url: data.source.url,
        label: data.source.label,
      },
    },
  };
}

export function extractPrice(state: string): number | null {
  const match = state.match(/\$(\d+)/);
  return match ? Number.parseInt(match[1], 10) : null;
}

export function formatPriceDelta(
  previousState: string,
  currentState: string,
): { label: string; pct: number } | null {
  const before = extractPrice(previousState);
  const after = extractPrice(currentState);
  if (before == null || after == null || before === 0) {
    return null;
  }

  const pct = Math.round(((after - before) / before) * 100);
  const sign = pct >= 0 ? "+" : "−";
  return { label: `${sign}${Math.abs(pct)}%`, pct };
}

export function parseDiffLines(fragment: string): DiffLine[] {
  return fragment
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.startsWith("+")) {
        return { type: "add" as const, text: line.slice(1).trim() };
      }
      if (line.startsWith("-")) {
        return { type: "remove" as const, text: line.slice(1).trim() };
      }
      return { type: "add" as const, text: line };
    });
}

export function findDiffFragment(evidence: EvidenceItem[]): string | null {
  const diff = evidence.find((item) => item.kind === "diff");
  return diff?.fragment ?? null;
}

export function buildDiffLines(
  evidence: EvidenceItem[],
  previousState: string,
  currentState: string,
): DiffLine[] {
  const fragment = findDiffFragment(evidence);
  if (fragment) {
    return parseDiffLines(fragment);
  }
  if (previousState && currentState && previousState !== currentState) {
    return [
      { type: "remove", text: previousState },
      { type: "add", text: currentState },
    ];
  }
  return [];
}

/**
 * Rewrites fixture/placeholder mock host URLs to the live Convex site mock
 * so Evidence links open a working pricing page in the demo.
 */
export function resolveEvidenceUrl(url: string): string {
  const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined)?.replace(
    /\/$/,
    "",
  );

  if (!siteUrl) {
    return url;
  }

  if (url.startsWith("/mock/")) {
    return `${siteUrl}${url}`;
  }

  try {
    const parsed = new URL(url);
    const isMockHost = parsed.hostname === "acmeflow.example";
    const isMockPath = parsed.pathname.includes("/mock/");

    if (isMockHost || isMockPath) {
      const path = isMockPath ? parsed.pathname : "/mock/acmeflow/pricing";
      return `${siteUrl}${path}${parsed.search}`;
    }
  } catch {
    return url;
  }

  return url;
}

function DiffSkeleton() {
  return (
    <section
      aria-busy="true"
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        Diffing snapshots
      </p>
      <div className="mt-[var(--space-3)] flex flex-wrap items-baseline gap-x-[var(--space-3)] gap-y-[var(--space-2)]">
        <span className="font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text-muted)]">
          Pro $49/mo
        </span>
        <span
          className="font-[family-name:var(--font-mono)] text-[32px] text-[var(--color-text-muted)]"
          aria-hidden
        >
          →
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text-muted)]">
          Pro $39/mo
        </span>
      </div>
      <div className="mt-[var(--space-4)] space-y-[var(--space-2)]">
        <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--palette-border)]" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--palette-border)]" />
      </div>
    </section>
  );
}

function DiffEmpty() {
  return (
    <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
      <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted)]">
        No price diff for this signal
      </p>
    </section>
  );
}

function DiffError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-4)]">
      <p className="font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
        Diff unavailable
      </p>
      <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </section>
  );
}

function DiffReady({ bundle }: { bundle: SignalBundle }) {
  const { signal, evidence } = bundle;
  const delta = formatPriceDelta(signal.previousState, signal.currentState);
  const diffLines = buildDiffLines(
    evidence,
    signal.previousState,
    signal.currentState,
  );
  const useAccentDelta =
    signal.severity === "high" || signal.severity === "critical";

  if (!signal.previousState && !signal.currentState) {
    return <DiffEmpty />;
  }

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        Fact · {signal.type.replace(/_/g, " ")}
      </p>
      <div className="mt-[var(--space-3)] flex flex-wrap items-baseline gap-x-[var(--space-3)] gap-y-[var(--space-2)]">
        <span className="font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text-muted)]">
          {signal.previousState}
        </span>
        <span
          className="font-[family-name:var(--font-mono)] text-[32px] text-[var(--color-text-muted)]"
          aria-label="changed to"
        >
          →
        </span>
        <span className="font-[family-name:var(--font-mono)] text-[48px] font-[number:var(--weight-black)] leading-none text-[var(--color-text)]">
          {signal.currentState}
        </span>
        {delta ? (
          <span
            className={cn(
              "font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold)]",
              useAccentDelta
                ? "text-[var(--palette-accent)]"
                : "text-[var(--color-text)]",
            )}
            aria-label={`Price change ${delta.label}`}
          >
            {delta.label}
          </span>
        ) : null}
      </div>
      {diffLines.length > 0 ? (
        <ul className="mt-[var(--space-4)] space-y-[var(--space-1)] font-[family-name:var(--font-mono)] text-[13px]">
          {diffLines.map((line) => (
            <li
              key={`${line.type}-${line.text}`}
              className={
                line.type === "add"
                  ? "text-[var(--palette-ok)]"
                  : "text-[var(--palette-accent)]"
              }
            >
              {line.type === "add" ? "+ " : "− "}
              {line.text}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function DiffView({ signalId }: BlockProps) {
  const state = useSignalBundle(signalId);

  if (state.kind === "loading") {
    return <DiffSkeleton />;
  }

  if (state.kind === "empty") {
    return <DiffEmpty />;
  }

  if (state.kind === "error") {
    return (
      <DiffError
        message={state.message}
        onRetry={() => {
          window.location.reload();
        }}
      />
    );
  }

  return <DiffReady bundle={state.data} />;
}

export default DiffView;
