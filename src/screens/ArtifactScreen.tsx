import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { ArtifactBody, type ArtifactPayload } from "@/components/artifacts/ArtifactBody";
import { battlecardMarkdown } from "@/components/artifacts/Battlecard";
import { landingMarkdown } from "@/components/artifacts/LandingPreview";
import { offerMarkdown } from "@/components/artifacts/OfferCard";
import { isFixtureId } from "@/components/blocks/registry";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { Skeleton } from "@/components/state/Skeleton";
import {
  fixtureArtifactBattlecard,
  fixtureArtifactLanding,
  fixtureArtifactOffer,
  fixtureRecommendations,
  fixtureSignal,
} from "@/lib/fixtures";

const FIXTURES = {
  [fixtureArtifactLanding.id]: fixtureArtifactLanding,
  [fixtureArtifactBattlecard.id]: fixtureArtifactBattlecard,
  [fixtureArtifactOffer.id]: fixtureArtifactOffer,
} as const;

function artifactMarkdown(payload: ArtifactPayload): string {
  if (payload.type === "battlecard") return battlecardMarkdown(payload);
  if (payload.type === "offer") return offerMarkdown(payload);
  if (payload.type === "landing") return landingMarkdown(payload);
  return "";
}

export function ArtifactScreen() {
  const { artifactId } = useParams();
  const [copyLabel, setCopyLabel] = useState("Copy");
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

  const trail = useMemo(() => {
    if (isFixture && fixture) {
      const rec = fixtureRecommendations.find((row) => row.id === fixture.recommendationId);
      return {
        signalTitle: fixtureSignal.title,
        recTitle: rec?.title ?? fixture.recommendationId,
      };
    }
    if (live && liveSignal) {
      const rec = liveSignal.signal.recommendations.find(
        (row) => row.id === live.recommendationId,
      );
      return {
        signalTitle: liveSignal.signal.title,
        recTitle: rec?.title ?? live.recommendationId,
      };
    }
    return { signalTitle: "Signal", recTitle: "Recommendation" };
  }, [fixture, isFixture, live, liveSignal]);

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

  if (!isFixture && live === undefined) {
    return (
      <div className="p-[var(--space-6)]">
        <Skeleton label="Loading artifact" />
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="p-[var(--space-6)]">
        <EmptyState
          title="Artifact not found"
          body={`Nothing stored for ${artifactId}. Generate one from a recommendation.`}
        />
      </div>
    );
  }

  if (artifact.status === "pending") {
    return (
      <div className="p-[var(--space-6)]">
        <Skeleton label="Grok is writing the artifact" />
      </div>
    );
  }

  if (artifact.status === "error") {
    return (
      <div className="p-[var(--space-6)]">
        <ErrorState
          title="Artifact failed"
          body={artifact.error ?? "Grok did not return JSON."}
          actionLabel="Retry"
          onRetry={() => window.location.reload()}
        />
      </div>
    );
  }

  const markdown = artifactMarkdown(artifact.payload);

  async function onCopy() {
    await navigator.clipboard.writeText(markdown);
    setCopyLabel("Copied");
    window.setTimeout(() => setCopyLabel("Copy"), 1500);
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-[var(--space-4)] px-[var(--space-4)] py-[var(--space-6)]">
      <nav
        aria-label="Artifact trail"
        className="flex flex-wrap items-center gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]"
      >
        <Link to="/" className="text-[var(--color-text)] underline-offset-4 hover:underline">
          {trail.signalTitle}
        </Link>
        <span aria-hidden="true">→</span>
        <span>{trail.recTitle}</span>
        <span aria-hidden="true">→</span>
        <span className="text-[var(--color-text)]">{artifact.type}</span>
      </nav>

      <div className="flex items-center justify-between gap-[var(--space-3)]">
        <h1 className="text-[20px] font-[number:var(--weight-bold)]">Artifact</h1>
        <button
          type="button"
          onClick={() => void onCopy()}
          className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-medium)]"
        >
          {copyLabel}
        </button>
      </div>

      <ArtifactBody artifact={artifact} />
    </div>
  );
}
