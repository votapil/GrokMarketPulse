export type LandingPayload = {
  type: "landing";
  headline: string;
  subheadline: string;
  offer: string;
  benefits: { title: string; body: string }[];
  differentiation: string;
  comparison: { feature: string; us: string; them: string }[];
  socialProofPlaceholders: string[];
  cta: string;
  sections: { title: string; body: string }[];
};

export function landingMarkdown(payload: LandingPayload): string {
  return [
    `# ${payload.headline}`,
    payload.subheadline,
    ``,
    payload.offer,
    ``,
    `## Benefits`,
    ...payload.benefits.map((row) => `- **${row.title}** — ${row.body}`),
    ``,
    `## Differentiation`,
    payload.differentiation,
    ``,
    `## Us vs AcmeFlow`,
    ...payload.comparison.map((row) => `- ${row.feature}: us ${row.us} / them ${row.them}`),
    ``,
    `CTA: ${payload.cta}`,
  ].join("\n");
}

export function LandingPreview({
  payload,
  heroImageUrl,
  compact = false,
}: {
  payload: LandingPayload;
  heroImageUrl: string | null;
  compact?: boolean;
}) {
  const pad = compact ? "p-[var(--space-4)]" : "p-[var(--space-8)]";

  return (
    <article
      className={`overflow-hidden rounded-[var(--radius-lg)] bg-[var(--palette-paper)] text-[var(--palette-ink)] ${pad}`}
    >
      {heroImageUrl ? (
        <img
          src={heroImageUrl}
          alt=""
          className={
            compact
              ? "mb-[var(--space-4)] h-24 w-full rounded-[var(--radius-md)] object-cover"
              : "mb-[var(--space-6)] h-40 w-full rounded-[var(--radius-md)] object-cover"
          }
        />
      ) : (
        <div
          aria-hidden="true"
          className={
            compact
              ? "mb-[var(--space-4)] h-24 rounded-[var(--radius-md)] bg-[linear-gradient(135deg,#2d3436_0%,#ff4757_55%,#e0e5ec_100%)]"
              : "mb-[var(--space-6)] h-40 rounded-[var(--radius-md)] bg-[linear-gradient(135deg,#2d3436_0%,#ff4757_55%,#e0e5ec_100%)]"
          }
        />
      )}

      <p className="font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-wide opacity-70">
        Helpdesk AI
      </p>
      <h2 className="mt-[var(--space-2)] text-[28px] font-[number:var(--weight-black)] leading-tight md:text-[36px]">
        {payload.headline}
      </h2>
      <p className="mt-[var(--space-3)] max-w-2xl text-[16px] opacity-80">
        {payload.subheadline}
      </p>
      <p className="mt-[var(--space-3)] text-[15px] font-[number:var(--weight-medium)]">
        {payload.offer}
      </p>

      <div className="mt-[var(--space-6)] grid gap-[var(--space-4)] md:grid-cols-2">
        {payload.benefits.map((row) => (
          <section
            key={row.title}
            className="rounded-[var(--radius-md)] border border-[#2d343633] p-[var(--space-4)]"
          >
            <h3 className="text-[18px] font-[number:var(--weight-bold)]">{row.title}</h3>
            <p className="mt-[var(--space-2)] text-[15px] opacity-80">{row.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-[var(--space-6)] text-[16px] font-[number:var(--weight-medium)]">
        {payload.differentiation}
      </p>

      <section className="mt-[var(--space-6)] overflow-x-auto">
        <h3 className="mb-[var(--space-3)] font-[family-name:var(--font-mono)] text-[13px] uppercase tracking-wide opacity-70">
          Us vs AcmeFlow
        </h3>
        <table className="w-full min-w-[280px] border-collapse text-left text-[18px] md:text-[22px]">
          <thead>
            <tr className="border-b border-[#2d343655]">
              <th className="py-[var(--space-2)] font-[number:var(--weight-medium)]">Feature</th>
              <th className="py-[var(--space-2)] font-[number:var(--weight-bold)]">Us</th>
              <th className="py-[var(--space-2)] font-[number:var(--weight-medium)] opacity-70">
                AcmeFlow
              </th>
            </tr>
          </thead>
          <tbody>
            {payload.comparison.map((row) => (
              <tr key={row.feature} className="border-b border-[#2d343633]">
                <td className="py-[var(--space-3)]">{row.feature}</td>
                <td className="py-[var(--space-3)] font-[number:var(--weight-bold)]">{row.us}</td>
                <td className="py-[var(--space-3)] opacity-70">{row.them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ul className="mt-[var(--space-6)] flex flex-wrap gap-[var(--space-3)]">
        {payload.socialProofPlaceholders.map((label) => (
          <li
            key={label}
            className="rounded-[var(--radius-sm)] border border-dashed border-[#2d343655] px-[var(--space-3)] py-[var(--space-2)] text-[13px] font-[family-name:var(--font-mono)] uppercase"
          >
            {label}
          </li>
        ))}
      </ul>

      {!compact
        ? payload.sections.map((section) => (
            <section key={section.title} className="mt-[var(--space-6)]">
              <h3 className="text-[18px] font-[number:var(--weight-bold)]">{section.title}</h3>
              <p className="mt-[var(--space-2)] text-[15px] opacity-80">{section.body}</p>
            </section>
          ))
        : null}

      <p className="mt-[var(--space-6)] inline-flex rounded-[var(--radius-md)] bg-[var(--palette-accent)] px-[var(--space-6)] py-[var(--space-3)] text-[18px] font-[number:var(--weight-bold)] text-white">
        {payload.cta}
      </p>
    </article>
  );
}
