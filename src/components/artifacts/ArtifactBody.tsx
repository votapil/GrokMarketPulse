import { Battlecard, type BattlecardPayload } from "./Battlecard";
import { LandingPreview, type LandingPayload } from "./LandingPreview";
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
};

export function ArtifactBody({
  artifact,
  compact = false,
}: {
  artifact?: ArtifactLike | null;
  compact?: boolean;
}) {
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
    return (
      <LandingPreview
        payload={payload}
        heroImageUrl={artifact.heroImageUrl ?? null}
        compact={compact}
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
