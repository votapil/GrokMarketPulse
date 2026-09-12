import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ArtifactBody, type ArtifactPayload } from "@/components/artifacts/ArtifactBody";
import { battlecardMarkdown } from "@/components/artifacts/Battlecard";
import { landingMarkdown } from "@/components/artifacts/LandingPreview";
import { offerMarkdown } from "@/components/artifacts/OfferCard";
import { isFixtureId } from "@/components/blocks/registry";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import {
  fixtureArtifactBattlecard,
  fixtureArtifactLanding,
  fixtureArtifactOffer,
  fixtureAssessment,
  fixtureRecommendations,
  fixtureSignal,
} from "@/lib/fixtures";

const FIXTURES = {
  [fixtureArtifactLanding.id]: fixtureArtifactLanding,
  [fixtureArtifactBattlecard.id]: fixtureArtifactBattlecard,
  [fixtureArtifactOffer.id]: fixtureArtifactOffer,
} as const;

type RecommendationFields = {
  id: string;
  title: string;
  action: string;
  expectedImpact: string;
  priority: number;
  artifactType: string;
};

type AssessmentFields = {
  why: string;
  positionChange: string;
};

function pickViewedRecommendation(
  recommendations: readonly RecommendationFields[],
  recommendationId: string,
): RecommendationFields | undefined {
  return recommendations.find((row) => row.id === recommendationId);
}

function lowestPriorityRecommendation(
  recommendations: readonly RecommendationFields[],
): RecommendationFields | undefined {
  return recommendations.reduce<RecommendationFields | undefined>((best, row) => {
    if (!best || row.priority < best.priority) return row;
    return best;
  }, undefined);
}

function pickLandingRecommendation(
  recommendations: readonly RecommendationFields[],
): RecommendationFields | undefined {
  const landing = recommendations.find((row) => row.artifactType === "landing");
  if (landing) return landing;
  const priorityOne = recommendations.find((row) => row.priority === 1);
  if (priorityOne) return priorityOne;
  return lowestPriorityRecommendation(recommendations);
}

function summaryCopy(
  assessment: AssessmentFields | null | undefined,
  recommendation: RecommendationFields | undefined,
): { changed: string; response: string } {
  const changed = assessment
    ? `${assessment.why} ${assessment.positionChange}`.trim()
    : "";
  const response = recommendation
    ? `${recommendation.action} ${recommendation.expectedImpact}`.trim()
    : "";
  return { changed, response };
}

function landingCaption(
  recommendation: RecommendationFields | undefined,
  loading: boolean,
): string {
  if (loading) return "Loading recommendation…";
  if (!recommendation) return "No recommendation available to build from";
  return `Landing page built from “${recommendation.title}”`;
}

function artifactMarkdown(payload: ArtifactPayload): string {
  if (payload.type === "battlecard") return battlecardMarkdown(payload);
  if (payload.type === "offer") return offerMarkdown(payload);
  if (payload.type === "landing") return landingMarkdown(payload);
  return "";
}

export function ArtifactScreen() {
  const { artifactId } = useParams();
  const navigate = useNavigate();
  const generate = useAction(api.act.generate);
  const [copyLabel, setCopyLabel] = useState("Copy");
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const fixture = artifactId ? FIXTURES[artifactId as keyof typeof FIXTURES] : undefined;
  const isFixture = Boolean(artifactId && isFixtureId(artifactId));

  const live = useQuery(
    api.artifacts.get,
    artifactId && !isFixture ? { artifactId: artifactId as Id<"artifacts"> } : "skip",
  );
  const liveSignal = useQuery(
    api.signals.get,
    live && !isFixture ? { signalId: live.signalId } : "skip",
  );

  const artifact = isFixture ? fixture : live;

  const view = useMemo(() => {
    if (isFixture && fixture) {
      const viewedRec = pickViewedRecommendation(
        fixtureRecommendations,
        fixture.recommendationId,
      );
      const landingRec = pickLandingRecommendation(fixtureRecommendations);
      return {
        signalTitle: fixtureSignal.title,
        recTitle: viewedRec?.title ?? fixture.recommendationId,
        assessment: fixtureAssessment,
        viewedRec,
        landingRec,
      };
    }
    if (live && liveSignal) {
      const recommendations = liveSignal.signal.recommendations;
      const viewedRec = pickViewedRecommendation(recommendations, live.recommendationId);
      const landingRec = pickLandingRecommendation(recommendations);
      return {
        signalTitle: liveSignal.signal.title,
        recTitle: viewedRec?.title ?? live.recommendationId,
        assessment: liveSignal.signal.assessment,
        viewedRec,
        landingRec,
      };
    }
    return {
      signalTitle: "Signal",
      recTitle: "Recommendation",
      assessment: null as AssessmentFields | null,
      viewedRec: undefined as RecommendationFields | undefined,
      landingRec: undefined as RecommendationFields | undefined,
    };
  }, [fixture, isFixture, live, liveSignal]);

  const summary = summaryCopy(view.assessment, view.viewedRec);
  const isLoadingLive = Boolean(artifactId && !isFixture && live === undefined);
  const isLoadingSignal = Boolean(live && !liveSignal && !isFixture);
  const caption = landingCaption(view.landingRec, isLoadingSignal);
  const isPending =
    generating || artifact?.status === "pending" || isLoadingLive;
  const canCopy = Boolean(artifact && artifact.status === "ready" && !isPending);
  const canGenerate =
    Boolean(view.landingRec) &&
    !generating &&
    !(artifact?.status === "pending" && artifact.type === "landing");

  async function onCopy() {
    if (!artifact || artifact.status !== "ready") return;
    const markdown = artifactMarkdown(artifact.payload);
    await navigator.clipboard.writeText(markdown);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  async function onGenerateLanding() {
    if (!view.landingRec) return;
    if (isFixture) {
      void navigate(`/artifact/${fixtureArtifactLanding.id}`);
      return;
    }
    if (!live) return;
    setGenerateError(null);
    setGenerating(true);
    try {
      const { artifactId: createdId } = await generate({
        signalId: live.signalId,
        recommendationId: view.landingRec.id,
      });
      void navigate(`/artifact/${createdId}`);
    } catch (error) {
      setGenerateError(
        error instanceof Error ? error.message : "Landing page generation failed",
      );
    } finally {
      setGenerating(false);
    }
  }

  if (!artifactId) {
    return (
      <div className="p-[var(--space-6)]">
        <EmptyState
          title="No artifact selected"
          body="Open Pulse, pick a recommendation, then Generate."
        />
      </div>
    );
  }

  if (!isLoadingLive && !artifact) {
    return (
      <div className="p-[var(--space-6)]">
        <EmptyState
          title="Artifact not found"
          body={`Nothing stored for ${artifactId}. Generate one from a recommendation.`}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-6)]">
      {summary.changed || summary.response ? (
        <section
          aria-labelledby="artifact-summary-heading"
          className="max-w-[72ch]"
        >
          <h2
            id="artifact-summary-heading"
            className="font-[family-name:var(--font-mono)] text-[12px] uppercase text-[var(--color-text-muted)]"
          >
            Summary
          </h2>
          {summary.changed ? (
            <p className="mt-[var(--space-2)] text-[20px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
              {summary.changed}
            </p>
          ) : null}
          {summary.response ? (
            <p className="mt-[var(--space-2)] flex items-start gap-[var(--space-2)] text-[20px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
              <span
                aria-hidden="true"
                className="mt-[var(--space-2)] h-2 w-2 shrink-0 rounded-full bg-[var(--color-accent)]"
              />
              <span>{summary.response}</span>
            </p>
          ) : null}
        </section>
      ) : null}

      <nav
        aria-label="Artifact trail"
        className="flex flex-wrap items-center gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[12px] uppercase text-[var(--color-text-muted)]"
      >
        <Link to="/" className="text-[var(--color-text)] underline-offset-4 hover:underline">
          {view.signalTitle}
        </Link>
        <span aria-hidden="true">→</span>
        <span>{view.recTitle}</span>
        <span aria-hidden="true">→</span>
        <span className="text-[var(--color-text)]">{artifact?.type ?? "Artifact"}</span>
      </nav>

      <div className="flex flex-wrap items-start justify-between gap-[var(--space-3)]">
        <h1 className="text-[20px] font-[number:var(--weight-bold)]">Artifact</h1>
        <div className="flex flex-col items-end gap-[var(--space-2)]">
          <div className="flex flex-wrap items-center justify-end gap-[var(--space-3)]">
            <button
              type="button"
              onClick={() => void onCopy()}
              disabled={!canCopy}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copyLabel}
            </button>
            <button
              type="button"
              onClick={() => void onGenerateLanding()}
              disabled={!canGenerate}
              aria-describedby="landing-generate-caption"
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-medium)] text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generate landing page
            </button>
          </div>
          <p
            id="landing-generate-caption"
            className="max-w-[42ch] text-right font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]"
          >
            {caption}
          </p>
        </div>
      </div>

      {generateError ? (
        <ErrorState
          title="Landing page failed"
          body={generateError}
          actionLabel="Retry"
          onRetry={() => void onGenerateLanding()}
        />
      ) : null}

      {artifact?.status === "error" && !isPending ? (
        <ErrorState
          title="Artifact failed"
          body={artifact.error ?? "Grok did not return JSON."}
          actionLabel="Retry"
          onRetry={() => window.location.reload()}
        />
      ) : null}

      {isPending || artifact?.status === "ready" ? (
        <ArtifactBody artifact={artifact} pending={isPending} />
      ) : null}
    </div>
  );
}
