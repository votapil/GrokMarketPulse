import { Battlecard, type BattlecardPayload } from "./Battlecard";
import { LandingPreview, type LandingPayload } from "./LandingPreview";
import {
  withLocalLandingEdits,
  type LocalLandingEdits,
} from "./landingPreviewLogic";
import { OfferCard, type OfferPayload } from "./OfferCard";
import { EmptyState } from "@/components/state/EmptyState";

export type ArtifactPayload =
  | BattlecardPayload
  | OfferPayload
  | LandingPayload
  | { type: "empty" };

export type ArtifactLike = {
  payload: ArtifactPayload;
  heroImageUrl?: string | null;
  status?: "pending" | "ready" | "error";
};

function LandingSectionSkeleton({ compact = false }: { compact?: boolean }) {
  const pad = compact ? "p-[var(--space-4)]" : "p-[var(--space-8)]";
  const hero = compact ? "h-24" : "h-40";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Writing landing page sections"
      className={`flex flex-col gap-[var(--space-6)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] ${pad}`}
    >
      <div
        aria-hidden="true"
        className={`${hero} w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]`}
      />
      <div
        aria-hidden="true"
        className="h-8 w-3/4 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]"
      />
      <div
        aria-hidden="true"
        className="h-4 w-full max-w-[72ch] animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]"
      />
      <div className="grid gap-[var(--space-4)] md:grid-cols-2">
        <div
          aria-hidden="true"
          className="h-24 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        />
        <div
          aria-hidden="true"
          className="h-24 animate-pulse rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)]"
        />
      </div>
      <div
        aria-hidden="true"
        className="flex flex-col gap-[var(--space-2)]"
      >
        <div className="h-4 w-1/3 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]" />
        <div className="h-10 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]" />
        <div className="h-10 w-full animate-pulse rounded-[var(--radius-md)] bg-[var(--color-border)]" />
      </div>
      <div
        aria-hidden="true"
        className="h-12 w-48 animate-pulse rounded-[var(--radius-md)] bg-[var(--color-accent)]"
      />
    </div>
  );
}

export function ArtifactBody({
  artifact,
  compact = false,
  pending = false,
  editable = false,
  localEdits,
  onLocalEdits,
}: {
  artifact?: ArtifactLike | null;
  compact?: boolean;
  pending?: boolean;
  editable?: boolean;
  localEdits?: LocalLandingEdits;
  onLocalEdits?: (edits: LocalLandingEdits) => void;
}) {
  if (pending || artifact?.status === "pending") {
    return <LandingSectionSkeleton compact={compact} />;
  }

  if (!artifact || artifact.payload.type === "empty") {
    return (
      <EmptyState
        title="Artifact not ready"
        body="Generate from a recommendation to fill this preview."
      />
    );
  }

  const payload = artifact.payload;
  if (payload.type === "battlecard") {
    return <Battlecard payload={payload} compact={compact} />;
  }
  if (payload.type === "offer") {
    return <OfferCard payload={payload} compact={compact} />;
  }
  if (payload.type === "landing") {
    const shown = withLocalLandingEdits(payload, localEdits ?? {});
    return (
      <LandingPreview
        payload={shown}
        heroImageUrl={artifact.heroImageUrl ?? null}
        compact={compact}
        editable={editable}
        onHeadlineChange={(headline) =>
          onLocalEdits?.({ ...localEdits, headline })
        }
        onCtaChange={(cta) => onLocalEdits?.({ ...localEdits, cta })}
      />
    );
  }

  return (
    <EmptyState
      title="Unsupported artifact"
      body="This payload type has no renderer."
    />
  );
}
