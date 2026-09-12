import type { ReactNode } from "react";
import type { BlockComponentProps } from "./registry";
import {
  BlockEmpty,
  BlockError,
  BlockLoading,
  BlockShell,
  SeverityLed,
  signalIdFromBlock,
  useSignalData,
} from "./registry";

function formatConfidence(confidence: number): string {
  const pct = confidence <= 1 ? Math.round(confidence * 100) : Math.round(confidence);
  return `${pct}%`;
}

function parsePrice(state: string): number | null {
  const match = state.match(/\$([\d,]+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(value) ? value : null;
}

function priceDeltaPercent(previous: string, current: string): string | null {
  const before = parsePrice(previous);
  const after = parsePrice(current);
  if (before == null || after == null || before === 0) return null;
  const pct = Math.round(((after - before) / before) * 100);
  if (pct === 0) return "0%";
  const sign = pct > 0 ? "+" : "−";
  return `${sign}${Math.abs(pct)}%`;
}

function MetricTile({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border,#3a4450)] bg-[var(--palette-recessed,#12161a)] p-[var(--space-3,12px)]">
      <p className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wider text-[var(--color-text-muted,#a8b2c1)]">
        {label}
      </p>
      <div className="mt-[var(--space-1,4px)]">{children}</div>
    </div>
  );
}

export function MetricCards({ block }: BlockComponentProps) {
  const signalId = signalIdFromBlock(block);
  const state = useSignalData(signalId);

  if (state.kind === "loading") {
    return <BlockLoading title="Metrics" />;
  }

  if (state.kind === "empty") {
    return (
      <BlockEmpty title="Metrics" message="Metrics pending assessment" />
    );
  }

  if (state.kind === "error") {
    return <BlockError title="Metrics" message={state.message} />;
  }

  const signal = state.data;
  const confidenceLabel = formatConfidence(signal.confidence);
  const confidenceHigh =
    (signal.confidence <= 1 ? signal.confidence * 100 : signal.confidence) >= 80;
  const delta =
    signal.type === "price_change"
      ? priceDeltaPercent(signal.previousState, signal.currentState)
      : null;

  return (
    <BlockShell title="Metrics" state="ready">
      <div className="grid grid-cols-2 gap-[var(--space-2,8px)] md:grid-cols-3 lg:grid-cols-5">
        <MetricTile label="Threat">
          <SeverityLed
            level={signal.severity as Level}
            label={signal.severity}
          />
        </MetricTile>

        <MetricTile label="Score">
          <p className="font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold,700)] text-[var(--color-text,#e8eef2)]">
            {Math.round(signal.score)}
          </p>
        </MetricTile>

        <MetricTile label="Confidence">
          <p
            className={`font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold,700)] ${
              confidenceHigh
                ? "text-[var(--palette-ok,#2ed573)]"
                : "text-[var(--color-text,#e8eef2)]"
            }`}
          >
            {confidenceLabel}
          </p>
        </MetricTile>

        <MetricTile label="Urgency">
          <SeverityLed
            level={signal.urgency as Level}
            label={signal.urgency}
          />
        </MetricTile>

        <MetricTile label="Price Δ">
          <p className="font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold,700)] text-[var(--color-text,#e8eef2)]">
            {delta ?? "—"}
          </p>
        </MetricTile>
      </div>
    </BlockShell>
  );
}
