import { useQuery } from "convex/react";
import type { ComponentType } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  fixtureArtifactLanding,
  fixtureArtifactBattlecard,
  fixtureArtifactOffer,
} from "@/lib/fixtures";
import type { BlockComponentProps } from "./registry";
import {
  BlockEmpty,
  BlockError,
  BlockLoading,
  isFixtureId,
} from "./registry";
import { ArtifactBody } from "../artifacts/ArtifactBody";

/** Forward-compat with Track B T-19 (`compact` + artifact payload). */
type ArtifactBodyProps = {
  artifactId?: string;
  artifact?: unknown;
  compact?: boolean;
};

const ArtifactPreview = ArtifactBody as ComponentType<ArtifactBodyProps>;

const fixtureArtifacts: Record<
  string,
  { id: string; status: string; error: string | null }
> = {
  [fixtureArtifactLanding.id]: fixtureArtifactLanding,
  [fixtureArtifactBattlecard.id]: fixtureArtifactBattlecard,
  [fixtureArtifactOffer.id]: fixtureArtifactOffer,
};

export function ActionPreview({ block }: BlockComponentProps) {
  const artifactId = block.props.artifactId;
  const isFixture = artifactId !== undefined && isFixtureId(artifactId);
  const convexArtifact = useQuery(
    api.artifacts.get,
    artifactId && !isFixture
      ? { artifactId: artifactId as Id<"artifacts"> }
      : "skip",
  );

  if (!artifactId) {
    return (
      <BlockEmpty
        title="Action preview"
        message="Select a recommendation to preview an artifact."
      />
    );
  }

  if (isFixture) {
    const artifact = fixtureArtifacts[artifactId];
    if (!artifact) {
      return (
        <BlockError
          title="Action preview"
          message={`Fixture artifact "${artifactId}" not found`}
        />
      );
    }
    if (artifact.status === "error" && artifact.error) {
      return <BlockError title="Action preview" message={artifact.error} />;
    }
    return (
      <ArtifactPreview artifactId={artifactId} artifact={artifact} compact />
    );
  }

  if (convexArtifact === undefined) {
    return <BlockLoading title="Action preview" />;
  }

  if (convexArtifact === null) {
    return (
      <BlockError title="Action preview" message="Artifact not found" />
    );
  }

  if (convexArtifact.status === "error") {
    return (
      <BlockError
        title="Action preview"
        message={convexArtifact.error ?? "Artifact generation failed"}
      />
    );
  }

  if (convexArtifact.status !== "ready") {
    return <BlockLoading title="Action preview" />;
  }

  return (
    <ArtifactPreview
      artifactId={artifactId}
      artifact={convexArtifact}
      compact
    />
  );
}
