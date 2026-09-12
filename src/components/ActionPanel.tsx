import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { RecommendationCards } from "@/components/blocks/RecommendationCards";
import { resolveEvidenceUrl } from "@/components/blocks/DiffView";
import { cn } from "@/lib/utils";

type ActionPanelProps = {
  signalId: Id<"signals"> | null;
};

function SectionSkeleton({ label }: { label: string }) {
  return (
    <section
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]"
      aria-hidden
    >
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="mt-[var(--space-3)] space-y-[var(--space-2)]">
        <div className="h-3 w-full animate-pulse rounded bg-[var(--palette-border)]" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-[var(--palette-border)]" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--palette-border)]" />
      </div>
    </section>
  );
}

function AssessingSkeleton({ signalId }: { signalId: Id<"signals"> }) {
  return (
    <div className="flex flex-col gap-[var(--space-4)]" aria-busy="true" aria-label="Assessing signal">
      <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-wide text-[var(--color-text-muted)]">
        Assessing…
      </p>
      <SectionSkeleton label="Fact" />
      <SectionSkeleton label="Evidence" />
      <SectionSkeleton label="AI analysis" />
      <RecommendationCards signalId={signalId} loadState="loading" />
    </div>
  );
}

function FactSection({
  title,
  summary,
  previousState,
  currentState,
}: {
  title: string;
  summary: string;
  previousState: string;
  currentState: string;
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
      <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        Fact
      </h3>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[14px] text-[var(--color-text)]">
        {title}
      </p>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
        {previousState} → {currentState}
      </p>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text-muted)]">
        {summary}
      </p>
    </section>
  );
}

function EvidenceSection({
  sourceUrl,
  evidenceUrls,
}: {
  sourceUrl: string;
  evidenceUrls: string[];
}) {
  const urls = (evidenceUrls.length > 0 ? evidenceUrls : [sourceUrl])
    .map((url) => resolveEvidenceUrl(url))
    .filter((url) => url !== "#" && /^https?:\/\//i.test(url));

  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-3)]">
      <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        Evidence
      </h3>
      {urls.length === 0 ? (
        <p className="mt-[var(--space-2)] text-[13px] text-[var(--color-text-muted)]">
          No safe evidence links
        </p>
      ) : (
        <ul className="mt-[var(--space-2)] space-y-[var(--space-1)]">
          {urls.slice(0, 3).map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate font-[family-name:var(--font-mono)] text-[13px] text-[var(--palette-info)] hover:underline"
              >
                {url.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function AiAnalysisSection({
  why,
  positionChange,
  affectedSegments,
  affectedAreas,
  reactionSpeed,
  scoreExplanation,
}: {
  why: string;
  positionChange: string;
  affectedSegments: string[];
  affectedAreas: string[];
  reactionSpeed: string;
  scoreExplanation: string;
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-3)]">
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="h-2 w-2 rounded-full bg-[var(--palette-info)]" aria-hidden />
        <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text)]">
          AI analysis
        </h3>
      </div>
      <p className="mt-[var(--space-1)] text-[11px] text-[var(--color-text-muted)]">
        Model inference — verify against evidence
      </p>

      <div className="mt-[var(--space-3)] space-y-[var(--space-3)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">
            Why it matters
          </p>
          <p className="mt-[var(--space-1)]">{why}</p>
        </div>

        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">
            Position change
          </p>
          <p className="mt-[var(--space-1)]">{positionChange}</p>
        </div>

        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">
            Affected segments
          </p>
          <p className="mt-[var(--space-1)]">{affectedSegments.join(", ")}</p>
          {affectedAreas.length > 0 ? (
            <p className="mt-[var(--space-1)] text-[13px] text-[var(--color-text-muted)]">
              Areas: {affectedAreas.join(", ")}
            </p>
          ) : null}
        </div>

        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">
            Reaction speed
          </p>
          <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)]">{reactionSpeed}</p>
        </div>

        <div>
          <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]">
            Score explanation
          </p>
          <p className="mt-[var(--space-1)]">{scoreExplanation}</p>
        </div>
      </div>
    </section>
  );
}

function LowConfidenceBanner({ confidence }: { confidence: number }) {
  return (
    <div
      className="rounded-[var(--radius-md)] border border-[var(--palette-amber)] bg-[var(--color-surface)] p-[var(--space-3)]"
      role="status"
    >
      <div className="flex items-center gap-[var(--space-2)]">
        <span className="h-2 w-2 rounded-full bg-[var(--palette-amber)]" aria-hidden />
        <p className="font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
          Low confidence assessment
        </p>
      </div>
      <p className="mt-[var(--space-2)] text-[13px] text-[var(--color-text-muted)]">
        Grok scored this signal at {Math.round(confidence * 100)}% confidence. Treat
        recommendations as hypotheses until evidence improves.
      </p>
    </div>
  );
}

function ErrorPanel({
  message,
  onRetry,
  isRetrying,
}: {
  message: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-4)]">
      <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
        Assessment failed
      </p>
      <p className="mt-[var(--space-2)] text-[13px] text-[var(--color-text-muted)]">{message}</p>
      <button
        type="button"
        onClick={() => void onRetry()}
        disabled={isRetrying}
        className={cn(
          "mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]",
          isRetrying && "opacity-50",
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")} aria-hidden />
        Retry
      </button>
    </div>
  );
}

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <aside
      className="flex w-[320px] flex-col gap-[var(--space-4)] overflow-y-auto border-l border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-4)]"
      aria-label="Action panel"
    >
      {children}
    </aside>
  );
}

export function ActionPanel({ signalId }: ActionPanelProps) {
  const data = useQuery(api.signals.get, signalId ? { signalId } : "skip");
  const verifyAgain = useAction(api.verify.again);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);

  const handleRetry = async () => {
    if (!signalId || isRetrying) return;
    setIsRetrying(true);
    setRetryError(null);
    try {
      await verifyAgain({ signalId });
    } catch (error) {
      setRetryError(
        error instanceof Error ? error.message : "Retry failed",
      );
    } finally {
      setIsRetrying(false);
    }
  };

  if (!signalId) {
    return (
      <PanelShell>
        <p className="text-[14px] text-[var(--color-text-muted)]">
          Select a signal to see assessment
        </p>
      </PanelShell>
    );
  }

  if (data === undefined) {
    return (
      <PanelShell>
        <AssessingSkeleton signalId={signalId} />
      </PanelShell>
    );
  }

  if (data === null) {
    return (
      <PanelShell>
        <p className="text-[14px] text-[var(--color-text-muted)]">Signal not found</p>
      </PanelShell>
    );
  }

  const { signal, evidence, source } = data;
  const isError = signal.status === "error";
  const isLowConfidence = signal.status === "low_confidence";
  const isAssessing = !signal.assessment && !isError;
  const evidenceUrls = evidence.map((item) => item.url);

  if (isError) {
    return (
      <PanelShell>
        <ErrorPanel
          message={
            retryError ??
            signal.error ??
            "Something went wrong while assessing this signal."
          }
          onRetry={() => void handleRetry()}
          isRetrying={isRetrying}
        />
      </PanelShell>
    );
  }

  if (isAssessing) {
    return (
      <PanelShell>
        <AssessingSkeleton signalId={signalId} />
      </PanelShell>
    );
  }

  const recommendationsLoadState =
    signal.recommendations.length === 0 ? "empty" : "ready";

  return (
    <PanelShell>
      {isLowConfidence ? <LowConfidenceBanner confidence={signal.confidence} /> : null}

      {signal.assessment ? (
        <>
          <FactSection
            title={signal.title}
            summary={signal.summary}
            previousState={signal.previousState}
            currentState={signal.currentState}
          />

          <EvidenceSection sourceUrl={source.url} evidenceUrls={evidenceUrls} />

          <AiAnalysisSection
            why={signal.assessment.why}
            positionChange={signal.assessment.positionChange}
            affectedSegments={signal.assessment.affectedSegments}
            affectedAreas={signal.assessment.affectedAreas}
            reactionSpeed={signal.assessment.reactionSpeed}
            scoreExplanation={signal.assessment.scoreExplanation}
          />
        </>
      ) : null}

      <RecommendationCards
        signalId={signalId}
        recommendations={signal.recommendations}
        loadState={recommendationsLoadState}
        errorMessage={signal.error}
        onRetry={() => void handleRetry()}
      />
    </PanelShell>
  );
}
