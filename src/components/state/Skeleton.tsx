type ScanStepStatus = "done" | "running" | "pending";

const STEPS: { label: string; status: ScanStepStatus }[] = [
  { label: "Firecrawl: fetching pricing page", status: "done" },
  { label: "Diffing snapshots", status: "running" },
  { label: "Grok: filtering noise", status: "pending" },
];

function ledClass(status: ScanStepStatus) {
  if (status === "done") return "bg-[var(--palette-ok)]";
  if (status === "running") return "bg-[var(--severity-medium)]";
  return "bg-[var(--color-border)]";
}

export function Skeleton({
  label = "Scanning competitor pages",
}: {
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]"
    >
      <p className="font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <ol className="flex flex-col gap-[var(--space-3)]">
        {STEPS.map((step) => (
          <li key={step.label} className="flex items-center gap-[var(--space-3)]">
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full ${ledClass(step.status)}`}
            />
            <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]">
              {step.label}
            </span>
          </li>
        ))}
      </ol>
      <div
        aria-hidden="true"
        className="mt-[var(--space-2)] h-[48px] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)]"
      />
    </div>
  );
}
