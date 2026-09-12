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

function formatSignalType(type: string): string {
  return type.replace(/_/g, " ");
}

export function SignalCard({ block }: BlockComponentProps) {
  const signalId = signalIdFromBlock(block);
  const state = useSignalData(signalId);

  if (state.kind === "loading") {
    return <BlockLoading title="Signal" />;
  }

  if (state.kind === "empty") {
    return (
      <BlockEmpty
        title="Signal"
        message="No signals yet. Run Scan to watch competitors."
      />
    );
  }

  if (state.kind === "error") {
    return <BlockError title="Signal" message={state.message} />;
  }

  const signal = state.data;

  return (
    <BlockShell title="Signal" state="ready">
      <div className="space-y-[var(--space-3,12px)]">
        <div className="flex flex-wrap items-start justify-between gap-[var(--space-2,8px)]">
          <h2 className="font-[family-name:var(--font-sans)] text-[18px] font-[number:var(--weight-bold,700)] leading-snug text-[var(--color-text,#e8eef2)]">
            {signal.title}
          </h2>
          <SeverityLed level={signal.severity} label={signal.severity} />
        </div>

        <p className="font-[family-name:var(--font-mono)] text-[12px] uppercase tracking-wide text-[var(--color-text-muted,#a8b2c1)]">
          {formatSignalType(signal.type)}
        </p>

        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted,#a8b2c1)]">
          {signal.summary}
        </p>
      </div>
    </BlockShell>
  );
}
