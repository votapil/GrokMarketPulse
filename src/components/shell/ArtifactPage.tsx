import { useParams, useSearchParams } from "react-router-dom";
import { EmptyState } from "@/components/state/EmptyState";
import { ErrorState } from "@/components/state/ErrorState";
import { Skeleton } from "@/components/state/Skeleton";

export function ArtifactPage() {
  const { artifactId } = useParams();
  const [params] = useSearchParams();
  const view = params.get("view");

  if (view === "loading") {
    return (
      <div className="p-[var(--space-6)]">
        <Skeleton label="Loading artifact" />
      </div>
    );
  }

  if (view === "error") {
    return (
      <div className="p-[var(--space-6)]">
        <ErrorState
          title="Grok did not return JSON"
          body="The artifact payload was empty. Retry generation from the recommendation."
          actionLabel="Retry"
        />
      </div>
    );
  }

  if (view === "empty" || !artifactId) {
    return (
      <div className="p-[var(--space-6)]">
        <EmptyState
          title="Generate an artifact from a recommendation"
          body="Open Pulse, pick a recommendation, then Generate. This route stays empty until then."
        />
      </div>
    );
  }

  return (
    <div className="p-[var(--space-6)]">
      <p className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
        Artifact
      </p>
      <h1 className="mt-[var(--space-2)] text-[20px] font-[number:var(--weight-bold)]">
        Preview after Generate
      </h1>
      <p className="mt-[var(--space-2)] text-[14px] text-[var(--color-text-muted)]">
        Slot for battlecard and offer. Id {artifactId}.
      </p>
    </div>
  );
}
