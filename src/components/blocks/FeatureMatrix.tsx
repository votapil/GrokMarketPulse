import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { fixtureCompetitor, fixtureSnapshotV2 } from "@/lib/fixtures";
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
import { BlockEmpty, BlockLoading, BlockShell } from "./registry";

export type CompetitorPricing = {
  competitorName: string;
  plan: PricingPlan | null;
  features: string[];
  /** Состав фич живого публичного запроса пока не имеет — помечаем источник честно. */
  featuresFromCache: boolean;
};

export type FeatureMatrixProps = {
  signalId?: string;
};

export type MatrixGroup = "Plan" | "Features";

export type MatrixRow = {
  group: MatrixGroup;
  label: string;
  us: string;
  them: string;
  differs: boolean;
};

function normalizeFeature(feature: string): string {
  return feature.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Конкурент: имя и цену берём из живого сигнала, когда он есть.
 * Состав фич — из кэшированного снапшота-фикстуры: публичного запроса к
 * `snapshots` в API нет (convex/snapshots.ts — только internal-функции).
 * TODO: перейти на `api.snapshots.latest`, когда дорожка B его опубликует.
 */
export function useCompetitorPricing(
  signalId: string | undefined,
): LoadState<CompetitorPricing> {
  const demo = useQuery(api.workspace.demo);
  const bundle = useSignalBundle(signalId);

  if (demo === undefined || bundle.kind === "loading") {
    return { kind: "loading" };
  }

  if (bundle.kind === "error") {
    return { kind: "error", message: bundle.message };
  }

  const competitorName =
    bundle.kind === "ready"
      ? bundle.data.competitor.name
      : (demo?.competitors[0]?.name ?? fixtureCompetitor.name);

  const cachedPlan = fixtureSnapshotV2.plans[0];
  const livePrice =
    bundle.kind === "ready"
      ? extractPrice(bundle.data.signal.currentState)
      : null;

  if (!cachedPlan) {
    return { kind: "empty" };
  }

  return {
    kind: "ready",
    data: {
      competitorName,
      plan: {
        name: cachedPlan.name,
        usd: livePrice ?? cachedPlan.usd,
        period: cachedPlan.period,
        limits: cachedPlan.limits,
        features: [...cachedPlan.features],
      },
      features: [...fixtureSnapshotV2.features],
      featuresFromCache: true,
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
export function buildMatrixRows(
  us: CompanyPricing,
  them: CompetitorPricing,
): MatrixRow[] {
  const ourPlan =
    us.plans.find((plan) => plan.name === them.plan?.name) ?? us.plans[0] ?? null;

  const usPrice = priceLabel(ourPlan);
  const themPrice = priceLabel(them.plan);
  const usLimits = ourPlan?.limits || "—";
  const themLimits = them.plan?.limits || "—";

  const rows: MatrixRow[] = [
    {
      group: "Plan",
      label: `${ourPlan?.name ?? them.plan?.name ?? "Plan"} price`,
      us: usPrice,
      them: themPrice,
      differs: usPrice !== themPrice,
    },
    {
      group: "Plan",
      label: "Limits",
      us: usLimits,
      them: themLimits,
      differs: usLimits !== themLimits,
    },
  ];

  const labels = new Map<string, string>();
  const ourKeys = new Set<string>();
  const theirKeys = new Set<string>();

  for (const feature of [...(ourPlan?.features ?? []), ...us.keyFeatures]) {
    const key = normalizeFeature(feature);
    if (!key) {
      continue;
    }
    ourKeys.add(key);
    if (!labels.has(key)) {
      labels.set(key, feature);
    }
  }

  for (const feature of [...them.features, ...(them.plan?.features ?? [])]) {
    const key = normalizeFeature(feature);
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
      them: inThem ? "Yes" : "No",
      differs: inUs !== inThem,
    };
  });

  // Совпадения сверху: подсветка различий читается, когда их меньшинство.
  const shared = featureRows.filter((row) => !row.differs);
  const different = featureRows.filter((row) => row.differs);

  return [...rows, ...shared, ...different];
}

const headCell =
  "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-left font-[family-name:var(--font-mono)] text-[11px] font-[number:var(--weight-medium)] uppercase tracking-wide text-[var(--color-text-muted)]";
const bodyCell =
  "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] align-top font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]";
const groupCell =
  "border-b border-[var(--color-border)] bg-[var(--palette-recessed)] px-[var(--space-3)] py-[var(--space-1)] text-left font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]";

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
          </td>
        </tr>
      ))}
    </tbody>
  );
}

/** FeatureMatrix — «мы vs они»: строки features/limits, колонки Us / конкурент. */
export function FeatureMatrix({ signalId }: FeatureMatrixProps) {
  const company = useCompanyPricing();
  const competitor = useCompetitorPricing(signalId);

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
  const { competitorName } = competitor.data;

  return (
    <BlockShell title="Feature matrix" state="ready">
      <div className="mb-[var(--space-3)] flex flex-wrap items-center justify-between gap-[var(--space-2)]">
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
          {company.data.companyName} vs {competitorName} · {differences} difference
          {differences === 1 ? "" : "s"}
        </p>
        {competitor.data.featuresFromCache ? (
          <span className="rounded-[var(--radius-sm)] border border-[var(--palette-amber)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--palette-amber)]">
            cached snapshot
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <caption className="sr-only">
            Feature and limit comparison between {company.data.companyName} and{" "}
            {competitorName}. Rows where the two differ are marked.
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

      <p className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
        <span
          className="inline-block h-2 w-2 rounded-full bg-[var(--palette-amber)]"
          aria-hidden
        />
        Differs from your plan
      </p>
    </BlockShell>
  );
}

export default FeatureMatrix;
