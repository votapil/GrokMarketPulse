/**
 * Structural plan/price diff + leftover text for Grok noise filtering.
 * Compare plans as data first; never treat raw HTML/markdown as the primary signal source.
 */

export type PlanLike = {
  name: string;
  usd: number | null;
  period: string;
  limits: string;
  features: string[];
};

export type StructuralChange = {
  type: "price_change" | "new_plan" | "plan_removed";
  title: string;
  summary: string;
  previousState: string;
  currentState: string;
  fragment: string;
};

function periodSuffix(period: string): string {
  if (period === "month") return "/mo";
  if (period === "year") return "/yr";
  if (period === "one-time") return "";
  return `/${period}`;
}

/** e.g. Pro $49/mo */
export function formatPlanState(plan: PlanLike): string {
  if (plan.usd === null) {
    return `${plan.name} custom`;
  }
  return `${plan.name} $${plan.usd}${periodSuffix(plan.period)}`;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function samePrice(a: PlanLike, b: PlanLike): boolean {
  return a.usd === b.usd && a.period === b.period;
}

/**
 * Diff two plan arrays by plan name. Emits price_change / new_plan / plan_removed.
 * Feature-only deltas are left for leftover markdown + Grok (not auto-signaled here).
 */
export function comparePlans(
  previous: ReadonlyArray<PlanLike>,
  current: ReadonlyArray<PlanLike>,
): StructuralChange[] {
  const prevByName = new Map(
    previous.map((p) => [normalizeName(p.name), p] as const),
  );
  const currByName = new Map(
    current.map((p) => [normalizeName(p.name), p] as const),
  );

  const changes: StructuralChange[] = [];

  for (const [key, curr] of currByName) {
    const prev = prevByName.get(key);
    if (!prev) {
      const state = formatPlanState(curr);
      changes.push({
        type: "new_plan",
        title: `New plan: ${curr.name}`,
        summary: `Competitor added plan ${state}.`,
        previousState: "(none)",
        currentState: state,
        fragment: `+ ${state}`,
      });
      continue;
    }
    if (!samePrice(prev, curr)) {
      const previousState = formatPlanState(prev);
      const currentState = formatPlanState(curr);
      changes.push({
        type: "price_change",
        title: `${curr.name} ${prev.usd ?? "?"} → ${curr.usd ?? "?"}`,
        summary: `Competitor changed ${curr.name} from ${previousState} to ${currentState}.`,
        previousState,
        currentState,
        fragment: `- ${previousState}\n+ ${currentState}`,
      });
    }
  }

  for (const [key, prev] of prevByName) {
    if (currByName.has(key)) continue;
    const state = formatPlanState(prev);
    changes.push({
      type: "plan_removed",
      title: `Removed plan: ${prev.name}`,
      summary: `Competitor removed plan ${state}.`,
      previousState: state,
      currentState: "(none)",
      fragment: `- ${state}`,
    });
  }

  return changes;
}

const NOISE_LINE =
  /^(menu|nav|home|login|sign\s*in|cookie|privacy|terms|©|copyright|\d{1,2}:\d{2}|updated|last\s*updated|views?:|\d+\s*views)/i;

function normalizeLines(markdown: string): string[] {
  return markdown
    .split(/\r?\n/)
    .map((line) => line.replace(/<[^>]+>/g, "").trim())
    .filter((line) => line.length > 0)
    .filter((line) => !NOISE_LINE.test(line));
}

function hasStructuralPriceChange(changes: ReadonlyArray<StructuralChange>): boolean {
  return changes.some((c) => c.type === "price_change");
}

function lineCoveredByStructural(
  line: string,
  changes: ReadonlyArray<StructuralChange>,
): boolean {
  // Any $-amount line is covered once we already emitted a structural price_change.
  if (hasStructuralPriceChange(changes) && /\$\s*\d+/.test(line)) {
    return true;
  }
  const lower = line.toLowerCase();
  return changes.some((c) => {
    if (c.type === "new_plan" || c.type === "plan_removed") {
      const name = (c.type === "new_plan" ? c.currentState : c.previousState)
        .split(" ")[0]
        ?.toLowerCase();
      return Boolean(name && name !== "(none)" && lower.includes(name));
    }
    return false;
  });
}

/**
 * Text residual after structural plan/price changes are accounted for.
 * Strips HTML tags, menu/nav/timestamp-ish lines, and lines already covered by structural diffs.
 */
export function computeTextLeftover(
  previousMarkdown: string,
  currentMarkdown: string,
  structural: ReadonlyArray<StructuralChange>,
): string {
  const prevSet = new Set(normalizeLines(previousMarkdown));
  const currLines = normalizeLines(currentMarkdown);

  const added = currLines.filter((line) => !prevSet.has(line));
  const removed = [...prevSet].filter((line) => !currLines.includes(line));

  const leftoverAdded = added.filter((line) => !lineCoveredByStructural(line, structural));
  const leftoverRemoved = removed.filter(
    (line) => !lineCoveredByStructural(line, structural),
  );

  const parts: string[] = [];
  for (const line of leftoverRemoved) {
    parts.push(`- ${line}`);
  }
  for (const line of leftoverAdded) {
    parts.push(`+ ${line}`);
  }

  return parts.join("\n").trim();
}

/** True when leftover is empty or only cosmetic (whitespace / trivial punctuation). */
export function isTrivialLeftover(leftover: string): boolean {
  if (!leftover.trim()) return true;
  const stripped = leftover.replace(/^[-+\s]+/gm, "").replace(/[^\w$]/g, "");
  return stripped.length < 4;
}
