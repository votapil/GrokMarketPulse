import { fixtureSignal } from "@/lib/fixtures";
import type { LoadState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useQuery } from "convex/react";
import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { SignalRow, type SignalRowData } from "./SignalRow";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";

type SignalDoc = Doc<"signals">;

type FeedGroup = "new" | "high-threat" | "opportunities" | "resolved";

const GROUP_META: Record<
  FeedGroup,
  { title: string; order: number }
> = {
  new: { title: "New", order: 0 },
  "high-threat": { title: "High threat", order: 1 },
  opportunities: { title: "Opportunities", order: 2 },
  resolved: { title: "Resolved", order: 3 },
};

function fixtureSignals(): SignalDoc[] {
  return [
    {
      _id: fixtureSignal.id as Id<"signals">,
      _creationTime: fixtureSignal.detectedAt,
      workspaceId: fixtureSignal.workspaceId as Id<"workspaces">,
      competitorId: fixtureSignal.competitorId as Id<"competitors">,
      sourceId: fixtureSignal.sourceId as Id<"sources">,
      type: fixtureSignal.type,
      title: fixtureSignal.title,
      summary: fixtureSignal.summary,
      previousState: fixtureSignal.previousState,
      currentState: fixtureSignal.currentState,
      detectedAt: fixtureSignal.detectedAt,
      status: fixtureSignal.status,
      kind: fixtureSignal.kind,
      severity: fixtureSignal.severity,
      urgency: fixtureSignal.urgency,
      score: fixtureSignal.score,
      confidence: fixtureSignal.confidence,
      previousSnapshotId: fixtureSignal.previousSnapshotId as Id<"snapshots">,
      currentSnapshotId: fixtureSignal.currentSnapshotId as Id<"snapshots">,
      assessment: fixtureSignal.assessment,
      recommendations: fixtureSignal.recommendations,
      layout: fixtureSignal.layout,
      selectedRecommendationId: fixtureSignal.selectedRecommendationId,
      error: fixtureSignal.error,
    },
  ];
}

function toRowData(signal: SignalDoc): SignalRowData {
  return {
    _id: signal._id,
    title: signal.title,
    summary: signal.summary,
    detectedAt: signal.detectedAt,
    severity: signal.severity,
    kind: signal.kind,
    previousState: signal.previousState,
    currentState: signal.currentState,
    score: signal.score,
  };
}

function groupForSignal(signal: SignalDoc): FeedGroup {
  if (signal.status === "resolved") {
    return "resolved";
  }
  if (
    signal.kind === "threat" &&
    (signal.severity === "high" || signal.severity === "critical")
  ) {
    return "high-threat";
  }
  if (signal.kind === "opportunity") {
    return "opportunities";
  }
  return "new";
}

function groupSignals(signals: SignalDoc[]): Array<{ group: FeedGroup; items: SignalDoc[] }> {
  const buckets: Record<FeedGroup, SignalDoc[]> = {
    new: [],
    "high-threat": [],
    opportunities: [],
    resolved: [],
  };

  for (const signal of signals) {
    buckets[groupForSignal(signal)].push(signal);
  }

  return (Object.keys(GROUP_META) as FeedGroup[])
    .sort((a, b) => GROUP_META[a].order - GROUP_META[b].order)
    .map((group) => ({ group, items: buckets[group] }))
    .filter((entry) => entry.items.length > 0);
}

function FeedSkeleton() {
  return (
    <div className="flex flex-col gap-2 p-3" aria-busy="true" aria-label="Loading signals">
      {Array.from({ length: 3 }).map((_, index) => (
        <div
          key={index}
          className="flex flex-col gap-2 rounded-[var(--radius-md,8px)] border border-dashed border-[var(--color-border,#3a4450)] bg-[var(--color-surface,#242b32)]/40 px-3 py-3"
        >
          <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--palette-border,#3a4450)]" />
          <div className="h-2 w-full animate-pulse rounded bg-[var(--palette-border,#3a4450)]/70" />
          <div className="h-2 w-1/2 animate-pulse rounded bg-[var(--palette-border,#3a4450)]/70" />
        </div>
      ))}
    </div>
  );
}

function FeedEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
      <p className="font-[family-name:var(--font-sans)] text-sm font-[number:var(--weight-medium,500)] text-[var(--color-text,#e8eef2)]">
        No signals yet — run a scan
      </p>
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted,#a8b2c1)]">
        Signals appear here in realtime
      </p>
    </div>
  );
}

function FeedError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="m-3 flex flex-1 flex-col items-center justify-center gap-3 rounded-[var(--radius-md,8px)] border border-[var(--palette-accent,#ff4757)] bg-[var(--color-surface,#242b32)] px-4 py-8 text-center">
      <p className="font-[family-name:var(--font-sans)] text-sm text-[var(--color-text,#e8eef2)]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-[var(--radius-md,8px)] border border-[var(--color-border,#3a4450)] bg-transparent px-3 py-1.5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wide text-[var(--color-text,#e8eef2)] transition-colors hover:border-[var(--palette-info,#7eb6ff)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info,#7eb6ff)]"
      >
        Retry
      </button>
    </div>
  );
}

type SignalsFeedProps = {
  workspaceId?: Id<"workspaces">;
  selectedSignalId?: Id<"signals"> | null;
  onSelectSignal?: (signalId: Id<"signals">) => void;
};

function SignalsFeedBody({
  workspaceId,
  selectedSignalId,
  onSelectSignal,
}: SignalsFeedProps) {
  const useLiveData = workspaceId !== undefined;
  const queryResult = useQuery(
    api.signals.list,
    useLiveData ? { workspaceId } : "skip",
  );

  const [internalSelectedId, setInternalSelectedId] = useState<Id<"signals"> | null>(
    null,
  );
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(() => new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const onSelectSignalRef = useRef(onSelectSignal);
  onSelectSignalRef.current = onSelectSignal;

  const selectedId =
    selectedSignalId !== undefined ? selectedSignalId : internalSelectedId;

  const loadState: LoadState<SignalDoc[]> = useMemo(() => {
    if (useLiveData) {
      if (queryResult === undefined) {
        return { kind: "loading" };
      }
      if (queryResult.length === 0) {
        return { kind: "empty" };
      }
      return { kind: "ready", data: queryResult };
    }

    const fixtures = fixtureSignals();
    if (fixtures.length === 0) {
      return { kind: "empty" };
    }
    return { kind: "ready", data: fixtures };
  }, [queryResult, useLiveData]);

  const grouped = useMemo(() => {
    const signals = loadState.kind === "ready" ? loadState.data : [];
    return groupSignals(signals);
  }, [loadState]);

  const flatIds = useMemo(
    () => grouped.flatMap(({ items }) => items.map((item) => item._id)),
    [grouped],
  );

  useEffect(() => {
    if (loadState.kind !== "ready") {
      return;
    }

    const currentIds = new Set(loadState.data.map((signal) => signal._id));
    const newIds = loadState.data
      .map((signal) => signal._id)
      .filter((id) => !knownIdsRef.current.has(id));

    const timerIds: number[] = [];

    if (knownIdsRef.current.size > 0 && newIds.length > 0) {
      setHighlightedIds((previous) => {
        const next = new Set(previous);
        for (const id of newIds) {
          next.add(id);
        }
        return next;
      });

      for (const id of newIds) {
        timerIds.push(
          window.setTimeout(() => {
            setHighlightedIds((previous) => {
              const next = new Set(previous);
              next.delete(id);
              return next;
            });
          }, 2000),
        );
      }
    }

    knownIdsRef.current = currentIds;
    return () => {
      for (const timerId of timerIds) {
        window.clearTimeout(timerId);
      }
    };
  }, [loadState]);

  useEffect(() => {
    if (selectedId !== null && selectedId !== undefined) {
      return;
    }
    if (flatIds.length === 0) {
      return;
    }
    const firstId = flatIds[0] as Id<"signals">;
    if (selectedSignalId === undefined) {
      setInternalSelectedId(firstId);
    }
    onSelectSignalRef.current?.(firstId);
  }, [flatIds, selectedId, selectedSignalId]);

  const handleSelect = useCallback(
    (signalId: Id<"signals">) => {
      if (selectedSignalId === undefined) {
        setInternalSelectedId(signalId);
      }
      onSelectSignalRef.current?.(signalId);
    },
    [selectedSignalId],
  );

  const handleArrowNavigate = useCallback(
    (currentId: Id<"signals">, direction: "up" | "down") => {
      const index = flatIds.indexOf(currentId);
      if (index === -1) {
        return;
      }
      const nextIndex = direction === "down" ? index + 1 : index - 1;
      const nextId = flatIds[nextIndex];
      if (!nextId) {
        return;
      }
      rowRefs.current.get(nextId)?.focus();
    },
    [flatIds],
  );

  if (loadState.kind === "loading") {
    return <FeedSkeleton />;
  }

  if (loadState.kind === "empty") {
    return <FeedEmpty />;
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-2">
      {grouped.map(({ group, items }) => (
        <section key={group} className="mb-3 last:mb-0" aria-label={GROUP_META[group].title}>
          <h3 className="px-2 pb-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted,#a8b2c1)]">
            {GROUP_META[group].title}
          </h3>
          <div className="flex flex-col gap-1">
            {items.map((signal) => (
              <SignalRow
                key={signal._id}
                ref={(node) => {
                  if (node) {
                    rowRefs.current.set(signal._id, node);
                  } else {
                    rowRefs.current.delete(signal._id);
                  }
                }}
                signal={toRowData(signal)}
                selected={selectedId === signal._id}
                highlighted={highlightedIds.has(signal._id)}
                onSelect={() => handleSelect(signal._id)}
                onArrowNavigate={(direction) =>
                  handleArrowNavigate(signal._id, direction)
                }
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

type ErrorBoundaryProps = {
  children: ReactNode;
  onError: (message: string) => void;
  resetKey: number;
};

type ErrorBoundaryState = {
  message: string | null;
};

class SignalsFeedErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { message: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { message: error.message || "Could not load signals" };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.message) {
      this.setState({ message: null });
    }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error.message || "Could not load signals");
  }

  render() {
    if (this.state.message) {
      return null;
    }
    return this.props.children;
  }
}

export function SignalsFeed(props: SignalsFeedProps) {
  const [retryKey, setRetryKey] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRetry = () => {
    setErrorMessage(null);
    setRetryKey((key) => key + 1);
  };

  return (
    <aside
      className={cn(
        "flex h-full w-[var(--size-feed,280px)] shrink-0 flex-col",
        "border-r border-[var(--color-border,#3a4450)] bg-[var(--palette-recessed,#12161a)]",
      )}
      aria-label="Signals feed"
    >
      <header className="flex h-[var(--size-header,56px)] shrink-0 items-center border-b border-[var(--color-border,#3a4450)] px-4">
        <h2 className="font-[family-name:var(--font-sans)] text-sm font-[number:var(--weight-bold,700)] text-[var(--color-text,#e8eef2)]">
          Signals
        </h2>
      </header>

      {errorMessage ? (
        <FeedError message={errorMessage} onRetry={handleRetry} />
      ) : (
        <SignalsFeedErrorBoundary
          key={retryKey}
          resetKey={retryKey}
          onError={setErrorMessage}
        >
          <SignalsFeedBody {...props} />
        </SignalsFeedErrorBoundary>
      )}
    </aside>
  );
}
