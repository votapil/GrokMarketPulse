import type { ReactNode } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type ActiveDotProps,
  type DotItemDotProps,
  type TooltipContentProps,
} from "recharts";

import type { BlockComponentProps } from "./registry";
import { BlockEmpty, BlockError, BlockLoading, BlockShell } from "./registry";
import {
  EMPTY_HISTORY_MESSAGE,
  NO_COMPETITOR_MESSAGE,
  resolveCompetitorId,
  useTimeline,
  type TimelinePoint,
} from "./Timeline";

/**
 * T-28 · PriceChart — цена Pro во времени с отмеченной точкой сигнала.
 * Одна серия → форма «emphasis»: линия `palette/info`, точка сигнала `palette/accent`.
 * Подписи значений — текстовыми токенами, не цветом серии (dataviz: text never
 * wears the data color). Таблица-близнец графика — блок Timeline.
 */

const CHART_HEIGHT = 220;
/** До этого числа точек подписываем каждую; дальше — только первую, последнюю, экстремумы и сигналы. */
const LABEL_EVERY_POINT_UP_TO = 8;
const MARK_INFO = "var(--palette-info, #7eb6ff)";
const MARK_ACCENT = "var(--palette-accent, #ff4757)";
const INK_TEXT = "var(--color-text, #e8eef2)";
const INK_MUTED = "var(--color-text-muted, #a8b2c1)";
const GRID = "var(--color-border, #3a4450)";
const SURFACE = "var(--color-surface, #242b32)";
const FONT_MONO = "var(--font-mono)";
const BASELINE_RE = /^baseline\b/i;

type ChartPoint = {
  at: number;
  label: string;
  price: number;
  signalId: string | null;
  /** Короткая подпись рядом с ценой: "Pro cut", "Pro raised", "baseline". */
  note: string | null;
  showLabel: boolean;
};

function isChartPoint(value: unknown): value is ChartPoint {
  if (!value || typeof value !== "object") return false;
  const point = value as Record<string, unknown>;
  return typeof point.at === "number" && typeof point.price === "number";
}

function formatUsd(price: number): string {
  return `$${Number.isInteger(price) ? price : price.toFixed(2)}`;
}

function formatShortDate(at: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(at));
}

function formatAbsolute(at: number): string {
  const text = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(new Date(at));
  return `${text} UTC`;
}

function formatDelta(first: number, last: number): string {
  if (first === 0) return "n/a";
  const pct = Math.round(((last - first) / first) * 100);
  if (pct === 0) return "unchanged";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)}%`;
}

function noteFor(
  point: TimelinePoint,
  previousPrice: number | null,
): string | null {
  if (point.signalId !== null) {
    if (previousPrice !== null && point.price !== null) {
      if (point.price < previousPrice) return "Pro cut";
      if (point.price > previousPrice) return "Pro raised";
    }
    return "signal";
  }
  if (BASELINE_RE.test(point.label)) return "baseline";
  return null;
}

/** Точки с ценой; `price: null` пропускаем — они остаются в Timeline. */
function toChartPoints(points: ReadonlyArray<TimelinePoint>): ChartPoint[] {
  const priced: ChartPoint[] = [];
  let previousPrice: number | null = null;

  for (const point of points) {
    if (point.price === null) continue;
    priced.push({
      at: point.at,
      label: point.label,
      price: point.price,
      signalId: point.signalId,
      note: noteFor(point, previousPrice),
      showLabel: true,
    });
    previousPrice = point.price;
  }

  if (priced.length > LABEL_EVERY_POINT_UP_TO) {
    const prices = priced.map((point) => point.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    for (let i = 0; i < priced.length; i += 1) {
      const point = priced[i];
      point.showLabel =
        i === 0 ||
        i === priced.length - 1 ||
        point.signalId !== null ||
        point.price === min ||
        point.price === max;
    }
  }

  return priced;
}

/** Ближайший «красивый» шаг ≥ x из ряда 1·2·5×10^k. */
function niceStep(x: number): number {
  if (x <= 0) return 1;
  const power = Math.pow(10, Math.floor(Math.log10(x)));
  for (const m of [1, 2, 5, 10]) {
    if (m * power >= x) return m * power;
  }
  return 10 * power;
}

/** Домен с запасом, чтобы линия не прилипала к рамке, и ровные тики. */
function priceScale(prices: ReadonlyArray<number>): {
  domain: [number, number];
  ticks: number[];
} {
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = max - min;
  const pad = Math.max(span * 0.35, Math.abs(max) * 0.1, 5);
  const rawLo = min - pad;
  const rawHi = max + pad;
  const step = niceStep((rawHi - rawLo) / 3);
  let lo = Math.floor(rawLo / step) * step;
  const hi = Math.ceil(rawHi / step) * step;
  if (min >= 0) lo = Math.max(0, lo);

  const ticks: number[] = [];
  for (let value = lo; value <= hi + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return { domain: [lo, hi], ticks };
}

function pointLabel(point: ChartPoint): string {
  return point.note
    ? `${formatUsd(point.price)} · ${point.note}`
    : formatUsd(point.price);
}

/**
 * Маркер + подпись значения в одном рендере: сигнал — accent, остальные — info;
 * кольцо цвета поверхности 2px (dataviz: surface ring), подпись — ink-токен.
 */
function renderDot(props: DotItemDotProps, total: number): ReactNode {
  const { cx, cy, index } = props;
  const payload: unknown = props.payload;
  if (cx === undefined || cy === undefined || !isChartPoint(payload)) {
    return null;
  }
  const isSignal = payload.signalId !== null;
  const radius = isSignal ? 5 : 4;
  const anchor = index === 0 ? "start" : index === total - 1 ? "end" : "middle";
  const dx = index === 0 ? -6 : index === total - 1 ? 6 : 0;

  return (
    <g>
      <circle cx={cx} cy={cy} r={radius + 2} fill={SURFACE} />
      <circle
        cx={cx}
        cy={cy}
        r={radius}
        fill={isSignal ? MARK_ACCENT : MARK_INFO}
      />
      {payload.showLabel ? (
        <text
          x={cx + dx}
          y={cy - 14}
          textAnchor={anchor}
          fill={isSignal ? INK_TEXT : INK_MUTED}
          fontFamily={FONT_MONO}
          fontSize={11}
          fontWeight={isSignal ? 700 : 400}
        >
          {pointLabel(payload)}
        </text>
      ) : null}
    </g>
  );
}

function renderActiveDot(props: ActiveDotProps): ReactNode {
  const { cx, cy } = props;
  const payload: unknown = props.payload;
  if (cx === undefined || cy === undefined || !isChartPoint(payload)) {
    return null;
  }
  const isSignal = payload.signalId !== null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={SURFACE} />
      <circle cx={cx} cy={cy} r={7} fill={isSignal ? MARK_ACCENT : MARK_INFO} />
    </g>
  );
}

function PriceTooltip({ active, payload }: TooltipContentProps) {
  const entry: unknown = payload[0]?.payload;
  if (!active || !isChartPoint(entry)) {
    return null;
  }
  return (
    <div className="rounded-[var(--radius-sm,4px)] border border-[var(--color-border,#3a4450)] bg-[var(--color-surface,#242b32)] px-[var(--space-3,12px)] py-[var(--space-2,8px)] shadow-none">
      <p className="font-[family-name:var(--font-mono)] text-[16px] font-[number:var(--weight-bold,700)] tabular-nums text-[var(--color-text,#e8eef2)]">
        {formatUsd(entry.price)}
        {entry.note ? (
          <span className="ml-[var(--space-2,8px)] text-[11px] font-[number:var(--weight-regular,400)] uppercase tracking-wide text-[var(--color-text-muted,#a8b2c1)]">
            {entry.note}
          </span>
        ) : null}
      </p>
      <p className="mt-[2px] font-[family-name:var(--font-sans)] text-[12px] text-[var(--color-text,#e8eef2)]">
        {entry.label}
      </p>
      <p className="mt-[2px] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted,#a8b2c1)]">
        {formatAbsolute(entry.at)}
      </p>
    </div>
  );
}

function Caption({ children }: { children: ReactNode }) {
  return (
    <p className="mt-[var(--space-2,8px)] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted,#a8b2c1)]">
      {children}
    </p>
  );
}

function SinglePoint({
  point,
  skipped,
}: {
  point: ChartPoint;
  skipped: number;
}) {
  const isSignal = point.signalId !== null;
  return (
    <figure
      role="img"
      aria-label={`One Pro price observation so far: ${formatUsd(point.price)} on ${formatAbsolute(point.at)}. The chart draws a line after the next scan.`}
      className="m-0"
    >
      <div className="flex items-center gap-[var(--space-3,12px)] rounded-[var(--radius-md,8px)] border border-[var(--color-border,#3a4450)] bg-[var(--palette-recessed,#12161a)] p-[var(--space-3,12px)]">
        <span
          className="h-3 w-3 shrink-0 rounded-full ring-2 ring-[var(--color-surface,#242b32)]"
          style={{ backgroundColor: isSignal ? MARK_ACCENT : MARK_INFO }}
          aria-hidden
        />
        <div className="min-w-0">
          <p className="font-[family-name:var(--font-mono)] text-[20px] font-[number:var(--weight-bold,700)] tabular-nums text-[var(--color-text,#e8eef2)]">
            {formatUsd(point.price)}
            {point.note ? (
              <span className="ml-[var(--space-2,8px)] text-[11px] font-[number:var(--weight-regular,400)] uppercase tracking-wide text-[var(--color-text-muted,#a8b2c1)]">
                {point.note}
              </span>
            ) : null}
          </p>
          <p className="truncate font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text,#e8eef2)]">
            {point.label}
          </p>
          <p className="font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted,#a8b2c1)]">
            {formatAbsolute(point.at)}
          </p>
        </div>
      </div>
      <figcaption>
        <Caption>
          One observation so far ({formatUsd(point.price)}). The chart draws a
          line after the next scan
          {skipped > 0
            ? ` · ${skipped} event${skipped === 1 ? "" : "s"} without a price listed in the Timeline`
            : ""}
        </Caption>
      </figcaption>
    </figure>
  );
}

function PriceLineChart({
  data,
  skipped,
}: {
  data: ChartPoint[];
  skipped: number;
}) {
  const first = data[0];
  const last = data[data.length - 1];
  const scale = priceScale(data.map((point) => point.price));
  const delta = formatDelta(first.price, last.price);
  const xTicks = data.length <= 6 ? data.map((point) => point.at) : undefined;
  const summary = `Pro price history, ${data.length} observations from ${formatShortDate(
    first.at,
  )} to ${formatShortDate(last.at)}. First ${formatUsd(first.price)}, latest ${formatUsd(
    last.price,
  )}, ${delta === "unchanged" ? "unchanged" : `change ${delta}`}.`;

  return (
    <figure role="img" aria-label={summary} className="m-0">
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <LineChart
          data={data}
          margin={{ top: 28, right: 12, bottom: 4, left: 0 }}
          accessibilityLayer={false}
        >
          <CartesianGrid vertical={false} stroke={GRID} strokeOpacity={0.6} />
          <XAxis
            dataKey="at"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={xTicks}
            tickFormatter={(value: number) => formatShortDate(value)}
            padding={{ left: 28, right: 28 }}
            minTickGap={24}
            tickMargin={8}
            tickLine={false}
            axisLine={{ stroke: GRID }}
            tick={{ fill: INK_MUTED, fontSize: 11, fontFamily: FONT_MONO }}
          />
          <YAxis
            type="number"
            domain={scale.domain}
            ticks={scale.ticks}
            tickFormatter={(value: number) => formatUsd(value)}
            width={48}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK_MUTED, fontSize: 11, fontFamily: FONT_MONO }}
          />
          <Tooltip
            content={PriceTooltip}
            cursor={{ stroke: GRID, strokeWidth: 1 }}
            isAnimationActive={false}
            wrapperStyle={{ outline: "none" }}
          />
          <Line
            type="linear"
            dataKey="price"
            name="Pro price"
            stroke={MARK_INFO}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            isAnimationActive={false}
            dot={(props: DotItemDotProps) => renderDot(props, data.length)}
            activeDot={renderActiveDot}
          />
        </LineChart>
      </ResponsiveContainer>
      <figcaption>
        <Caption>
          {data.length} observations · {formatUsd(first.price)} →{" "}
          {formatUsd(last.price)} · {delta}
          {skipped > 0
            ? ` · ${skipped} event${skipped === 1 ? "" : "s"} without a price listed in the Timeline`
            : ""}
        </Caption>
      </figcaption>
    </figure>
  );
}

export function PriceChartBlock({ block }: BlockComponentProps) {
  const competitorId = resolveCompetitorId(block);
  const state = useTimeline(competitorId);

  if (!competitorId) {
    return <BlockEmpty title="Price history" message={NO_COMPETITOR_MESSAGE} />;
  }

  if (state.kind === "loading") {
    return <BlockLoading title="Price history" />;
  }

  if (state.kind === "empty") {
    return <BlockEmpty title="Price history" message={EMPTY_HISTORY_MESSAGE} />;
  }

  if (state.kind === "error") {
    return <BlockError title="Price history" message={state.message} />;
  }

  const points = state.data;
  const data = toChartPoints(points);
  const skipped = points.length - data.length;

  if (data.length === 0) {
    return (
      <BlockEmpty
        title="Price history"
        message={`No Pro price in the history yet — ${points.length} event${
          points.length === 1 ? " is" : "s are"
        } listed in the Timeline`}
      />
    );
  }

  return (
    <BlockShell title="Price history" state="ready">
      {data.length === 1 ? (
        <SinglePoint point={data[0]} skipped={skipped} />
      ) : (
        <PriceLineChart data={data} skipped={skipped} />
      )}
    </BlockShell>
  );
}
