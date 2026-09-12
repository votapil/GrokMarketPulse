import { useEffect, useState } from "react";
import type { Doc } from "../../convex/_generated/dataModel";

type StepStatus = Doc<"runs">["steps"][number]["status"];

const STILL_WORKING_MS = 45_000;

function ledClass(status: StepStatus) {
  if (status === "done") return "bg-[var(--palette-ok)]";
  if (status === "running") return "bg-[var(--severity-medium)]";
  if (status === "error") {
    return "bg-[var(--severity-critical)] shadow-[0_0_10px_2px_rgba(255,45,85,0.6)]";
  }
  if (status === "skipped") return "bg-[var(--color-text-muted)] opacity-40";
  return "bg-[var(--color-border)]";
}

function statusLabel(status: StepStatus) {
  if (status === "done") return "done";
  if (status === "running") return "running";
  if (status === "error") return "error";
  if (status === "skipped") return "skipped";
  return "pending";
}

type ScanProgressProps = {
  run: Doc<"runs"> | null | undefined;
  onRetry?: () => void;
  stillWorkingMs?: number;
};

/**
 * T-15: step list from api.runs.latest — LEDs per step, error+Retry, still-working after 45s.
 * Callers: PulseScreen center pane while status is running|error.
 * Data shape (runs): status, startedAt (ms), steps[{key,label,status,detail}], error, signalId.
 */
export function ScanProgress({
  run,
  onRetry,
  stillWorkingMs = STILL_WORKING_MS,
}: ScanProgressProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (run?.status !== "running") {
      return;
    }
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [run?.status, run?._id]);

  if (run == null) {
    return null;
  }

  const failedStep = run.steps.find((step) => step.status === "error");
  const showStillWorking =
    run.status === "running" && now - run.startedAt >= stillWorkingMs;
  const isError = run.status === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy={run.status === "running"}
      className="flex flex-col gap-[var(--space-4)] rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]"
    >
      <p className="font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {isError ? "Scan did not finish" : "Scanning competitor pages"}
      </p>

      {run.steps.length === 0 ? (
        <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
          Waiting for scan steps…
        </p>
      ) : (
        <ol className="flex flex-col gap-[var(--space-3)]">
          {run.steps.map((step) => (
            <li
              key={step.key}
              className="flex items-start gap-[var(--space-3)]"
              aria-current={step.status === "running" ? "step" : undefined}
            >
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ledClass(step.status)}`}
              />
              <div className="min-w-0 flex-1">
                <p className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]">
                  {step.label}
                  <span className="ml-[var(--space-2)] text-[var(--color-text-muted)]">
                    · {statusLabel(step.status)}
                  </span>
                </p>
                {step.detail ? (
                  <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
                    {step.detail}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}

      {showStillWorking ? (
        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--severity-medium)]">
          Still working — large pages can take a minute. Progress updates live.
        </p>
      ) : null}

      {isError ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-[var(--space-3)] border-t border-[var(--color-border)] pt-[var(--space-3)]"
        >
          <p className="font-[family-name:var(--font-sans)] text-[15px] text-[var(--color-text)]">
            {failedStep
              ? `Failed at “${failedStep.label}”.`
              : "Scan stopped before finishing."}
            {run.error ? ` ${run.error}` : null}
          </p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[18px] font-[number:var(--weight-bold)] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]"
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
