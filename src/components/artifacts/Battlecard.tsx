type Objection = { objection: string; response: string };

export type BattlecardPayload = {
  type: "battlecard";
  competitorChange: string;
  threat: string;
  competitorStrengths: string[];
  competitorWeaknesses: string[];
  ourStrengths: string[];
  positioning: string;
  objections: Objection[];
  talkingPoints: string[];
};

export function battlecardMarkdown(payload: BattlecardPayload): string {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
  const objections = payload.objections
    .map((row) => `- **${row.objection}** → ${row.response}`)
    .join("\n");
  return [
    `# Battlecard`,
    ``,
    `## Competitor change`,
    payload.competitorChange,
    ``,
    `## Threat`,
    payload.threat,
    ``,
    `## Their strengths`,
    list(payload.competitorStrengths),
    ``,
    `## Their weaknesses`,
    list(payload.competitorWeaknesses),
    ``,
    `## Our strengths`,
    list(payload.ourStrengths),
    ``,
    `## Positioning`,
    payload.positioning,
    ``,
    `## Objections`,
    objections,
    ``,
    `## Talking points`,
    list(payload.talkingPoints),
  ].join("\n");
}

function Column({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-4)]">
      <h3 className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
        {title}
      </h3>
      <ul className="mt-[var(--space-3)] flex flex-col gap-[var(--space-2)] text-[15px]">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

export function Battlecard({
  payload,
  compact = false,
}: {
  payload: BattlecardPayload;
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
          Battlecard
        </p>
        <h2 className="mt-[var(--space-2)] text-[20px] font-[number:var(--weight-bold)]">
          {payload.competitorChange}
        </h2>
        <p className="mt-[var(--space-2)] text-[15px] text-[var(--color-text-muted)]">
          {payload.threat}
        </p>
      </header>

      <p className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-[var(--space-4)] py-[var(--space-3)] text-[15px]">
        {payload.positioning}
      </p>

      <div className="grid gap-[var(--space-3)] md:grid-cols-3">
        <Column title="Their strengths" items={payload.competitorStrengths} />
        <Column title="Their weaknesses" items={payload.competitorWeaknesses} />
        <Column title="Our strengths" items={payload.ourStrengths} />
      </div>

      <section>
        <h3 className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
          Objections
        </h3>
        <dl className="mt-[var(--space-3)] flex flex-col gap-[var(--space-3)]">
          {payload.objections.map((row) => (
            <div key={row.objection}>
              <dt className="font-[number:var(--weight-medium)]">{row.objection}</dt>
              <dd className="text-[15px] text-[var(--color-text-muted)]">{row.response}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section>
        <h3 className="font-[family-name:var(--font-mono)] text-[13px] uppercase text-[var(--color-text-muted)]">
          Talking points
        </h3>
        <ul className="mt-[var(--space-3)] list-disc pl-[var(--space-6)] text-[15px]">
          {payload.talkingPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    </article>
  );
}
