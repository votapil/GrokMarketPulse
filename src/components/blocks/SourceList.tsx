import { useCallback, useId, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { ExternalLink, Globe, RefreshCw } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { resolveEvidenceUrl, useSignalBundle, type EvidenceItem } from "./DiffView";
import { formatConfidence, formatDetectedAt, providerBadgeFor } from "./EvidenceCard";
import {
  BlockEmpty,
  BlockError,
  BlockLoading,
  isFixtureId,
  signalIdFromBlock,
  type BlockComponentProps,
} from "./registry";

/**
 * T-24: блок «External sources» — зона Evidence (recessed, бейдж провайдера,
 * mono-URL в palette/info). Показывает только evidence `kind === "exa_source"`;
 * внутренние snapshot/diff-строки — работа EvidenceCard, здесь лишь счётчик.
 * Кнопка `Verify with external sources` дёргает `api.verify.again`; прогресс и
 * ошибку прогона берём из `api.runs.latest` (kind "verify"). T-23 наполняет
 * exa-строки асинхронно — блок реактивно подхватит их через useSignalBundle.
 * Callers: registry (`SourceList: SourceListBlock`).
 */

const TITLE = "External sources";

/** One `exa_source` evidence row with its sanitised href (never "#"). */
export type ExternalSourceItem = EvidenceItem & { href: string };

/** Current step of a running verify run — shown as a dashed mono line. */
export type VerifyProgress = { label: string; detail: string };

export type SourceListProps = {
  items: ExternalSourceItem[];
  onVerify: () => void;
  isVerifying: boolean;
  progress: VerifyProgress | null;
  error: string | null;
  /** Non-external evidence rows (snapshots/diff) — listed by EvidenceCard, only counted here. */
  internalEvidenceCount?: number;
  /** When set, the Verify button renders disabled with this reason (fixture signals). */
  verifyUnavailableReason?: string | null;
};

type VerifyRun = Doc<"runs">;

type ExternalSourcesState =
  | { kind: "loading" }
  | { kind: "empty"; message: string }
  | { kind: "error"; message: string }
  | { kind: "ready"; props: SourceListProps };

function selectExternalSources(evidence: EvidenceItem[]): ExternalSourceItem[] {
  return evidence
    .filter((item) => item.kind === "exa_source")
    .map((item) => ({ ...item, href: resolveEvidenceUrl(item.url) }))
    .filter((item) => item.href !== "#")
    .sort((a, b) => b.confidence - a.confidence || b.observedAt - a.observedAt);
}

function countInternalEvidence(evidence: EvidenceItem[]): number {
  return evidence.filter((item) => item.kind !== "exa_source").length;
}

function progressFromRun(run: VerifyRun): VerifyProgress {
  const step =
    run.steps.find((candidate) => candidate.status === "running") ??
    run.steps[run.steps.length - 1];
  if (!step) {
    return { label: "External verify", detail: "Running" };
  }
  return { label: step.label, detail: step.detail };
}

/**
 * Bundle + latest verify run + `verify.again` action in one place. Fixture ids
 * never touch Convex: the button renders disabled with an explanation instead.
 */
function useExternalSources(signalId: string | undefined): ExternalSourcesState {
  const isFixture = signalId !== undefined && isFixtureId(signalId);
  const isLive = signalId !== undefined && !isFixture;

  const bundle = useSignalBundle(signalId);
  const demo = useQuery(api.workspace.demo, isLive ? {} : "skip");
  const workspaceId = demo?.workspace._id;
  const latestRun = useQuery(
    api.runs.latest,
    isLive && workspaceId !== undefined ? { workspaceId } : "skip",
  );
  const verifyAgain = useAction(api.verify.again);

  // Keyed by signal so an in-flight promise or stale failure never leaks onto
  // the next signal when the block is reused for another id.
  const [pendingFor, setPendingFor] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ signalId: string; message: string } | null>(
    null,
  );

  const isPending = signalId !== undefined && pendingFor === signalId;
  const actionError =
    failure !== null && failure.signalId === signalId ? failure.message : null;

  const verify = useCallback(() => {
    if (signalId === undefined || isFixture || isPending) {
      return;
    }
    setPendingFor(signalId);
    setFailure(null);
    void verifyAgain({ signalId: signalId as Id<"signals"> })
      .catch((error: unknown) => {
        setFailure({
          signalId,
          message:
            error instanceof Error ? error.message : "Verification request failed",
        });
      })
      .finally(() => {
        setPendingFor((current) => (current === signalId ? null : current));
      });
  }, [isFixture, isPending, signalId, verifyAgain]);

  if (signalId === undefined) {
    return { kind: "empty", message: "No signal attached to this block" };
  }
  if (bundle.kind === "loading") {
    return { kind: "loading" };
  }
  if (bundle.kind === "empty") {
    return { kind: "empty", message: "Signal not found" };
  }
  if (bundle.kind === "error") {
    return { kind: "error", message: bundle.message };
  }

  // Only this signal's verify run drives the block — a run for a sibling
  // signal in the same workspace must not show progress here.
  const verifyRun =
    latestRun && latestRun.kind === "verify" && latestRun.signalId === signalId
      ? latestRun
      : null;
  const runActive = verifyRun?.status === "running";
  const runError =
    verifyRun?.status === "error"
      ? (verifyRun.error ?? "External verification failed")
      : null;

  return {
    kind: "ready",
    props: {
      items: selectExternalSources(bundle.data.evidence),
      internalEvidenceCount: countInternalEvidence(bundle.data.evidence),
      onVerify: verify,
      isVerifying: isPending || runActive,
      progress: verifyRun && runActive ? progressFromRun(verifyRun) : null,
      error: actionError ?? runError,
      verifyUnavailableReason: isFixture ? "Available on live signals" : null,
    },
  };
}

const outlineButton = cn(
  "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--color-surface)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

const captionMono =
  "font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]";

function VerifyButton({
  label,
  onVerify,
  isVerifying,
  unavailableReason,
  describedBy,
}: {
  label: string;
  onVerify: () => void;
  isVerifying: boolean;
  unavailableReason: string | null;
  describedBy?: string;
}) {
  const Icon = isVerifying ? RefreshCw : Globe;

  return (
    <button
      type="button"
      onClick={onVerify}
      disabled={isVerifying || unavailableReason !== null}
      aria-busy={isVerifying}
      aria-describedby={describedBy}
      title={unavailableReason ?? undefined}
      className={cn(outlineButton, "shrink-0")}
    >
      <Icon className={cn("h-3.5 w-3.5", isVerifying && "animate-spin")} aria-hidden />
      {isVerifying ? "Verifying…" : label}
    </button>
  );
}

function VerifyProgressLine({ progress }: { progress: VerifyProgress }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-[var(--space-3)] flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px]"
    >
      <RefreshCw
        className="h-3.5 w-3.5 shrink-0 animate-spin text-[var(--color-text-muted)]"
        aria-hidden
      />
      <span className="shrink-0 uppercase tracking-wide text-[var(--color-text)]">
        {progress.label}
      </span>
      <span className="truncate text-[var(--color-text-muted)]">{progress.detail}</span>
    </div>
  );
}

function VerifyErrorLine({
  message,
  onVerify,
  isVerifying,
  unavailableReason,
}: {
  message: string;
  onVerify: () => void;
  isVerifying: boolean;
  unavailableReason: string | null;
}) {
  return (
    <div
      role="alert"
      className="mt-[var(--space-3)] flex flex-wrap items-center justify-between gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)]"
    >
      <p className="min-w-0 font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text)]">
        <span className="font-[number:var(--weight-medium)]">Verification failed</span>
        <span className="text-[var(--color-text-muted)]"> — {message}</span>
      </p>
      <VerifyButton
        label="Retry"
        onVerify={onVerify}
        isVerifying={isVerifying}
        unavailableReason={unavailableReason}
      />
    </div>
  );
}

function ExternalEmpty() {
  return (
    <div className="mt-[var(--space-3)] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] p-[var(--space-4)]">
      <div className="flex items-center gap-[var(--space-2)]">
        <Globe className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden />
        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          No external confirmation found
        </p>
      </div>
      <p className="mt-[var(--space-1)] font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text-muted)]">
        Verify with external sources searches the web for independent mentions of this
        change.
      </p>
    </div>
  );
}

function SourceRow({ item }: { item: ExternalSourceItem }) {
  const badge = providerBadgeFor(item);
  const isHighConfidence = item.confidence >= 0.8;

  return (
    <li>
      <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-[var(--space-3)]">
        <div className="flex flex-wrap items-center justify-between gap-[var(--space-2)]">
          <span className="rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text)]">
            {badge}
          </span>
          <time dateTime={new Date(item.observedAt).toISOString()} className={captionMono}>
            Observed {formatDetectedAt(item.observedAt)} UTC
          </time>
        </div>
        <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          {item.title}
        </p>
        <a
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-[var(--space-1)] flex items-center gap-[var(--space-1)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--palette-info)] underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]"
        >
          <span className="truncate">{item.href}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        <blockquote className="mt-[var(--space-2)] line-clamp-3 border-l-2 border-[var(--color-border)] pl-[var(--space-3)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
          &ldquo;{item.fragment.replace(/\n/g, " · ")}&rdquo;
        </blockquote>
        <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text)]">
          Confidence{" "}
          <span
            className={isHighConfidence ? "text-[var(--palette-ok)]" : "text-[var(--color-text)]"}
          >
            {formatConfidence(item.confidence)}
          </span>
        </p>
      </article>
    </li>
  );
}

/** Presentational block — every prop already loaded; no Convex inside. */
export function SourceList({
  items,
  onVerify,
  isVerifying,
  progress,
  error,
  internalEvidenceCount = 0,
  verifyUnavailableReason = null,
}: SourceListProps) {
  const hintId = useId();
  const count = items.length;
  const describedBy = verifyUnavailableReason !== null ? hintId : undefined;

  return (
    <section
      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]"
      data-block-state={
        count > 0 ? "ready" : isVerifying ? "loading" : "empty"
      }
      aria-label={TITLE}
      aria-busy={isVerifying}
    >
      <header className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-mono)] text-[11px] font-[number:var(--weight-medium)] uppercase tracking-wider text-[var(--color-text-muted)]">
            {TITLE}
          </h3>
          <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text)]">
            {count} external source{count === 1 ? "" : "s"}
          </p>
          <p className={captionMono}>
            Internal evidence: {internalEvidenceCount} snapshot row
            {internalEvidenceCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-col items-end gap-[var(--space-1)]">
          <VerifyButton
            label="Verify with external sources"
            onVerify={onVerify}
            isVerifying={isVerifying}
            unavailableReason={verifyUnavailableReason}
            describedBy={describedBy}
          />
          {verifyUnavailableReason !== null ? (
            <span id={hintId} className={captionMono}>
              {verifyUnavailableReason}
            </span>
          ) : null}
        </div>
      </header>

      {progress ? <VerifyProgressLine progress={progress} /> : null}

      {error ? (
        <VerifyErrorLine
          message={error}
          onVerify={onVerify}
          isVerifying={isVerifying}
          unavailableReason={verifyUnavailableReason}
        />
      ) : null}

      {/* Empty copy is the finished outcome — hide it while a verify run is in flight. */}
      {count === 0 && !isVerifying ? (
        <ExternalEmpty />
      ) : count > 0 ? (
        <ol className="mt-[var(--space-3)] space-y-[var(--space-2)]" aria-label="External sources by confidence">
          {items.map((item) => (
            <SourceRow key={item.id} item={item} />
          ))}
        </ol>
      ) : null}
    </section>
  );
}

export function SourceListBlock({ block }: BlockComponentProps) {
  const state = useExternalSources(signalIdFromBlock(block));

  if (state.kind === "loading") {
    return <BlockLoading title={TITLE} />;
  }
  if (state.kind === "empty") {
    return <BlockEmpty title={TITLE} message={state.message} />;
  }
  if (state.kind === "error") {
    return <BlockError title={TITLE} message={state.message} />;
  }
  return <SourceList {...state.props} />;
}
