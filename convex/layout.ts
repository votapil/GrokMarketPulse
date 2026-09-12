/**
 * T-27 · Layout: Grok выбирает СОСТАВ блоков для сигнала — но не их содержимое.
 *
 * Модель возвращает только типы из закрытого перечня. Идентификаторы в `props`
 * подставляет сервер, поэтому внутрь блока физически не может попасть ни разметка,
 * ни данные от модели (ТЗ §41). Неизвестный тип отбрасывается ДО записи в базу.
 * Пустой или невалидный ответ → `layout: []`, и фронт берёт дефолтный набор.
 */

import { v } from "convex/values";
import type { Infer } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { vBlock } from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
} from "./grok";
import { REASONING_SYSTEM_PROMPT } from "./prompts/reasoning";

/** Закрытый перечень — зеркало `vBlockType` из schema.ts. Всё вне его отбрасывается. */
export const BLOCK_TYPES = [
  "SignalCard", "DiffView", "EvidenceCard", "MetricCards", "RecommendationCards",
  "SourceList", "Timeline", "Chart", "FeatureMatrix", "ActionPreview", "DataGrid",
  "GeoMap",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];
export type UiBlock = { id: string; type: BlockType; props: Record<string, string> };

/** Ссылки, из которых сервер собирает `props`. Ничего, кроме идентификаторов. */
export type LayoutRefs = {
  signalId: string;
  competitorId: string;
  artifactId: string | null;
};

const BLOCK_TYPE_SET: ReadonlySet<string> = new Set(BLOCK_TYPES);

/** Блокам этого списка нужен ещё и конкурент: история, сравнение, источники. */
const COMPETITOR_SCOPED: ReadonlySet<BlockType> = new Set<BlockType>([
  "Timeline", "Chart", "FeatureMatrix", "DataGrid", "SourceList", "GeoMap",
]);

const MAX_SIGNAL_BLOCKS = 6;

/** Сколько снапшотов на источник считаем: история нужна как признак «есть/нет». */
const HISTORY_SCAN_LIMIT = 25;

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPE_SET.has(value);
}

export function defaultLayout(signalId: string) {
  return [
    { id: "b1", type: "SignalCard" as const, props: { signalId } },
    { id: "b2", type: "DiffView" as const, props: { signalId } },
    { id: "b3", type: "EvidenceCard" as const, props: { signalId } },
    { id: "b4", type: "MetricCards" as const, props: { signalId } },
    { id: "b5", type: "RecommendationCards" as const, props: { signalId } },
  ];
}

// Приоритеты по типу бизнеса (ТЗ §23). Уходят в промпт подсказкой, а не жёстким
// фильтром: конкретный сигнал может требовать другого порядка.
const PRIORITY_SAAS: BlockType[] = [
  "DiffView", "MetricCards", "EvidenceCard", "FeatureMatrix", "DataGrid",
  "RecommendationCards",
];

const PRIORITY_LOCAL: BlockType[] = [
  "GeoMap", "SignalCard", "MetricCards", "EvidenceCard", "RecommendationCards",
];

const PRIORITY_ECOMMERCE: BlockType[] = [
  "DataGrid", "Chart", "DiffView", "MetricCards", "RecommendationCards",
];

const PRIORITY_GENERIC: BlockType[] = [
  "SignalCard", "DiffView", "EvidenceCard", "MetricCards", "RecommendationCards",
];

export function priorityFor(businessType: string): BlockType[] {
  const value = businessType.toLowerCase();
  if (/saas|software|b2b|platform|api|subscription/.test(value)) return PRIORITY_SAAS;
  if (/local|restaurant|clinic|salon|gym|brick|storefront/.test(value)) return PRIORITY_LOCAL;
  if (/e-?commerce|shop|store|marketplace|d2c|retail/.test(value)) return PRIORITY_ECOMMERCE;
  return PRIORITY_GENERIC;
}

/** `props` строит только сервер: блок без нужных идентификаторов не рендерится. */
function buildProps(type: BlockType, refs: LayoutRefs): Record<string, string> | null {
  if (type === "ActionPreview") {
    return refs.artifactId === null
      ? null
      : { signalId: refs.signalId, artifactId: refs.artifactId };
  }
  if (COMPETITOR_SCOPED.has(type)) {
    return { signalId: refs.signalId, competitorId: refs.competitorId };
  }
  return { signalId: refs.signalId };
}

/**
 * Единственный путь, которым тип блока от модели превращается в запись базы:
 * неизвестное — прочь, дубликаты — прочь, `props` — от сервера.
 */
export function composeBlocks(
  entries: ReadonlyArray<{ type: string; refs: LayoutRefs }>,
  max: number,
): UiBlock[] {
  const seen = new Set<string>();
  const blocks: UiBlock[] = [];

  for (const entry of entries) {
    if (blocks.length >= max) break;
    if (!isBlockType(entry.type)) continue;

    const key = `${entry.type}|${entry.refs.signalId}`;
    if (seen.has(key)) continue;

    const props = buildProps(entry.type, entry.refs);
    if (props === null) continue;

    seen.add(key);
    blocks.push({ id: `b${blocks.length + 1}`, type: entry.type, props });
  }

  return blocks;
}

export function composeLayout(
  types: ReadonlyArray<string>,
  refs: LayoutRefs,
  max: number = MAX_SIGNAL_BLOCKS,
): UiBlock[] {
  return composeBlocks(
    types.map((type) => ({ type, refs })),
    max,
  );
}

/** Гарантирует кадр 0:45: своя цена правится в DataGrid, а не в пустом Chart. */
export function pinDemoLoopBlocks(
  types: readonly string[],
  historyPoints: number,
): string[] {
  const next = types.filter((type) => {
    if (historyPoints >= 2) return true;
    return type !== "Chart" && type !== "Timeline";
  });

  if (next.includes("DataGrid")) {
    return next;
  }

  const chartIdx = next.indexOf("Chart");
  if (chartIdx >= 0) {
    return next.map((type, index) => (index === chartIdx ? "DataGrid" : type));
  }
  if (next.length < MAX_SIGNAL_BLOCKS) {
    return [...next, "DataGrid"];
  }
  return [...next.slice(0, MAX_SIGNAL_BLOCKS - 1), "DataGrid"];
}

export const LAYOUT_INSTRUCTIONS = `${REASONING_SYSTEM_PROMPT}

Pick which UI blocks the app renders for one competitive signal.

Allowed block types — CLOSED list, anything else is dropped by the server:
${BLOCK_TYPES.join(", ")}

Hard rules:
- Return 4 to 6 blocks, most important first.
- Use each type at most once.
- You choose WHICH blocks appear. You never choose their content, markup, or styling.
- Never pick a block whose data is missing: no recommendations -> no RecommendationCards,
  no artifact -> no ActionPreview, no price history -> no Timeline and no Chart.
- GeoMap only when the business is location-based.
- Follow the priority order given for this business type unless the signal clearly
  calls for a different emphasis.
- "reason" is one short sentence for the server log; it is never shown to a user.`;

export const LAYOUT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["blocks"],
  properties: {
    blocks: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "reason"],
        properties: {
          type: { type: "string", enum: [...BLOCK_TYPES] },
          reason: { type: "string" },
        },
      },
    },
  },
} as const;

type LayoutDraft = { blocks: Array<{ type: string; reason: string }> };

function isLayoutDraft(value: unknown): value is LayoutDraft {
  if (!value || typeof value !== "object") return false;
  const rows = (value as { blocks?: unknown }).blocks;
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 12) return false;
  return rows.every((row) => {
    if (!row || typeof row !== "object") return false;
    const o = row as Record<string, unknown>;
    return typeof o.type === "string" && typeof o.reason === "string";
  });
}

const vLayoutContext = v.object({
  workspaceId: v.id("workspaces"),
  signalId: v.id("signals"),
  competitorId: v.id("competitors"),
  competitorName: v.string(),
  competitorKind: v.string(),
  businessType: v.string(),
  category: v.string(),
  signalType: v.string(), title: v.string(), summary: v.string(),
  previousState: v.string(), currentState: v.string(),
  kind: v.string(), severity: v.string(), urgency: v.string(),
  score: v.number(), confidence: v.number(), status: v.string(),
  hasAssessment: v.boolean(),
  recommendationCount: v.number(),
  evidenceCount: v.number(),
  historyPoints: v.number(),
  artifactId: v.union(v.null(), v.id("artifacts")),
});

type LayoutContext = Infer<typeof vLayoutContext>;

export const loadContext = internalQuery({
  args: { signalId: v.id("signals") },
  returns: v.union(v.null(), vLayoutContext),
  handler: async (ctx, { signalId }): Promise<LayoutContext | null> => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;

    const competitor = await ctx.db.get("competitors", signal.competitorId);
    if (!competitor) return null;

    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", signal.workspaceId))
      .first();

    const evidence = await ctx.db
      .query("evidence")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .take(20);

    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_signal", (q) => q.eq("signalId", signalId))
      .take(10);
    const ready = artifacts.filter((row) => row.status === "ready");
    const artifact = ready[ready.length - 1] ?? null;

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_competitor", (q) => q.eq("competitorId", signal.competitorId))
      .take(10);

    let historyPoints = 0;
    for (const source of sources) {
      const snapshots = await ctx.db
        .query("snapshots")
        .withIndex("by_source_and_time", (q) => q.eq("sourceId", source._id))
        .take(HISTORY_SCAN_LIMIT);
      historyPoints += snapshots.length;
    }

    return {
      workspaceId: signal.workspaceId,
      signalId: signal._id,
      competitorId: competitor._id,
      competitorName: competitor.name,
      competitorKind: competitor.kind,
      businessType: company?.context?.businessType ?? "",
      category: company?.context?.category ?? "",
      signalType: signal.type,
      title: signal.title,
      summary: signal.summary,
      previousState: signal.previousState,
      currentState: signal.currentState,
      kind: signal.kind,
      severity: signal.severity,
      urgency: signal.urgency,
      score: signal.score,
      confidence: signal.confidence,
      status: signal.status,
      hasAssessment: signal.assessment !== null,
      recommendationCount: signal.recommendations.length,
      evidenceCount: evidence.length,
      historyPoints,
      artifactId: artifact?._id ?? null,
    };
  },
});

function buildLayoutInput(context: LayoutContext): string {
  const businessType = context.businessType.length > 0 ? context.businessType : "unknown";
  return [
    `Our business type: ${businessType} (${context.category || "unknown category"})`,
    `Priority order for this business type: ${priorityFor(businessType).join(", ")}`,
    "",
    `Competitor: ${context.competitorName} (${context.competitorKind})`,
    `Signal type: ${context.signalType}`,
    `Title: ${context.title}`,
    `Summary: ${context.summary}`,
    `Change: ${context.previousState} -> ${context.currentState}`,
    `Kind ${context.kind}; severity ${context.severity}; urgency ${context.urgency};`,
    `score ${context.score}; confidence ${context.confidence}; status ${context.status}`,
    "",
    "Data available for this signal:",
    `- assessment: ${context.hasAssessment ? "yes" : "no"}`,
    `- recommendations: ${context.recommendationCount}`,
    `- evidence items: ${context.evidenceCount}`,
    `- price history points: ${context.historyPoints}`,
    `- generated artifact: ${context.artifactId === null ? "no" : "yes"}`,
  ].join("\n");
}

export const save = internalMutation({
  args: { signalId: v.id("signals"), blocks: v.array(vBlock) },
  returns: v.null(),
  handler: async (ctx, { signalId, blocks }) => {
    const signal = await ctx.db.get("signals", signalId);
    if (!signal) return null;

    // Копии, а не ссылки на входной массив — вход не мутируем.
    const layout = blocks.map((block) => ({
      ...block,
      props: { ...block.props },
    }));

    await ctx.db.patch("signals", signalId, { layout });
    return null;
  },
});

export const build = internalAction({
  args: { signalId: v.id("signals") },
  returns: v.null(),
  handler: async (ctx, { signalId }): Promise<null> => {
    const context: LayoutContext | null = await ctx.runQuery(
      internal.layout.loadContext,
      { signalId },
    );
    if (!context) {
      console.error(`layout.build: signal ${signalId} not found`);
      return null;
    }

    const refs: LayoutRefs = {
      signalId: context.signalId,
      competitorId: context.competitorId,
      artifactId: context.artifactId,
    };

    try {
      const result = await callGrok({
        model: GROK_DEFAULT_MODEL,
        instructions: LAYOUT_INSTRUCTIONS,
        input: buildLayoutInput(context),
        schema: {
          name: "signal_layout",
          schema: LAYOUT_JSON_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
        maxOutputTokens: 700,
        reasoningEffort: "low",
      });

      await ctx.runMutation(internal.costs.log, {
        workspaceId: context.workspaceId,
        provider: "xai",
        op: "layout.build",
        costUsd: ticksToUsd(result.costUsdTicks),
        credits: 0,
      });

      const parsed = parseJsonWithRetry(result.text, isLayoutDraft);
      if (!parsed.ok) {
        // Деградация, а не падение: пустой layout → фронт рисует дефолтный набор.
        console.error(`layout.build: ${parsed.error} for signal ${signalId}`);
        await ctx.runMutation(internal.layout.save, { signalId, blocks: [] });
        return null;
      }

      // Кадр 0:45 требует DataGrid на холсте. Модель часто ставит Chart
      // без истории цены — слот пустой, править Pro негде.
      const types = pinDemoLoopBlocks(
        parsed.value.blocks.map((row) => row.type),
        context.historyPoints,
      );
      const blocks = composeLayout(types, refs);
      await ctx.runMutation(internal.layout.save, { signalId, blocks });
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : "layout build failed";
      console.error(`layout.build failed for signal ${signalId}: ${message}`);
      await ctx.runMutation(internal.layout.save, { signalId, blocks: [] });
      return null;
    }
  },
});
