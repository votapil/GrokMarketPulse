import { useAction, useQuery } from "convex/react";
import { useCallback, type ComponentType, type ReactNode } from "react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { fixtureSignal } from "@/lib/fixtures";
import type { BlockType, Level, LoadState, UiBlock } from "@/lib/types";
import { SignalCard } from "./SignalCard";
import { MetricCards } from "./MetricCards";
import { ActionPreview } from "./ActionPreview";
import { DataGrid, type BlockEvent } from "./DataGrid";
import { DiffView } from "./DiffView";
import { EvidenceCard } from "./EvidenceCard";
import { FeatureMatrix } from "./FeatureMatrix";
import { SourceListBlock } from "./SourceList";
import { TimelineBlock } from "./Timeline";
import { PriceChartBlock } from "./PriceChart";
import { GeoMapBlock } from "./GeoMap";

export type BlockComponentProps = {
  block: UiBlock;
};

export type SignalSnapshot = {
  id: string;
  type: string;
  title: string;
  summary: string;
  previousState: string;
  currentState: string;
  kind: "threat" | "opportunity" | "neutral";
  severity: Level;
  urgency: Level;
  score: number;
  confidence: number;
  status: string;
  error: string | null;
};

export function isFixtureId(id: string): boolean {
  return id.startsWith("fixture_");
}

export function signalIdFromBlock(block: UiBlock): string | undefined {
  return block.props.signalId;
}

export function useSignalData(signalId: string | undefined): LoadState<SignalSnapshot> {
  const isFixture = signalId !== undefined && isFixtureId(signalId);
  const convexData = useQuery(
    api.signals.get,
    signalId && !isFixture
      ? { signalId: signalId as Id<"signals"> }
      : "skip",
  );

  if (!signalId) {
    return { kind: "empty" };
  }

  if (isFixture) {
    if (signalId === fixtureSignal.id) {
      const data: SignalSnapshot = {
        id: fixtureSignal.id,
        type: fixtureSignal.type,
        title: fixtureSignal.title,
        summary: fixtureSignal.summary,
        previousState: fixtureSignal.previousState,
        currentState: fixtureSignal.currentState,
        kind: fixtureSignal.kind,
        severity: fixtureSignal.severity,
        urgency: fixtureSignal.urgency,
        score: fixtureSignal.score,
        confidence: fixtureSignal.confidence,
        status: fixtureSignal.status,
        error: fixtureSignal.error,
      };
      return { kind: "ready", data };
    }
    return { kind: "error", message: `Fixture signal "${signalId}" not found` };
  }

  if (convexData === undefined) {
    return { kind: "loading" };
  }

  if (convexData === null) {
    return { kind: "error", message: "Signal not found" };
  }

  const s = convexData.signal;
  return {
    kind: "ready",
    data: {
      id: s._id,
      type: s.type,
      title: s.title,
      summary: s.summary,
      previousState: s.previousState,
      currentState: s.currentState,
      kind: s.kind,
      severity: s.severity,
      urgency: s.urgency,
      score: s.score,
      confidence: s.confidence,
      status: s.status,
      error: s.error,
    },
  };
}

const panelReady =
  "rounded-[var(--radius-md)] border border-[var(--color-border,#3a4450)] bg-[var(--color-surface,#242b32)] p-[var(--space-4,16px)]";
const panelDashed =
  "rounded-[var(--radius-md)] border border-dashed border-[var(--color-border,#3a4450)] bg-[var(--color-surface,#242b32)] p-[var(--space-4,16px)]";
const panelError =
  "rounded-[var(--radius-md)] border border-[var(--palette-accent,#ff4757)] bg-[var(--color-surface,#242b32)] p-[var(--space-4,16px)]";

export function severityColor(level: Level): string {
  switch (level) {
    case "low":
      return "var(--palette-info, #7eb6ff)";
    case "medium":
      return "var(--palette-amber, #f5a524)";
    case "high":
      return "var(--palette-accent, #ff4757)";
    case "critical":
      return "var(--palette-critical, #ff2d55)";
    default:
      return "var(--color-text-muted, #a8b2c1)";
  }
}

export function SeverityLed({
  level,
  label,
}: {
  level: Level;
  label: string;
}) {
  const color = severityColor(level);
  const glow =
    level === "critical"
      ? "shadow-[0_0_10px_2px_rgba(255,45,85,0.6)]"
      : "";

  return (
    <span className="inline-flex items-center gap-[var(--space-2,8px)] font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-wide text-[var(--color-text,#e8eef2)]">
      <span
        className={`inline-block h-2 w-2 shrink-0 rounded-full ${glow}`}
        style={{ backgroundColor: color }}
        aria-hidden
      />
      {label}
    </span>
  );
}

function BlockShell({
  title,
  children,
  state,
}: {
  title: string;
  children?: ReactNode;
  state?: "loading" | "empty" | "error" | "ready";
}) {
  const shellClass =
    state === "error" ? panelError : state === "ready" ? panelReady : panelDashed;

  return (
    <section
      className={shellClass}
      data-block-state={state ?? "ready"}
      aria-label={title}
    >
      <header className="mb-[var(--space-3,12px)] font-[family-name:var(--font-mono)] text-[11px] font-[number:var(--weight-medium,500)] uppercase tracking-wider text-[var(--color-text-muted,#a8b2c1)]">
        {title}
      </header>
      {children}
    </section>
  );
}

export function BlockLoading({ title }: { title: string }) {
  return (
    <BlockShell title={title} state="loading">
      <div className="space-y-[var(--space-2,8px)] animate-pulse" aria-hidden>
        <div className="h-4 w-3/5 rounded bg-[var(--palette-border,#3a4450)]" />
        <div className="h-3 w-2/5 rounded bg-[var(--palette-border,#3a4450)]/60" />
        <div className="h-3 w-4/5 rounded bg-[var(--palette-border,#3a4450)]/40" />
      </div>
    </BlockShell>
  );
}

export function BlockEmpty({ title, message }: { title: string; message: string }) {
  return (
    <BlockShell title={title} state="empty">
      <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted,#a8b2c1)]">
        {message}
      </p>
    </BlockShell>
  );
}

export function BlockError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <BlockShell title={title} state="error">
      <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text,#e8eef2)]">
        {message}
      </p>
    </BlockShell>
  );
}

function PlaceholderBlock({ block, label }: BlockComponentProps & { label: string }) {
  return (
    <BlockShell title={label} state="ready">
      <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted,#a8b2c1)]">
        Slot for <span className="text-[var(--color-text,#e8eef2)]">{block.type}</span>
        {block.props.signalId ? ` · ${block.props.signalId}` : ""}
      </p>
    </BlockShell>
  );
}

export function UnsupportedBlock({ type }: { type: string }) {
  return (
    <BlockShell title="Unsupported block" state="error">
      <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text,#e8eef2)]">
        Unsupported block: {type}
      </p>
    </BlockShell>
  );
}

export function defaultLayoutForSignal(signalId: string): UiBlock[] {
  return [
    { id: "b1", type: "SignalCard", props: { signalId } },
    { id: "b2", type: "DiffView", props: { signalId } },
    { id: "b3", type: "EvidenceCard", props: { signalId } },
    { id: "b4", type: "MetricCards", props: { signalId } },
  ];
}

function DiffViewBlock({ block }: BlockComponentProps) {
  const signalId = signalIdFromBlock(block);
  if (!signalId) {
    return <BlockEmpty title="Diff view" message="No price diff for this signal" />;
  }
  return <DiffView signalId={signalId} />;
}

function EvidenceCardBlock({ block }: BlockComponentProps) {
  const signalId = signalIdFromBlock(block);
  if (!signalId) {
    return <BlockEmpty title="Evidence" message="No evidence attached" />;
  }
  return <EvidenceCard signalId={signalId} />;
}

function RecommendationCardsStub(props: BlockComponentProps) {
  return <PlaceholderBlock {...props} label="Recommendations" />;
}

function FeatureMatrixBlock({ block }: BlockComponentProps) {
  return (
    <FeatureMatrix
      signalId={signalIdFromBlock(block)}
      competitorId={block.props.competitorId}
    />
  );
}

/**
 * Замыкает петлю ТЗ §25: правка цены в блоке уходит в модель невидимым
 * UI-событием `api.uiEvents.send`, и модель перекладывает холст.
 * Без засеянного воркспейса сток событий не подключаем — DataGrid тогда
 * честно пишет, что правка осталась локальной.
 */
function DataGridBlock({ block }: BlockComponentProps) {
  const demo = useQuery(api.workspace.demo);
  const sendUiEvent = useAction(api.uiEvents.send);
  const workspaceId = demo?.workspace._id;

  const handleEvent = useCallback(
    async (event: BlockEvent) => {
      if (!workspaceId) {
        throw new Error("Demo workspace is not ready");
      }
      await sendUiEvent({
        workspaceId,
        blockId: event.blockId,
        action: event.action,
        payload: event.payload,
      });
    },
    [sendUiEvent, workspaceId],
  );

  return (
    <DataGrid
      blockId={block.id}
      onEvent={workspaceId ? handleEvent : undefined}
      readOnly={block.props.readOnly === "true"}
    />
  );
}

export type BlockComponent = ComponentType<BlockComponentProps>;

export const blockRegistry: Record<BlockType, BlockComponent> = {
  SignalCard,
  DiffView: DiffViewBlock,
  EvidenceCard: EvidenceCardBlock,
  MetricCards,
  RecommendationCards: RecommendationCardsStub,
  SourceList: SourceListBlock,
  Timeline: TimelineBlock,
  Chart: PriceChartBlock,
  FeatureMatrix: FeatureMatrixBlock,
  ActionPreview,
  DataGrid: DataGridBlock,
  // T-36: слот GeoMap несёт схематичную карту радиуса; список кандидатов (T-40,
  // CompetitorScope) остаётся источником фикстур и контракта update_radius.
  GeoMap: GeoMapBlock,
};

export { BlockShell };
