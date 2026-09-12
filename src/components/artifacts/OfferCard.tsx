export type OfferPayload = {
  type: "offer";
  headline: string;
  proposition: string;
  value: string;
  conditions: string[];
  differentiators: string[];
  cta: string;
};

export function offerMarkdown(payload: OfferPayload): string {
  return [
    `# ${payload.headline}`,
    ``,
    payload.proposition,
    ``,
    `## Value`,
    payload.value,
    ``,
    `## Conditions`,
    ...payload.conditions.map((item) => `- ${item}`),
    ``,
    `## Differentiators`,
    ...payload.differentiators.map((item) => `- ${item}`),
    ``,
    `CTA: ${payload.cta}`,
  ].join("\n");
}

export function OfferCard({
  payload,
  compact = false,
}: {
  payload: OfferPayload;
  compact?: boolean;
}) {
  return (
    <article
      className={
        compact
          ? "flex flex-col gap-[var(--space-3)]"
          : "flex flex-col gap-[var(--space-4)]"
      }
    >
      <header>
        <p className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
          Offer
        </p>
        <h2 className="mt-[var(--space-2)] text-[20px] font-[number:var(--weight-bold)]">
          {payload.headline}
        </h2>
      </header>
      <p className="text-[15px]">{payload.proposition}</p>
      <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-3)] text-[15px]">
        {payload.value}
      </p>
      <section>
        <h3 className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
          Conditions
        </h3>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)] text-[15px]">
          {payload.conditions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <section>
        <h3 className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
          Differentiators
        </h3>
        <ul className="mt-[var(--space-2)] list-disc pl-[var(--space-6)] text-[15px]">
          {payload.differentiators.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <p className="font-[number:var(--weight-bold)] text-[var(--color-accent)]">
        {payload.cta}
      </p>
    </article>
  );
}
