import { cn } from "@/lib/utils";
import type { Level } from "@/lib/types";
import { forwardRef, type KeyboardEvent } from "react";

export type SignalRowData = {
  _id: string;
  title: string;
  summary: string;
  detectedAt: number;
  severity: Level;
  kind: "threat" | "opportunity" | "neutral";
  previousState: string;
  currentState: string;
  score: number;
};

const SEVERITY_META: Record<Level, { label: string; ledClass: string }> = {
  low: {
    label: "Low",
    ledClass: "bg-[var(--severity-low,var(--palette-info,#7eb6ff))]",
  },
  medium: {
    label: "Medium",
    ledClass: "bg-[var(--severity-medium,var(--palette-amber,#f5a524))]",
  },
  high: {
    label: "High",
    ledClass: "bg-[var(--severity-high,var(--palette-accent,#ff4757))]",
  },
  critical: {
    label: "Critical",
    ledClass:
      "bg-[var(--severity-critical,var(--palette-critical,#ff2d55))] shadow-[0_0_10px_2px_rgba(255,45,85,0.6)]",
  },
};

function formatDetectedAt(ms: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

type SignalRowProps = {
  signal: SignalRowData;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
  onArrowNavigate?: (direction: "up" | "down") => void;
};

export const SignalRow = forwardRef<HTMLButtonElement, SignalRowProps>(
  function SignalRow(
    { signal, selected, highlighted, onSelect, onArrowNavigate },
    ref,
  ) {
    const severity = SEVERITY_META[signal.severity];

    const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        onArrowNavigate?.("down");
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        onArrowNavigate?.("up");
      }
    };

    return (
      <button
        ref={ref}
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex w-full flex-col gap-1 rounded-[var(--radius-md,8px)] border border-transparent px-3 py-2 text-left transition-colors",
          "font-[family-name:var(--font-sans)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info,#7eb6ff)]",
          selected
            ? "border border-[var(--color-border,#3a4450)] border-l-[3px] border-l-[var(--color-accent,#ff4757)] bg-[var(--color-surface,#242b32)]"
            : "hover:bg-[var(--color-surface,#242b32)]/70",
          highlighted &&
            "animate-pulse border-[var(--palette-info,#7eb6ff)] bg-[var(--palette-info,#7eb6ff)]/10",
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="line-clamp-2 text-sm font-[number:var(--weight-medium,500)] text-[var(--color-text,#e8eef2)]">
            {signal.title}
          </span>
          <span
            className="shrink-0 font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-text-muted,#a8b2c1)]"
            aria-label={`Detected ${formatDetectedAt(signal.detectedAt)}`}
          >
            {formatDetectedAt(signal.detectedAt)}
          </span>
        </div>

        <p className="line-clamp-2 text-xs text-[var(--color-text-muted,#a8b2c1)]">
          {signal.summary}
        </p>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            <span
              className={cn("h-2 w-2 shrink-0 rounded-full", severity.ledClass)}
              aria-hidden="true"
            />
            <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text,#e8eef2)]">
              {severity.label}
            </span>
            <span className="text-[11px] capitalize text-[var(--color-text-muted,#a8b2c1)]">
              {signal.kind}
            </span>
          </div>
          <span className="font-[family-name:var(--font-mono)] text-[11px] tabular-nums text-[var(--color-text-muted,#a8b2c1)]">
            {signal.score}
          </span>
        </div>

        <p className="truncate font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted,#a8b2c1)]">
          {signal.previousState} → {signal.currentState}
        </p>
      </button>
    );
  },
);
