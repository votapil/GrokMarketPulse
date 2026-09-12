export function ErrorState({
  title,
  body,
  actionLabel = "Retry scan",
  onRetry,
}: {
  title: string;
  body: string;
  actionLabel?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-6)]"
    >
      <h2 className="font-[family-name:var(--font-sans)] text-[20px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
        {title}
      </h2>
      <p className="max-w-xl text-[15px] text-[var(--color-text-muted)]">{body}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] text-[18px] font-[number:var(--weight-bold)] text-white"
      >
        {actionLabel}
      </button>
    </div>
  );
}
