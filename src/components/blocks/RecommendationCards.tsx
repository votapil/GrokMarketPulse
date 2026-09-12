import { useState } from "react";
import { useAction } from "convex/react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Doc, Id } from "../../../convex/_generated/dataModel";

export type Recommendation = Doc<"signals">["recommendations"][number];

type LoadState = "loading" | "empty" | "error" | "ready";

type RecommendationCardsProps = {
  signalId: Id<"signals">;
  recommendations?: Recommendation[];
  loadState?: LoadState;
  errorMessage?: string | null;
  onRetry?: () => void;
};

const effortLabel: Record<Recommendation["effort"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const riskLabel: Record<Recommendation["risk"], string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

function SkeletonCard() {
  return (
    <article
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
      aria-hidden
    >
      <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--palette-border)]" />
      <div className="mt-[var(--space-3)] h-3 w-full animate-pulse rounded bg-[var(--palette-border)]" />
      <div className="mt-[var(--space-2)] h-3 w-5/6 animate-pulse rounded bg-[var(--palette-border)]" />
      <div className="mt-[var(--space-4)] grid grid-cols-2 gap-[var(--space-2)]">
        <div className="h-8 animate-pulse rounded bg-[var(--palette-border)]" />
        <div className="h-8 animate-pulse rounded bg-[var(--palette-border)]" />
      </div>
      <div className="mt-[var(--space-4)] h-9 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--palette-border)]" />
    </article>
  );
}

function RecommendationCard({
  recommendation,
  isGenerating,
  isDisabled,
  onGenerate,
}: {
  recommendation: Recommendation;
  isGenerating: boolean;
  isDisabled: boolean;
  onGenerate: (recommendationId: string) => void;
}) {
  if (isGenerating) {
    return <SkeletonCard />;
  }

  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]">
      <div className="flex items-start justify-between gap-[var(--space-2)]">
        <h4 className="font-[family-name:var(--font-sans)] text-[16px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
          {recommendation.title}
        </h4>
        <span className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--palette-amber)]">
          P{recommendation.priority}
        </span>
      </div>

      <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
        {recommendation.action}
      </p>

      <p className="mt-[var(--space-2)] text-[13px] text-[var(--color-text-muted)]">
        {recommendation.rationale}
      </p>

      <dl className="mt-[var(--space-3)] grid grid-cols-2 gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px]">
        <div>
          <dt className="text-[var(--color-text-muted)]">Impact</dt>
          <dd className="text-[var(--color-text)]">{recommendation.expectedImpact}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Effort</dt>
          <dd className="text-[var(--color-text)]">{effortLabel[recommendation.effort]}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Risk</dt>
          <dd className="text-[var(--color-text)]">{riskLabel[recommendation.risk]}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-text-muted)]">Type</dt>
          <dd className="capitalize text-[var(--color-text)]">{recommendation.artifactType}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={() => onGenerate(recommendation.id)}
        disabled={isDisabled}
        aria-label={`Generate artifact for ${recommendation.title}`}
        className="mt-[var(--space-4)] w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)] transition-colors hover:bg-[var(--palette-recessed)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-border)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        Generate
      </button>
    </article>
  );
}

export function RecommendationCards({
  signalId,
  recommendations = [],
  loadState = "ready",
  errorMessage,
  onRetry,
}: RecommendationCardsProps) {
  const navigate = useNavigate();
  const generate = useAction(api.act.generate);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const handleGenerate = async (recommendationId: string) => {
    setGenerateError(null);
    setGeneratingId(recommendationId);
    try {
      const { artifactId } = await generate({ signalId, recommendationId });
      void navigate(`/artifact/${artifactId}`);
    } catch (error) {
      setGeneratingId(null);
      setGenerateError(
        error instanceof Error ? error.message : "Artifact generation failed",
      );
    }
  };

  if (loadState === "loading") {
    return (
      <div
        className="flex flex-col gap-[var(--space-3)]"
        aria-busy="true"
        aria-label="Loading recommendations"
      >
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadState === "empty") {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] text-center">
        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          No recommendations yet
        </p>
        <p className="mt-[var(--space-1)] text-[13px] text-[var(--color-text-muted)]">
          Wait for assessment
        </p>
      </div>
    );
  }

  if (loadState === "error") {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-4)]">
        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          Recommendations failed
        </p>
        {errorMessage ? (
          <p className="mt-[var(--space-1)] text-[13px] text-[var(--color-text-muted)]">
            {errorMessage}
          </p>
        ) : null}
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            Retry
          </button>
        ) : null}
      </div>
    );
  }

  const sorted = [...recommendations]
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  return (
    <div className="flex flex-col gap-[var(--space-3)]">
      {generateError ? (
        <p
          className="rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] px-[var(--space-3)] py-[var(--space-2)] text-[13px] text-[var(--color-text)]"
          role="alert"
        >
          {generateError}
        </p>
      ) : null}
      {sorted.map((recommendation) => (
        <RecommendationCard
          key={recommendation.id}
          recommendation={recommendation}
          isGenerating={generatingId === recommendation.id}
          isDisabled={generatingId !== null}
          onGenerate={(id) => void handleGenerate(id)}
        />
      ))}
    </div>
  );
}
