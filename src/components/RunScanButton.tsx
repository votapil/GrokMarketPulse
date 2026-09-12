import { ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";

type RunScanButtonProps = {
  disabled?: boolean;
  isScanning?: boolean;
  className?: string;
  onClick?: () => void;
};

/**
 * T-15: primary Pulse CTA. Parent wires api.scan.run; shows Scanning… while busy.
 * Callers: PulseScreen header toolbar.
 */
export function RunScanButton({
  disabled = false,
  isScanning = false,
  className,
  onClick,
}: RunScanButtonProps) {
  const busy = isScanning;
  const isDisabled = disabled || busy;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-busy={busy}
      aria-disabled={isDisabled}
      title={
        disabled && !busy
          ? "Waiting for workspace competitor"
          : busy
            ? "Scan in progress"
            : "Run Scan"
      }
      className={cn(
        "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[18px] font-[number:var(--weight-bold)] text-white",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      <ScanLine aria-hidden="true" className="h-5 w-5" />
      {busy ? "Scanning…" : "Run Scan"}
    </button>
  );
}
