const LOCAL_EDIT_NOTE =
  "Headline and CTA edits stay on this device. Convex does not save them yet.";

export function RegenerateBar({
  onRegenerate,
  disabled = false,
  busy = false,
}: {
  onRegenerate: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-[var(--space-3)]">
      <p className="max-w-[52ch] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {LOCAL_EDIT_NOTE}
      </p>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={disabled || busy}
        aria-busy={busy}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Regenerating…" : "Regenerate"}
      </button>
    </div>
  );
}
