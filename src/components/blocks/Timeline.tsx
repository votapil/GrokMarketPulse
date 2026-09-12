import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import {
  fixtureCompetitor,
  fixtureSignal,
  fixtureTimeline,
} from "@/lib/fixtures";
import type { LoadState, UiBlock } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { BlockComponentProps } from "./registry";
import {
  BlockEmpty,
  BlockError,
  BlockLoading,
  BlockShell,
  isFixtureId,
} from "./registry";

/**
 * T-28 · Timeline — история конкурента: снапшоты и сигналы одной лентой.
 * Данные: `api.history.timeline({ competitorId })`; фикстура — `fixtureTimeline`.
 * Клик по записи с сигналом шлёт `pulse:select-signal` (слушатель — в PulseScreen).
 */

export type TimelinePoint = {
  at: number;
  label: string;
  price: number | null;
  signalId: string | null;
};

/** Имя события выбора сигнала; `detail` — {@link SelectSignalDetail}. */
export const SELECT_SIGNAL_EVENT = "pulse:select-signal";

export type SelectSignalDetail = { signalId: string };

export const EMPTY_HISTORY_MESSAGE =
  "No price history yet — run a scan to start the timeline";

export const NO_COMPETITOR_MESSAGE = "No competitor attached to this signal";

const BASELINE_RE = /^baseline\b/i;

/**
 * Сервер кладёт `competitorId` в props для Timeline/Chart (layout.ts,
 * COMPETITOR_SCOPED). Для фикстурного сигнала без props берём конкурента из
 * фикстуры, чтобы демо-раскладка не требовала серверных props.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function resolveCompetitorId(block: UiBlock): string | undefined {
  const explicit = block.props.competitorId;
  if (explicit) {
    return explicit;
  }
  const signalId = block.props.signalId;
  if (signalId && signalId === fixtureSignal.id) {
    return fixtureSignal.competitorId;
  }
  return undefined;
}

/** Одна подписка на историю конкурента — её делят Timeline и PriceChart. */
// eslint-disable-next-line react-refresh/only-export-components
export function useTimeline(
  competitorId: string | undefined,
): LoadState<TimelinePoint[]> {
  const isFixture = competitorId !== undefined && isFixtureId(competitorId);
  const data = useQuery(
    api.history.timeline,
    competitorId && !isFixture
      ? { competitorId: competitorId as Id<"competitors"> }
      : "skip",
  );

  if (!competitorId) {
    return { kind: "empty" };
  }

  if (isFixture) {
    if (competitorId === fixtureCompetitor.id) {
      return { kind: "ready", data: sortByTime(fixtureTimeline) };
    }
    return {
      kind: "error",
      message: `Fixture competitor "${competitorId}" not found`,
    };
  }

  if (data === undefined) {
    return { kind: "loading" };
  }

  if (data.length === 0) {
    return { kind: "empty" };
  }

  return { kind: "ready", data: sortByTime(data) };
}

function sortByTime(points: ReadonlyArray<TimelinePoint>): TimelinePoint[] {
  return [...points].sort((a, b) => a.at - b.at);
}

function isBaselinePoint(point: TimelinePoint): boolean {
  return BASELINE_RE.test(point.label);
}

function formatRelative(at: number, now: number): string {
  const diff = now - at;
  const abs = Math.abs(diff);
  if (abs < 60_000) {
    return diff >= 0 ? "just now" : "in <1m";
  }
  const units: ReadonlyArray<readonly [number, string]> = [
    [60_000, "m"],
    [3_600_000, "h"],
    [86_400_000, "d"],
    [2_592_000_000, "mo"],
    [31_536_000_000, "y"],
  ];
  let value = 1;
  let unit = "m";
  for (const [ms, suffix] of units) {
    if (abs >= ms) {
      value = Math.floor(abs / ms);
      unit = suffix;
    }
  }
  return diff >= 0 ? `${value}${unit} ago` : `in ${value}${unit}`;
}

function formatAbsolute(at: number): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(at));
  return `${text} UTC`;
}

function formatUsd(price: number): string {
  return `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

function selectSignal(signalId: string): void {
  window.dispatchEvent(
    new CustomEvent<SelectSignalDetail>(SELECT_SIGNAL_EVENT, {
      detail: { signalId },
    }),
  );
}

function Badge({ children, strong }: { children: string; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-[var(--radius-sm,4px)] border border-[var(--color-border,#3a4450)] px-[6px] py-[1px] font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-wide",
        strong
          ? "text-[var(--color-text,#e8eef2)]"
          : "text-[var(--color-text-muted,#a8b2c1)]",
      )}
    >
      {children}
    </span>
  );
}

function EntryBody({
  point,
  now,
  isSignal,
  isBaseline,
}: {
  point: TimelinePoint;
  now: number;
  isSignal: boolean;
  isBaseline: boolean;
}) {
  const relative = formatRelative(point.at, now);
  const absolute = formatAbsolute(point.at);

  return (
    <>
      <div className="flex items-baseline justify-between gap-[var(--space-2,8px)]">
        <span className="min-w-0 truncate font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text,#e8eef2)]">
          {point.label}
        </span>
        {point.price !== null ? (
          <span className="shrink-0 font-[family-name:var(--font-mono)] text-[13px] tabular-nums text-[var(--color-text,#e8eef2)]">
            {formatUsd(point.price)}
          </span>
        ) : null}
      </div>
      <div className="mt-[var(--space-1,4px)] flex flex-wrap items-center gap-[var(--space-2,8px)]">
        {isBaseline ? <Badge>baseline</Badge> : null}
        {isSignal ? <Badge strong>signal</Badge> : null}
        <time
          dateTime={new Date(point.at).toISOString()}
          className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-text-muted,#a8b2c1)]"
        >
          {relative} · {absolute}
        </time>
      </div>
    </>
  );
}

function TimelineEntry({
  point,
  now,
  isLast,
  isCurrent,
}: {
  point: TimelinePoint;
  now: number;
  isLast: boolean;
  isCurrent: boolean;
}) {
  const signalId = point.signalId;
  const isSignal = signalId !== null;
  const isBaseline = isBaselinePoint(point);
  const dotClass = isSignal
    ? "bg-[var(--palette-accent,#ff4757)]"
    : isBaseline
      ? "bg-[var(--color-text-muted,#a8b2c1)]"
      : "bg-[var(--palette-info,#7eb6ff)]";

  const rowBase =
    "w-full rounded-[var(--radius-sm,4px)] border-l-[3px] px-[var(--space-3,12px)] py-[var(--space-2,8px)] text-left";

  return (
    <li className="relative flex gap-[var(--space-3,12px)]">
      <div className="relative flex w-3 shrink-0 justify-center" aria-hidden>
        {!isLast ? (
          <span className="absolute bottom-[-10px] top-[18px] w-px bg-[var(--color-border,#3a4450)]" />
        ) : null}
        <span className={cn("mt-[14px] h-2 w-2 rounded-full", dotClass)} />
      </div>

      {signalId !== null ? (
        <button
          type="button"
          onClick={() => selectSignal(signalId)}
          aria-current={isCurrent ? "true" : undefined}
          aria-label={`${point.label}${
            point.price !== null ? `, ${formatUsd(point.price)}` : ""
          }, ${formatRelative(point.at, now)}. Show this signal`}
          className={cn(
            rowBase,
            "min-w-0 flex-1 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info,#7eb6ff)]",
            isCurrent
              ? "border-l-[var(--color-accent,#ff4757)] bg-[var(--palette-recessed,#12161a)]"
              : "border-l-transparent hover:bg-[var(--palette-recessed,#12161a)]/60",
          )}
        >
          <EntryBody
            point={point}
            now={now}
            isSignal={isSignal}
            isBaseline={isBaseline}
          />
        </button>
      ) : (
        <div className={cn(rowBase, "min-w-0 flex-1 border-l-transparent")}>
          <EntryBody
            point={point}
            now={now}
            isSignal={isSignal}
            isBaseline={isBaseline}
          />
        </div>
      )}
    </li>
  );
}

export function TimelineBlock({ block }: BlockComponentProps) {
  const competitorId = resolveCompetitorId(block);
  const state = useTimeline(competitorId);
  const currentSignalId = block.props.signalId;

  if (!competitorId) {
    return <BlockEmpty title="Timeline" message={NO_COMPETITOR_MESSAGE} />;
  }

  if (state.kind === "loading") {
    return <BlockLoading title="Timeline" />;
  }

  if (state.kind === "empty") {
    return <BlockEmpty title="Timeline" message={EMPTY_HISTORY_MESSAGE} />;
  }

  if (state.kind === "error") {
    return <BlockError title="Timeline" message={state.message} />;
  }

  const points = state.data;
  const now = Date.now();

  return (
    <BlockShell title="Timeline" state="ready">
      <ol
        className="space-y-[var(--space-2,8px)]"
        aria-label={`${points.length} events in competitor history`}
      >
        {points.map((point, index) => (
          <TimelineEntry
            key={`${point.at}-${point.signalId ?? "snapshot"}-${index}`}
            point={point}
            now={now}
            isLast={index === points.length - 1}
            isCurrent={
              point.signalId !== null &&
              currentSignalId !== undefined &&
              point.signalId === currentSignalId
            }
          />
        ))}
      </ol>
    </BlockShell>
  );
}
