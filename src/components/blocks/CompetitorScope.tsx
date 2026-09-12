import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useAction, useQuery } from "convex/react";
import { ExternalLink, MapPin } from "lucide-react";

import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import type { LoadState } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  BlockError,
  BlockLoading,
  BlockShell,
  type BlockComponentProps,
} from "./registry";

/**
 * T-40 · CompetitorScope — радиус и фильтр «only same products» вокруг сигнала.
 *
 * Правка контролов уходит в модель невидимым событием `api.uiEvents.send`
 * (`update_radius` / `toggle_filter`, payload — JSON-строка с ключами, которые
 * читает `describeEvent` в convex/uiEvents.ts), и модель перекладывает холст.
 * Карты здесь нет — это T-36. Кандидаты: живые конкуренты воркспейса плюс
 * локальные фикстуры до T-35 (`api.discovery.suggest`). Фикстуры знает только
 * адаптер `useScopeCandidates`.
 *
 * Не подключён в реестр: оркестратор решает, монтировать под `GeoMap` или
 * заводить новый `BlockType`. Нужные props блока: `signalId`, `competitorId`.
 */

export type ScopeOrigin = "manual" | "grok" | "exa" | "seed";

export type ScopeCandidate = {
  id: string;
  name: string;
  url: string;
  origin: ScopeOrigin;
  summary: string;
  distanceKm: number | null;
  sameProducts: boolean;
  region: string | null;
  /** "direct" | "adjacent" | "suspected" — как в `competitors.kind`. */
  kind: string;
  /** true → строка из локальной фикстуры, не из Convex; рисуем muted-тег. */
  fixture: boolean;
};

const RADIUS_MIN_KM = 5;
const RADIUS_MAX_KM = 200;
const RADIUS_STEP_KM = 5;
const RADIUS_DEFAULT_KM = 50;
/** Ползунок шлёт событие только после паузы — драг не спамит модель. */
const RADIUS_DEBOUNCE_MS = 400;
/** «Sent to Grok» держится на экране недолго и гаснет сам. */
const SENT_STATUS_MS = 2000;

const BLOCK_TITLE = "Competitors in scope";
const FILTER_KEY = "only_same_products";

// ---------------------------------------------------------------------------
// Адаптер данных — единственное место, знающее про фикстуры.
// ---------------------------------------------------------------------------

// TODO T-35: replace fixture candidates with api.discovery.suggest({ workspaceId })
const FIXTURE_CANDIDATES: readonly ScopeCandidate[] = [
  {
    id: "fixture_scope_replydesk",
    name: "ReplyDesk",
    url: "https://replydesk.example",
    origin: "exa",
    kind: "direct",
    summary:
      "AI-first shared inbox for SMB support teams; seat pricing close to ours.",
    distanceKm: 12,
    sameProducts: true,
    region: "Berlin",
    fixture: true,
  },
  {
    id: "fixture_scope_ticketowl",
    name: "TicketOwl",
    url: "https://ticketowl.example",
    origin: "grok",
    kind: "direct",
    summary: "Ticketing with AI triage and SLA policies for mid-market teams.",
    distanceKm: 35,
    sameProducts: true,
    region: "Potsdam",
    fixture: true,
  },
  {
    id: "fixture_scope_shopchat",
    name: "ShopChat Commerce",
    url: "https://shopchat.example",
    origin: "exa",
    kind: "adjacent",
    summary: "Live chat for e-commerce stores; no ticketing or knowledge base.",
    distanceKm: 8,
    sameProducts: false,
    region: "Berlin",
    fixture: true,
  },
  {
    id: "fixture_scope_supportnova",
    name: "SupportNova",
    url: "https://supportnova.example",
    origin: "exa",
    kind: "direct",
    summary: "Helpdesk suite with an AI copilot; targets enterprise contracts.",
    distanceKm: 120,
    sameProducts: true,
    region: "Magdeburg",
    fixture: true,
  },
  {
    id: "fixture_scope_kanbanpro",
    name: "Kanban Pro",
    url: "https://kanbanpro.example",
    origin: "grok",
    kind: "adjacent",
    summary:
      "Project boards for agencies; overlaps only on a shared-inbox add-on.",
    distanceKm: 3,
    sameProducts: false,
    region: "Berlin",
    fixture: true,
  },
];

/** Отслеживаемый конкурент — прямой: дистанция 0, продукты те же. */
function fromCompetitor(doc: Doc<"competitors">): ScopeCandidate {
  return {
    id: doc._id,
    name: doc.name,
    url: doc.url,
    origin: doc.origin,
    summary: doc.summary,
    distanceKm: 0,
    sameProducts: true,
    region: null,
    kind: doc.kind,
    fixture: false,
  };
}

/** Неизвестная дистанция радиус не режет — кандидат остаётся в списке. */
function inScope(
  candidate: ScopeCandidate,
  radiusKm: number,
  onlySameProducts: boolean,
): boolean {
  const withinRadius =
    candidate.distanceKm === null || candidate.distanceKm <= radiusKm;
  const productMatch = !onlySameProducts || candidate.sameProducts;
  return withinRadius && productMatch;
}

function byDistance(a: ScopeCandidate, b: ScopeCandidate): number {
  const left = a.distanceKm ?? Number.POSITIVE_INFINITY;
  const right = b.distanceKm ?? Number.POSITIVE_INFINITY;
  if (left !== right) {
    return left - right;
  }
  return a.name.localeCompare(b.name);
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Живые конкуренты воркспейса + фикстуры, отфильтрованные по радиусу и чекбоксу.
 * `demo === null` (воркспейс не засеян) — работаем только на фикстурах, блок
 * остаётся интерактивным. Пустой результат после фильтра — `empty`, не ошибка.
 */
function useScopeCandidates(
  radiusKm: number,
  onlySameProducts: boolean,
): LoadState<ScopeCandidate[]> {
  const demo = useQuery(api.workspace.demo);

  return useMemo<LoadState<ScopeCandidate[]>>(() => {
    if (demo === undefined) {
      return { kind: "loading" };
    }

    try {
      const live = (demo?.competitors ?? []).map(fromCompetitor);
      const liveNames = new Set(
        live.map((candidate) => normalizeName(candidate.name)),
      );
      const extras = FIXTURE_CANDIDATES.filter(
        (candidate) => !liveNames.has(normalizeName(candidate.name)),
      );

      const scoped = [...live, ...extras]
        .filter((candidate) => inScope(candidate, radiusKm, onlySameProducts))
        .sort(byDistance);

      if (scoped.length === 0) {
        return { kind: "empty" };
      }
      return { kind: "ready", data: scoped };
    } catch (error: unknown) {
      return {
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "Could not build the competitor scope",
      };
    }
  }, [demo, onlySameProducts, radiusKm]);
}

// ---------------------------------------------------------------------------
// Вспомогательное
// ---------------------------------------------------------------------------

/** Только http/https уходят в href; остальное показываем текстом (XSS via javascript:). */
function safeHref(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

function formatDistance(distanceKm: number | null): string {
  return distanceKm === null ? "—" : `${distanceKm} km`;
}

function clearTimer(ref: MutableRefObject<number | null>): void {
  if (ref.current !== null) {
    window.clearTimeout(ref.current);
    ref.current = null;
  }
}

type ScopeEvent =
  | { action: "update_radius"; radiusKm: number }
  | { action: "toggle_filter"; enabled: boolean };

type Delivery =
  | { kind: "idle" }
  | { kind: "local"; label: string }
  | { kind: "sending"; label: string }
  | { kind: "sent"; label: string }
  | { kind: "failed"; label: string; message: string };

/** Человеческая подпись события для статус-строки. */
function labelFor(event: ScopeEvent): string {
  return event.action === "update_radius"
    ? `radius ${event.radiusKm} km`
    : `only same products ${event.enabled ? "on" : "off"}`;
}

// ---------------------------------------------------------------------------
// Стили (токены из DESIGN.md, без хекс-литералов)
// ---------------------------------------------------------------------------

const mono11Muted =
  "font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]";
const focusRing =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]";
const originBadge =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text)]";
const mutedTag =
  "rounded-[var(--radius-sm)] border border-[var(--color-border)] px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] uppercase text-[var(--color-text-muted)]";
const outlineButton = cn(
  "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]",
  focusRing,
  "disabled:cursor-not-allowed disabled:opacity-50",
);

// ---------------------------------------------------------------------------
// Подкомпоненты
// ---------------------------------------------------------------------------

function ScopeControls({
  radiusKm,
  onlySameProducts,
  onRadiusChange,
  onToggle,
}: {
  radiusKm: number;
  onlySameProducts: boolean;
  onRadiusChange: (next: number) => void;
  onToggle: (enabled: boolean) => void;
}) {
  // useId, не block.id: один layout-id может встретиться и на холсте, и в чате.
  const idPrefix = useId();
  const rangeId = `${idPrefix}-radius`;
  const checkboxId = `${idPrefix}-same-products`;

  return (
    <fieldset className="mb-[var(--space-3)] flex flex-col gap-[var(--space-3)]">
      <legend className="sr-only">Scope filters</legend>

      <div className="flex flex-col gap-[var(--space-1)]">
        <div className="flex items-center justify-between gap-[var(--space-2)]">
          <label
            htmlFor={rangeId}
            className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]"
          >
            Radius
          </label>
          <output
            htmlFor={rangeId}
            className="font-[family-name:var(--font-mono)] text-[13px] text-[var(--color-text)]"
          >
            ≤ {radiusKm} km
          </output>
        </div>
        <input
          id={rangeId}
          type="range"
          min={RADIUS_MIN_KM}
          max={RADIUS_MAX_KM}
          step={RADIUS_STEP_KM}
          value={radiusKm}
          aria-valuetext={`${radiusKm} km`}
          onChange={(event) => onRadiusChange(Number(event.target.value))}
          className={cn(
            "w-full cursor-pointer accent-[var(--palette-info)]",
            focusRing,
          )}
        />
      </div>

      <div className="flex items-center gap-[var(--space-2)]">
        <input
          id={checkboxId}
          type="checkbox"
          checked={onlySameProducts}
          onChange={(event) => onToggle(event.target.checked)}
          className={cn(
            "h-4 w-4 cursor-pointer accent-[var(--palette-info)]",
            focusRing,
          )}
        />
        <label
          htmlFor={checkboxId}
          className="cursor-pointer font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text)]"
        >
          only same products
        </label>
      </div>
    </fieldset>
  );
}

function CandidateRow({
  candidate,
  current,
}: {
  candidate: ScopeCandidate;
  current: boolean;
}) {
  const href = safeHref(candidate.url);

  return (
    <li
      aria-current={current ? "true" : undefined}
      data-fixture={candidate.fixture ? "true" : "false"}
      className={cn(
        "rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] p-[var(--space-3)]",
        current && "border-l-[3px] border-l-[var(--color-accent)]",
      )}
    >
      <div className="flex flex-wrap items-center gap-[var(--space-2)]">
        <h4 className="font-[family-name:var(--font-sans)] text-[14px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
          {candidate.name}
        </h4>
        <span className={originBadge}>{candidate.origin}</span>
        <span className={mono11Muted}>{candidate.kind}</span>
        {candidate.fixture ? <span className={mutedTag}>fixture</span> : null}
        {current ? (
          <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text)]">
            current
          </span>
        ) : null}
      </div>

      <div className="mt-[var(--space-1)] flex flex-wrap items-center gap-x-[var(--space-3)] gap-y-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px]">
        <span className="text-[var(--color-text)]">
          {formatDistance(candidate.distanceKm)}
        </span>
        {candidate.region ? (
          <span className="text-[var(--color-text-muted)]">
            {candidate.region}
          </span>
        ) : null}
        <span className="inline-flex items-center gap-[var(--space-2)] text-[var(--color-text)]">
          <span
            className={cn(
              "inline-block h-2 w-2 shrink-0 rounded-full",
              candidate.sameProducts
                ? "bg-[var(--palette-ok)]"
                : "bg-[var(--color-text-muted)]",
            )}
            aria-hidden
          />
          {candidate.sameProducts ? "same products" : "different products"}
        </span>
      </div>

      <p className="mt-[var(--space-2)] line-clamp-2 font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text-muted)]">
        {candidate.summary}
      </p>

      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "mt-[var(--space-1)] flex items-center gap-[var(--space-1)] font-[family-name:var(--font-mono)] text-[12px] text-[var(--palette-info)] underline-offset-2 hover:underline",
            focusRing,
          )}
        >
          <span className="truncate">{href}</span>
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
        </a>
      ) : (
        <p className="mt-[var(--space-1)] break-all font-[family-name:var(--font-mono)] text-[12px] text-[var(--color-text-muted)]">
          {candidate.url}
        </p>
      )}
    </li>
  );
}

function ScopeEmpty({
  canWiden,
  onWiden,
}: {
  canWiden: boolean;
  onWiden: () => void;
}) {
  return (
    <div
      data-scope-state="empty"
      className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)]"
    >
      <div className="flex items-start gap-[var(--space-3)]">
        <MapPin
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
          aria-hidden
        />
        <div>
          <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text-muted)]">
            No competitors matched. Widen the radius
          </p>
          {!canWiden ? (
            <p className={cn("mt-[var(--space-1)]", mono11Muted)}>
              Radius is already {RADIUS_MAX_KM} km — untick only same products
            </p>
          ) : null}
          <button
            type="button"
            onClick={onWiden}
            disabled={!canWiden}
            className={cn(outlineButton, "mt-[var(--space-3)]")}
          >
            Widen to {RADIUS_MAX_KM} km
          </button>
        </div>
      </div>
    </div>
  );
}

function DeliveryStatus({ delivery }: { delivery: Delivery }) {
  if (delivery.kind === "idle") {
    return null;
  }

  if (delivery.kind === "failed") {
    return (
      <div
        role="alert"
        className="mt-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-3)]"
      >
        <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          Grok did not receive {delivery.label}
        </p>
        <p className={cn("mt-[var(--space-1)]", mono11Muted)}>
          {delivery.message}
        </p>
      </div>
    );
  }

  const text =
    delivery.kind === "sending"
      ? `Sending to Grok · ${delivery.label}…`
      : delivery.kind === "sent"
        ? `Sent to Grok · ${delivery.label}`
        : `Applied locally · ${delivery.label}`;

  return (
    <p
      role="status"
      aria-live="polite"
      className={cn("mt-[var(--space-3)]", mono11Muted)}
    >
      {text}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Блок
// ---------------------------------------------------------------------------

export function CompetitorScopeBlock({ block }: BlockComponentProps) {
  const props: Partial<Record<string, string>> = block.props ?? {};
  const signalId = props.signalId;
  const currentCompetitorId = props.competitorId;
  const blockId = block.id;

  const demo = useQuery(api.workspace.demo);
  const sendUiEvent = useAction(api.uiEvents.send);
  const workspaceId = demo?.workspace._id;

  const [radiusKm, setRadiusKm] = useState(RADIUS_DEFAULT_KM);
  const [onlySameProducts, setOnlySameProducts] = useState(false);
  const [delivery, setDelivery] = useState<Delivery>({ kind: "idle" });

  const state = useScopeCandidates(radiusKm, onlySameProducts);

  const radiusTimer = useRef<number | null>(null);
  const statusTimer = useRef<number | null>(null);
  // Только последний ответ обновляет статус: старый send не перекроет новый.
  const sendSeq = useRef(0);

  useEffect(
    () => () => {
      clearTimer(radiusTimer);
      clearTimer(statusTimer);
    },
    [],
  );

  const dispatch = useCallback(
    (event: ScopeEvent) => {
      const label = labelFor(event);
      // Ключи совпадают с тем, что читает describeEvent в convex/uiEvents.ts.
      const payload =
        event.action === "update_radius"
          ? JSON.stringify({ radius_km: event.radiusKm, signalId })
          : JSON.stringify({
              filter: FILTER_KEY,
              enabled: event.enabled,
              signalId,
            });

      clearTimer(statusTimer);

      if (!workspaceId) {
        setDelivery({ kind: "local", label });
        return;
      }

      sendSeq.current += 1;
      const seq = sendSeq.current;
      setDelivery({ kind: "sending", label });

      sendUiEvent({ workspaceId, blockId, action: event.action, payload })
        .then(() => {
          if (seq !== sendSeq.current) {
            return;
          }
          setDelivery({ kind: "sent", label });
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setDelivery({ kind: "idle" });
          }, SENT_STATUS_MS);
        })
        .catch((error: unknown) => {
          if (seq !== sendSeq.current) {
            return;
          }
          setDelivery({
            kind: "failed",
            label,
            message: error instanceof Error ? error.message : "Unknown error",
          });
        });
    },
    [blockId, sendUiEvent, signalId, workspaceId],
  );

  // Дебаунс-таймер зовёт актуальный dispatch, а не замыкание момента драга.
  const dispatchRef = useRef(dispatch);
  useEffect(() => {
    dispatchRef.current = dispatch;
  }, [dispatch]);

  const handleRadiusChange = (next: number) => {
    setRadiusKm(next);
    clearTimer(radiusTimer);
    radiusTimer.current = window.setTimeout(() => {
      radiusTimer.current = null;
      dispatchRef.current({ action: "update_radius", radiusKm: next });
    }, RADIUS_DEBOUNCE_MS);
  };

  const handleToggle = (enabled: boolean) => {
    setOnlySameProducts(enabled);
    dispatch({ action: "toggle_filter", enabled });
  };

  const widen = () => {
    clearTimer(radiusTimer);
    setRadiusKm(RADIUS_MAX_KM);
    dispatch({ action: "update_radius", radiusKm: RADIUS_MAX_KM });
  };

  if (state.kind === "loading") {
    return <BlockLoading title={BLOCK_TITLE} />;
  }

  if (state.kind === "error") {
    return <BlockError title={BLOCK_TITLE} message={state.message} />;
  }

  const rows = state.kind === "ready" ? state.data : [];

  return (
    <BlockShell title={BLOCK_TITLE} state="ready">
      <div className="mb-[var(--space-3)] flex flex-wrap items-center justify-between gap-[var(--space-2)]">
        <p className={mono11Muted}>
          {workspaceId
            ? "Adjust the scope and Grok reshapes the canvas"
            : "Filters stay local until the workspace connects"}
        </p>
        <span className={mono11Muted}>
          {rows.length} in scope · ≤ {radiusKm} km
        </span>
      </div>

      <ScopeControls
        radiusKm={radiusKm}
        onlySameProducts={onlySameProducts}
        onRadiusChange={handleRadiusChange}
        onToggle={handleToggle}
      />

      {rows.length === 0 ? (
        <ScopeEmpty canWiden={radiusKm < RADIUS_MAX_KM} onWiden={widen} />
      ) : (
        <ul
          aria-label={`${rows.length} competitors within ${radiusKm} km`}
          className="space-y-[var(--space-2)]"
        >
          {rows.map((candidate) => (
            <CandidateRow
              key={candidate.id}
              candidate={candidate}
              current={
                currentCompetitorId !== undefined &&
                candidate.id === currentCompetitorId
              }
            />
          ))}
        </ul>
      )}

      <DeliveryStatus delivery={delivery} />
    </BlockShell>
  );
}

export default CompetitorScopeBlock;
