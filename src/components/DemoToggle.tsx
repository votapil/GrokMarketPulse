import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

const VARIANTS = [
  { id: "v1" as const, label: "v1 · Pro $49" },
  { id: "v2" as const, label: "v2 · Pro $39" },
];

/**
 * Demo host control for frame 0:10: flips the AcmeFlow fixture between
 * the $49 baseline and the $39 cut. Label is intentionally honest.
 */
export function DemoToggle() {
  const state = useQuery(api.mock.state);
  const flip = useAction(api.mock.flip);
  const [pending, setPending] = useState(false);
  const variant = state?.variant ?? "v1";

  async function setVariant(next: "v1" | "v2") {
    if (next === variant || pending) return;
    setPending(true);
    try {
      await flip({ variant: next });
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      aria-label="Simulate competitor edit"
      className="mt-[var(--space-6)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <p className="text-[14px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
        Simulate competitor edit (demo fixture)
      </p>
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]">
        Current variant: {state === undefined ? "…" : variant}
      </p>
      <div
        role="group"
        aria-label="Fixture variant"
        className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]"
      >
        {VARIANTS.map((item) => {
          const pressed = variant === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={pressed}
              disabled={pending || state === undefined}
              onClick={() => void setVariant(item.id)}
              className={
                pressed
                  ? "rounded-[var(--radius-md)] bg-[var(--color-accent)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-bold)] text-white disabled:cursor-not-allowed"
                  : "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-[var(--space-4)] py-[var(--space-2)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)] disabled:cursor-not-allowed"
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
