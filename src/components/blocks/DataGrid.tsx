import { useId, useState } from "react";
import { useQuery } from "convex/react";
import { RefreshCw } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import { fixtureWorkspace } from "@/lib/fixtures";
import {
  resolveCompanyPricing,
  type CompanyPricing,
  type PricingPlan,
} from "@/lib/companyPricing";
import type { LoadState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { BlockEmpty, BlockLoading, BlockShell } from "./registry";

export type { CompanyPricing, PricingPlan };

type PlanLike = {
  name: string;
  usd: number | null;
  period: string;
  limits: string;
  features: readonly string[];
};


/**
 * Невидимое UI-событие: правка блока пользователем возвращается в модель.
 * `payload` — JSON-строка, потому что `api.uiEvents.send` принимает `v.string()`.
 */
export type BlockEvent = {
  blockId: string;
  action: "edit_plan_price";
  payload: string;
};

export type BlockEventHandler = (event: BlockEvent) => void | Promise<unknown>;

export type DataGridProps = {
  blockId: string;
  /** Не передан → правка остаётся локальной, блок об этом честно сообщает. */
  onEvent?: BlockEventHandler;
  /** Чужой прайсинг (конкурент) показываем только на чтение. */
  readOnly?: boolean;
};

function toPricingPlan(plan: PlanLike): PricingPlan {
  return {
    name: plan.name,
    usd: plan.usd,
    period: plan.period,
    limits: plan.limits,
    features: [...plan.features],
  };
}

export function formatPrice(usd: number | null): string {
  return usd == null ? "—" : `$${usd}`;
}

export function shortPeriod(period: string): string {
  if (period === "month") {
    return "mo";
  }
  if (period === "year") {
    return "yr";
  }
  return period;
}

function priceInputValue(usd: number | null): string {
  return usd == null ? "" : String(usd);
}

/** Валидация на границе ввода: только число, максимум два знака после точки. */
export function parsePriceInput(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
    return null;
  }
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Читает прайсинг своей компании: Convex → фикстуры, четыре состояния. */
export function useCompanyPricing(
  options: { allowEmptyPlans?: boolean } = {},
): LoadState<CompanyPricing> {
  const demo = useQuery(api.workspace.demo);

  if (demo === undefined) {
    return { kind: "loading" };
  }

  if (demo === null) {
    const context = fixtureWorkspace.company.context;
    return resolveCompanyPricing({
      kind: "fixture",
      companyName: fixtureWorkspace.company.name,
      contextStatus: "ready",
      error: null,
      context: {
        plans: context.plans.map(toPricingPlan),
        keyFeatures: context.keyFeatures,
      },
    });
  }

  const { company } = demo;
  const resolved = resolveCompanyPricing({
    kind: "convex",
    companyName: company.name,
    contextStatus: company.contextStatus,
    error: company.error,
    context: company.context
      ? {
          plans: company.context.plans.map(toPricingPlan),
          keyFeatures: company.context.keyFeatures,
        }
      : null,
  });

  if (
    !options.allowEmptyPlans &&
    resolved.kind === "ready" &&
    resolved.data.plans.length === 0
  ) {
    return { kind: "empty" };
  }

  return resolved;
}

export type SortKey = "name" | "usd";
export type SortDir = "asc" | "desc";
export type SortState = { key: SortKey; dir: SortDir };

export type GridRow = {
  plan: PricingPlan;
  /** Цена с учётом оптимистичной правки. */
  usd: number | null;
  edited: boolean;
};

/** Новый массив строк — входные планы не мутируются. */
export function buildRows(
  plans: readonly PricingPlan[],
  optimistic: Readonly<Record<string, number>>,
  sort: SortState,
): GridRow[] {
  const rows = plans.map((plan) => {
    const draft = optimistic[plan.name];
    const hasEdit = draft !== undefined;
    return {
      plan,
      usd: hasEdit ? draft : plan.usd,
      edited: hasEdit && draft !== plan.usd,
    };
  });

  const factor = sort.dir === "asc" ? 1 : -1;
  return rows.sort((a, b) => {
    if (sort.key === "name") {
      return a.plan.name.localeCompare(b.plan.name) * factor;
    }
    const left = a.usd ?? Number.POSITIVE_INFINITY;
    const right = b.usd ?? Number.POSITIVE_INFINITY;
    return (left - right) * factor;
  });
}

type Delivery =
  | { kind: "idle" }
  | { kind: "local"; label: string }
  | { kind: "sending"; label: string }
  | { kind: "sent"; label: string }
  | { kind: "failed"; label: string; message: string };

const headCell =
  "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] text-left font-[family-name:var(--font-mono)] text-[11px] font-[number:var(--weight-medium)] uppercase tracking-wide text-[var(--color-text-muted)]";
const bodyCell =
  "border-b border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] align-top font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]";

/** Error-состояние по DESIGN-BLOCKS: причина + Retry, без второго saturated CTA. */
export function BlockErrorRetry({
  title,
  headline,
  message,
  onRetry,
}: {
  title: string;
  headline: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <BlockShell title={title} state="error">
      <p className="font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-medium)] text-[var(--color-text)]">
        {headline}
      </p>
      <p className="mt-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry ?? (() => window.location.reload())}
        className="mt-[var(--space-3)] inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]"
      >
        <RefreshCw className="h-4 w-4" aria-hidden />
        Retry
      </button>
    </BlockShell>
  );
}

function SortHeader({
  label,
  sortKey,
  sort,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  sort: SortState;
  onSort: (key: SortKey) => void;
}) {
  const active = sort.key === sortKey;
  const ariaSort = active
    ? sort.dir === "asc"
      ? "ascending"
      : "descending"
    : "none";

  return (
    <th scope="col" className={headCell} aria-sort={ariaSort}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-[var(--space-1)] uppercase tracking-wide text-[var(--color-text-muted)] hover:text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-info)]"
      >
        {label}
        <span aria-hidden>{active ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function PriceCell({
  planName,
  period,
  usd,
  basePrice,
  edited,
  readOnly,
  onCommit,
}: {
  planName: string;
  period: string;
  usd: number | null;
  basePrice: number | null;
  edited: boolean;
  readOnly: boolean;
  onCommit: (next: number) => void;
}) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const committed = priceInputValue(usd);
  const [draft, setDraft] = useState<string>(committed);
  const [invalid, setInvalid] = useState(false);

  if (readOnly) {
    return (
      <span className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]">
        {formatPrice(usd)}
      </span>
    );
  }

  const commit = () => {
    const parsed = parsePriceInput(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(String(parsed));
    if (parsed !== usd) {
      onCommit(parsed);
    }
  };

  return (
    <div className="flex flex-col gap-[var(--space-1)]">
      <div className="flex items-center gap-[var(--space-1)]">
        <span
          className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text-muted)]"
          aria-hidden
        >
          $
        </span>
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            }
            if (event.key === "Escape") {
              setDraft(committed);
              setInvalid(false);
            }
          }}
          onBlur={commit}
          aria-label={`${planName} price in US dollars per ${period}, editable`}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(
            "w-[76px] rounded-[var(--radius-sm)] border bg-[var(--palette-recessed)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-info)]",
            invalid
              ? "border-[var(--palette-amber)]"
              : "border-[var(--color-border)]",
          )}
        />
      </div>
      {invalid ? (
        <p
          id={errorId}
          className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--palette-amber)]"
        >
          Enter a number, e.g. 39
        </p>
      ) : null}
      {edited && !invalid ? (
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
          was {formatPrice(basePrice)}
        </p>
      ) : null}
    </div>
  );
}

function DeliveryStatus({ delivery }: { delivery: Delivery }) {
  if (delivery.kind === "idle") {
    return null;
  }

  const text =
    delivery.kind === "sending"
      ? `Sending ${delivery.label} to the model…`
      : delivery.kind === "sent"
        ? `Model notified · ${delivery.label}`
        : delivery.kind === "local"
          ? `Applied locally · ${delivery.label} — no model connection in this session`
          : `Kept locally · ${delivery.label} — model did not receive it: ${delivery.message}`;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn(
        "mt-[var(--space-3)] font-[family-name:var(--font-mono)] text-[11px]",
        delivery.kind === "failed"
          ? "text-[var(--palette-amber)]"
          : "text-[var(--color-text-muted)]",
      )}
    >
      {text}
    </p>
  );
}

/**
 * DataGrid — тарифы своей компании с inline-правкой цены (кадр 0:45).
 * Правка применяется оптимистично и уходит наружу через `onEvent`.
 */
export function DataGrid({ blockId, onEvent, readOnly = false }: DataGridProps) {
  const state = useCompanyPricing();
  const [optimistic, setOptimistic] = useState<Record<string, number>>({});
  const [delivery, setDelivery] = useState<Delivery>({ kind: "idle" });
  const [sort, setSort] = useState<SortState>({ key: "usd", dir: "asc" });

  if (state.kind === "loading") {
    return <BlockLoading title="Loading pricing plans" />;
  }

  if (state.kind === "empty") {
    return (
      <BlockEmpty
        title="Pricing"
        message="No pricing plans on file. Add plans to your company context to compare pricing."
      />
    );
  }

  if (state.kind === "error") {
    return (
      <BlockErrorRetry
        title="Pricing"
        headline="Pricing unavailable"
        message={state.message}
      />
    );
  }

  const { companyName, plans, fromConvex } = state.data;
  const rows = buildRows(plans, optimistic, sort);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  };

  const commitPrice = (plan: PricingPlan, next: number) => {
    // Оптимистично: цифра меняется сразу, ответа сервера не ждём.
    setOptimistic((prev) => ({ ...prev, [plan.name]: next }));

    const label = `${plan.name} ${formatPrice(plan.usd)} → ${formatPrice(next)}`;
    const payload = JSON.stringify({
      planName: plan.name,
      from: plan.usd,
      to: next,
    });

    if (!onEvent) {
      setDelivery({ kind: "local", label });
      return;
    }

    setDelivery({ kind: "sending", label });
    Promise.resolve(onEvent({ blockId, action: "edit_plan_price", payload }))
      .then(() => {
        setDelivery({ kind: "sent", label });
      })
      .catch((error: unknown) => {
        setDelivery({
          kind: "failed",
          label,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      });
  };

  return (
    <BlockShell title={`Pricing · ${companyName}`} state="ready">
      <div className="mb-[var(--space-3)] flex flex-wrap items-center justify-between gap-[var(--space-2)]">
        <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
          {readOnly
            ? "Competitor pricing · read-only"
            : "Your plans · edit a price and the model reshapes the canvas"}
        </p>
        {!fromConvex ? (
          <span className="rounded-[var(--radius-sm)] border border-[var(--palette-amber)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--palette-amber)]">
            cached fixture
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <caption className="sr-only">
            {readOnly
              ? `Pricing plans of ${companyName}, read-only.`
              : `Pricing plans of ${companyName}. Price cells are editable: type a new value and press Enter.`}
          </caption>
          <thead>
            <tr>
              <SortHeader
                label="Plan"
                sortKey="name"
                sort={sort}
                onSort={toggleSort}
              />
              <SortHeader
                label="Price"
                sortKey="usd"
                sort={sort}
                onSort={toggleSort}
              />
              <th scope="col" className={headCell}>
                Period
              </th>
              <th scope="col" className={headCell}>
                Limits
              </th>
              <th scope="col" className={headCell}>
                Features
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.plan.name}
                data-edited={row.edited ? "true" : "false"}
                className={cn(row.edited && "bg-[var(--palette-recessed)]")}
              >
                <th
                  scope="row"
                  className={cn(
                    bodyCell,
                    "whitespace-nowrap font-[number:var(--weight-bold)]",
                  )}
                >
                  {row.plan.name}
                </th>
                <td className={cn(bodyCell, "whitespace-nowrap")}>
                  <PriceCell
                    // Ключ по серверной цене: приход новых данных сбрасывает
                    // черновик, оптимистичная правка — нет.
                    key={`${row.plan.name}:${row.plan.usd}`}
                    planName={row.plan.name}
                    period={row.plan.period}
                    usd={row.usd}
                    basePrice={row.plan.usd}
                    edited={row.edited}
                    readOnly={readOnly}
                    onCommit={(next) => commitPrice(row.plan, next)}
                  />
                </td>
                <td className={cn(bodyCell, "whitespace-nowrap")}>
                  {shortPeriod(row.plan.period)}
                </td>
                <td className={cn(bodyCell, "whitespace-nowrap")}>
                  {row.plan.limits || "—"}
                </td>
                <td className={bodyCell}>
                  {row.plan.features.length > 0
                    ? row.plan.features.join(" · ")
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeliveryStatus delivery={delivery} />
    </BlockShell>
  );
}

export default DataGrid;
