import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { fixtureCompetitor, fixtureSignal, fixtureSnapshotV2 } from "@/lib/fixtures";
import type { LoadState } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { CompanyPricing, PricingPlan } from "./DataGrid";
import {
  BlockErrorRetry,
  formatPrice,
  shortPeriod,
  useCompanyPricing,
} from "./DataGrid";
import { extractPrice, useSignalBundle } from "./DiffView";
import { BlockEmpty, BlockLoading, BlockShell, isFixtureId } from "./registry";

/**
 * Откуда данные конкурента. `snapshot` — живой `api.snapshots.latest`;
 * `fixture` — только для fixture_-идентификаторов; `none` — снапшотов ещё нет
 * (нормальное состояние до первого скана, не ошибка).
 */
export type CompetitorSource = "snapshot" | "fixture" | "none";

export type CompetitorPricing = {
  competitorName: string;
  /** Тариф из сигнала (Pro), иначе первый с ценой; `null` — нет снапшота или тарифов. */
  plan: PricingPlan | null;
  /** Объединение фич снапшота и выбранного тарифа, без дублей. */
  features: string[];
  source: CompetitorSource;
  /** `fetchedAt` снапшота (или фикстуры); `null` — снапшота нет. */
  fetchedAt: number | null;
  /** Цена из `signal.currentState` — только сверка со снапшотом, не источник правды. */
  signalPrice: number | null;
};

export type FeatureMatrixProps = {
  signalId?: string;
  /**
   * Явный конкурент (`block.props.competitorId`). Без него: для фикстурного
   * сигнала — фикстурный конкурент, иначе первый конкурент демо-воркспейса.
   */
  competitorId?: string;
};

export type MatrixGroup = "Plan" | "Features";

export type MatrixRow = {
  group: MatrixGroup;
  label: string;
  us: string;
  them: string;
  differs: boolean;
  /** Muted-подпись под значением конкурента (сверка цены снапшота с сигналом). */
  note?: string;
};

/** Ключ сравнения: нижний регистр, только буквы и цифры, одиночные пробелы. */
function normalizeKey(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** «Pro» ⊂ «Pro $39/mo» по целым словам: «Professional» на «Pro» не матчится. */
function mentionsPlan(state: string, planName: string): boolean {
  const needle = normalizeKey(planName);
  return needle !== "" && ` ${normalizeKey(state)} `.includes(` ${needle} `);
}

/** Тариф из сигнала → иначе первый с ценой → иначе первый вообще. Копия, не ссылка. */
function pickSnapshotPlan(
  plans: readonly PricingPlan[],
  currentState: string | null,
): PricingPlan | null {
  const named = currentState
    ? plans.find((plan) => mentionsPlan(currentState, plan.name))
    : undefined;
  const chosen = named ?? plans.find((plan) => plan.usd !== null) ?? plans[0];
  return chosen ? { ...chosen, features: [...chosen.features] } : null;
}

function unionFeatures(...lists: readonly (readonly string[])[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const list of lists) {
    for (const feature of list) {
      const key = normalizeKey(feature);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(feature);
    }
  }
  return result;
}

/**
 * Конкурент: имя и цену из сигнала берём как сверку, состав тарифов и фич —
 * из живого `api.snapshots.latest`. Фикстурный снапшот остаётся только для
 * fixture_-идентификаторов; на живом пути `null` от запроса означает «снапшота
 * ещё нет» и в фикстуру молча не проваливается.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function useCompetitorPricing(
  signalId: string | undefined,
  competitorId?: string,
): LoadState<CompetitorPricing> {
  const demo = useQuery(api.workspace.demo);
  const bundle = useSignalBundle(signalId);

  const resolvedId =
    competitorId ??
    (signalId === fixtureSignal.id ? fixtureSignal.competitorId : undefined) ??
    demo?.competitors[0]?._id;
  const isFixture = resolvedId !== undefined && isFixtureId(resolvedId);

  const snapshot = useQuery(
    api.snapshots.latest,
    resolvedId && !isFixture
      ? { competitorId: resolvedId as Id<"competitors"> }
      : "skip",
  );

  if (demo === undefined || bundle.kind === "loading") {
    return { kind: "loading" };
  }

  if (bundle.kind === "error") {
    return { kind: "error", message: bundle.message };
  }

  const signalState =
    bundle.kind === "ready" ? bundle.data.signal.currentState : null;
  const signalPrice = signalState === null ? null : extractPrice(signalState);

  if (isFixture) {
    if (resolvedId !== fixtureCompetitor.id) {
      return {
        kind: "error",
        message: `Fixture competitor "${resolvedId}" not found`,
      };
    }
    const cachedPlan = pickSnapshotPlan(fixtureSnapshotV2.plans, signalState);
    return {
      kind: "ready",
      data: {
        competitorName:
          bundle.kind === "ready"
            ? bundle.data.competitor.name
            : fixtureCompetitor.name,
        plan: cachedPlan,
        features: unionFeatures(
          fixtureSnapshotV2.features,
          cachedPlan?.features ?? [],
        ),
        source: "fixture",
        fetchedAt: fixtureSnapshotV2.fetchedAt,
        signalPrice,
      },
    };
  }

  if (resolvedId === undefined) {
    // Демо-воркспейс не засеян и конкурент не передан — сравнивать не с кем.
    return { kind: "empty" };
  }

  if (snapshot === undefined) {
    return { kind: "loading" };
  }

  const competitorName =
    bundle.kind === "ready"
      ? bundle.data.competitor.name
      : (demo?.competitors.find((competitor) => competitor._id === resolvedId)
          ?.name ?? "Competitor");

  if (snapshot === null) {
    return {
      kind: "ready",
      data: {
        competitorName,
        plan: null,
        features: [],
        source: "none",
        fetchedAt: null,
        signalPrice,
      },
    };
  }

  const plan = pickSnapshotPlan(snapshot.plans, signalState);
  return {
    kind: "ready",
    data: {
      competitorName,
      plan,
      features: unionFeatures(snapshot.features, plan?.features ?? []),
      source: "snapshot",
      fetchedAt: snapshot.fetchedAt,
      signalPrice,
    },
  };
}

function priceLabel(plan: PricingPlan | null): string {
  if (!plan) {
    return "—";
  }
  return `${formatPrice(plan.usd)}/${shortPeriod(plan.period)}`;
}

/** Чистая сборка строк матрицы; входные данные не мутируются. */
// eslint-disable-next-line react-refresh/only-export-components
export function buildMatrixRows(
  us: CompanyPricing,
  them: CompetitorPricing,
): MatrixRow[] {
  const ourPlan =
    us.plans.find((plan) => plan.name === them.plan?.name) ?? us.plans[0] ?? null;

  // Неизвестно ≠ отличается: без снапшота (или без тарифа в нём) колонка
  // конкурента — «—», и такие строки как различия не подсвечиваем.
  const themUnknown = them.source === "none";
  const planKnown = them.plan !== null;

  const usPrice = priceLabel(ourPlan);
  const themPrice = priceLabel(them.plan);
  const usLimits = ourPlan?.limits || "—";
  const themLimits = them.plan?.limits || "—";

  const priceNote =
    them.plan && them.signalPrice !== null && them.plan.usd !== them.signalPrice
      ? `snapshot ${formatPrice(them.plan.usd)} · signal ${formatPrice(them.signalPrice)}`
      : undefined;

  const rows: MatrixRow[] = [
    {
      group: "Plan",
      label: `${ourPlan?.name ?? them.plan?.name ?? "Plan"} price`,
      us: usPrice,
      them: themPrice,
      differs: planKnown && usPrice !== themPrice,
      note: priceNote,
    },
    {
      group: "Plan",
      label: "Limits",
      us: usLimits,
      them: themLimits,
      differs: planKnown && usLimits !== themLimits,
    },
  ];

  const labels = new Map<string, string>();
  const ourKeys = new Set<string>();
  const theirKeys = new Set<string>();

  for (const feature of [...(ourPlan?.features ?? []), ...us.keyFeatures]) {
    const key = normalizeKey(feature);
    if (!key) {
      continue;
    }
    ourKeys.add(key);
    if (!labels.has(key)) {
      labels.set(key, feature);
    }
  }

  for (const feature of [...them.features, ...(them.plan?.features ?? [])]) {
    const key = normalizeKey(feature);
    if (!key) {
      continue;
    }
    theirKeys.add(key);
    if (!labels.has(key)) {
      labels.set(key, feature);
    }
  }

  const featureRows: MatrixRow[] = [...labels.entries()].map(([key, label]) => {
    const inUs = ourKeys.has(key);
    const inThem = theirKeys.has(key);
    return {
      group: "Features" as const,
      label,
      us: inUs ? "Yes" : "No",
      them: themUnknown ? "—" : inThem ? "Yes" : "No",
      differs: !themUnknown && inUs !== inThem,
    };
  });

  // Совпадения сверху: подсветка различий читается, когда их меньшинство.
  const shared = featureRows.filter((row) => !row.differs);
  const different = featureRows.filter((row) => row.differs);

  return [...rows, ...shared, ...different];
}

/** «12 Sep, 17:05» — UTC, как у соседних блоков; полная дата уходит в title/dateTime. */
function formatSnapshotAt(at: number): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "UTC",
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("day")} ${part("month")}, ${part("hour")}:${part("minute")}`;
}

function formatSnapshotAtFull(at: number): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(at));
  return `${text} UTC`;
}

const headCell =
  "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-left font-[family-name:var(--font-mono)] text-[11px] font-[number:var(--weight-medium)] uppercase tracking-wide text-[var(--color-text-muted)]";
const bodyCell =
  "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] align-top font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]";
const groupCell =
  "border-b border-[var(--color-border)] bg-[var(--palette-recessed)] px-[var(--space-3)] py-[var(--space-1)] text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]";
const captionText =
  "font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]";

function ValueCell({ value, differs }: { value: string; differs: boolean }) {
  return (
    <span className="inline-flex items-center gap-[var(--space-2)]">
      {differs ? (
        <span
          className="inline-block h-2 w-2 shrink-0 rounded-full bg-[var(--palette-amber)]"
          aria-hidden
        />
      ) : null}
      <span>{value}</span>
      {differs ? <span className="sr-only"> — differs from your plan</span> : null}
    </span>
  );
}

function MatrixSection({
  group,
  rows,
}: {
  group: MatrixGroup;
  rows: MatrixRow[];
}) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <tbody>
      <tr>
        <th scope="rowgroup" colSpan={3} className={groupCell}>
          {group === "Plan" ? "Plan and limits" : "Features"}
        </th>
      </tr>
      {rows.map((row) => (
        <tr
          key={`${group}-${row.label}`}
          data-differs={row.differs ? "true" : "false"}
          className={cn(row.differs && "bg-[var(--palette-recessed)]")}
        >
          <th
            scope="row"
            className={cn(bodyCell, "font-[number:var(--weight-medium)]")}
          >
            {row.label}
          </th>
          <td className={cn(bodyCell, "whitespace-nowrap")}>{row.us}</td>
          <td className={cn(bodyCell, "whitespace-nowrap")}>
            <ValueCell value={row.them} differs={row.differs} />
            {row.note ? (
              <p className={cn(captionText, "mt-[var(--space-1)]")}>{row.note}</p>
            ) : null}
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** Подпись источника: фикстура — amber-плашка, снапшот — дата, ничего — призыв к скану. */
function SourceCaption({
  source,
  fetchedAt,
}: {
  source: CompetitorSource;
  fetchedAt: number | null;
}) {
  if (source === "fixture") {
    return (
      <span className="rounded-[var(--radius-sm)] border border-[var(--palette-amber)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--palette-amber)]">
        cached fixture
      </span>
    );
  }

  if (source === "none") {
    return (
      <span className={captionText}>No competitor snapshot yet — run a scan</span>
    );
  }

  if (fetchedAt === null) {
    return null;
  }

  return (
    <time
      dateTime={new Date(fetchedAt).toISOString()}
      title={formatSnapshotAtFull(fetchedAt)}
      className={captionText}
    >
      Snapshot {formatSnapshotAt(fetchedAt)}
    </time>
  );
}

/** FeatureMatrix — «мы vs они»: строки features/limits, колонки Us / конкурент. */
export function FeatureMatrix({ signalId, competitorId }: FeatureMatrixProps) {
  const company = useCompanyPricing();
  const competitor = useCompetitorPricing(signalId, competitorId);

  if (company.kind === "loading" || competitor.kind === "loading") {
    return <BlockLoading title="Comparing feature sets" />;
  }

  if (company.kind === "error") {
    return (
      <BlockErrorRetry
        title="Feature matrix"
        headline="Feature comparison unavailable"
        message={company.message}
      />
    );
  }

  if (competitor.kind === "error") {
    return (
      <BlockErrorRetry
        title="Feature matrix"
        headline="Competitor snapshot did not load"
        message={competitor.message}
      />
    );
  }

  if (company.kind === "empty" || competitor.kind === "empty") {
    return (
      <BlockEmpty
        title="Feature matrix"
        message="Nothing to compare yet. Run Scan to capture a competitor pricing snapshot."
      />
    );
  }

  const rows = buildMatrixRows(company.data, competitor.data);
  const planRows = rows.filter((row) => row.group === "Plan");
  const featureRows = rows.filter((row) => row.group === "Features");
  const differences = rows.filter((row) => row.differs).length;
  const { competitorName, source, fetchedAt } = competitor.data;
  const noSnapshot = source === "none";

  return (
    <BlockShell title="Feature matrix" state="ready">
      <div
        className="mb-[var(--space-3)] flex flex-wrap items-center justify-between gap-[var(--space-2)]"
        data-source={source}
      >
        <p className={captionText}>
          {company.data.companyName} vs {competitorName}
          {noSnapshot
            ? null
            : ` · ${differences} difference${differences === 1 ? "" : "s"}`}
        </p>
        <SourceCaption source={source} fetchedAt={fetchedAt} />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <caption className="sr-only">
            Feature and limit comparison between {company.data.companyName} and{" "}
            {competitorName}.{" "}
            {noSnapshot
              ? "No competitor snapshot has been captured yet; competitor cells are empty."
              : "Rows where the two differ are marked."}
          </caption>
          <thead>
            <tr>
              <th scope="col" className={headCell}>
                Capability
              </th>
              <th scope="col" className={headCell}>
                Us
              </th>
              <th scope="col" className={headCell}>
                {competitorName}
              </th>
            </tr>
          </thead>
          <MatrixSection group="Plan" rows={planRows} />
          <MatrixSection group="Features" rows={featureRows} />
        </table>
      </div>

      {noSnapshot ? null : (
        <p
          className={cn(
            captionText,
            "mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)]",
          )}
        >
          <span
            className="inline-block h-2 w-2 rounded-full bg-[var(--palette-amber)]"
            aria-hidden
          />
          Differs from your plan
        </p>
      )}
    </BlockShell>
  );
}

export default FeatureMatrix;
