function formatFetched(at: number | null): string {
  if (at === null) return "Never scraped";
  return new Date(at).toLocaleString();
}

export function SourceRow({
  label,
  kind,
  lastFetchedAt,
  lastStatus,
  error,
}: {
  label: string;
  kind: string;
  lastFetchedAt: number | null;
  lastStatus: number | null;
  error?: string;
}) {
  const status =
    error ??
    (lastStatus === null ? "—" : lastStatus >= 400 ? `HTTP ${lastStatus}` : `HTTP ${lastStatus}`);

  return (
    <li className="flex flex-wrap items-center justify-between gap-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-3)]">
      <div>
        <p className="text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
          {label}
        </p>
        <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
          {kind} · {formatFetched(lastFetchedAt)}
        </p>
      </div>
      <p
        className={
          error || (lastStatus !== null && lastStatus >= 400)
            ? "font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-accent)]"
            : "font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]"
        }
      >
        {status}
      </p>
    </li>
  );
}
