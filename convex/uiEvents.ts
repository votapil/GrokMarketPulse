/**
 * T-29 · UI events: правка блока пользователем возвращается в модель невидимым
 * событием.
 *
 * Событие пишется в `chatMessages` с ролью "system" — фронт его не рендерит,
 * модель видит. Следом планируется новый ответ ассистента, который отдаёт
 * НОВЫЙ набор блоков: холст перекладывается. События, меняющие смысл сигнала,
 * дополнительно пересобирают `signals.layout`.
 *
 * Неизвестное действие не роняет запрос: событие всё равно записывается,
 * ассистент отвечает общим текстом.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { queueAssistantTurn } from "./chat";

/** Сырой payload попадает в промпт — держим его коротким. */
const MAX_PAYLOAD_CHARS = 500;
/** Сколько последних сигналов просматриваем, когда ищем сигнал события. */
const SIGNAL_SCAN_LIMIT = 25;

/** После этих действий центр экрана должен собраться заново. */
const LAYOUT_REBUILD_ACTIONS: ReadonlySet<string> = new Set([
  "select_signal",
  "edit_plan_price",
]);

type EventDescription = { text: string; hint: string };

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max)}…`;
}

/** Payload приходит строкой: пробуем JSON, иначе кладём как есть. */
function parsePayload(payload: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Не JSON — это допустимо, читаем как обычную строку.
  }
  return { value: payload };
}

function readString(
  fields: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): string | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readNumber(
  fields: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): number | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function readBoolean(
  fields: Record<string, unknown>,
  keys: ReadonlyArray<string>,
): boolean | null {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === "boolean") return value;
    if (value === "true") return true;
    if (value === "false") return false;
  }
  return null;
}

function describeEvent(
  blockId: string,
  actionName: string,
  payload: string,
  fields: Record<string, unknown>,
): EventDescription {
  const raw = `Raw payload: ${clip(payload, MAX_PAYLOAD_CHARS)}`;

  if (actionName === "edit_plan_price") {
    const plan = readString(fields, ["plan", "planName", "name", "tier"]) ?? "our plan";
    const usd = readNumber(fields, ["usd", "price", "value", "amount"]);
    const previous = readNumber(fields, ["previousUsd", "previous", "oldUsd", "from"]);
    const from = previous === null ? "" : ` from $${previous}`;
    const to = usd === null ? "" : ` to $${usd}`;
    return {
      text: `UI event on block ${blockId}: the user changed OUR ${plan} price${from}${to}. ${raw}`,
      hint: "Our own plan price just changed in the pricing table. Recompute the gap against the competitor, say in one or two sentences what it means for the current signal, and return the blocks that matter now.",
    };
  }

  if (actionName === "toggle_filter") {
    const name = readString(fields, ["filter", "name", "key"]) ?? "a filter";
    const enabled = readBoolean(fields, ["enabled", "value", "on", "checked"]);
    const state = enabled === null ? "to a new state" : enabled ? "on" : "off";
    return {
      text: `UI event on block ${blockId}: the user switched ${name} ${state}. ${raw}`,
      hint: "The user narrowed the view with a filter. Acknowledge what is in scope now in one sentence and return the blocks that fit that scope.",
    };
  }

  if (actionName === "update_radius") {
    const radius = readNumber(fields, ["radius_km", "radiusKm", "radius", "value"]);
    const label = radius === null ? "a new radius" : `${radius} km`;
    return {
      text: `UI event on block ${blockId}: the user set the map radius to ${label}. ${raw}`,
      hint: "The user changed the map radius. Say what that area covers for this signal in one or two sentences and return the blocks that fit it.",
    };
  }

  if (actionName === "select_signal") {
    const signalId = readString(fields, ["signalId", "id", "value"]) ?? "another signal";
    return {
      text: `UI event on block ${blockId}: the user selected signal ${signalId}. ${raw}`,
      hint: "The user selected another signal. Summarise it in two sentences and return the blocks that belong on the canvas for it.",
    };
  }

  return {
    text: `UI event on block ${blockId}: ${actionName}. ${raw}`,
    hint: "This UI action is not one the app knows how to interpret. Give a short, honest update on the signal in focus and return the blocks that fit it.",
  };
}

/**
 * Сигнал, к которому относится событие: явный id из payload (только если он
 * действительно есть в воркспейсе) или самый свежий сигнал.
 */
async function resolveSignalId(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
  requestedId: string | null,
): Promise<Id<"signals"> | null> {
  const recent = await ctx.db
    .query("signals")
    .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
    .order("desc")
    .take(SIGNAL_SCAN_LIMIT);

  if (requestedId !== null) {
    // Сравниваем строками: произвольный id из payload нельзя отдавать в db.get.
    const match = recent.find((signal) => signal._id === requestedId);
    if (match) return match._id;
  }

  return recent[0]?._id ?? null;
}

export const handleEvent = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    blockId: v.string(),
    action: v.string(),
    payload: v.string(),
  },
  returns: v.union(v.object({ messageId: v.id("chatMessages") }), v.null()),
  handler: async (ctx, args): Promise<{ messageId: Id<"chatMessages"> } | null> => {
    if (args.action === "noop") {
      return null;
    }

    const fields = parsePayload(args.payload);
    const described = describeEvent(args.blockId, args.action, args.payload, fields);
    const focusSignalId = await resolveSignalId(
      ctx,
      args.workspaceId,
      readString(fields, ["signalId", "id"]),
    );

    const now = Date.now();

    // Скрытое сообщение: фронт его не рендерит, модель читает как инструкцию.
    await ctx.db.insert("chatMessages", {
      workspaceId: args.workspaceId,
      role: "system",
      text: described.text,
      blocks: [],
      status: "ready",
      createdAt: now,
    });

    const messageId = await queueAssistantTurn(ctx, {
      workspaceId: args.workspaceId,
      createdAt: now + 1,
      focusSignalId,
      hint: described.hint,
    });

    // Холст сигнала пересобирается отдельно от ответа в чате: сбой одного
    // не должен уносить второе.
    if (LAYOUT_REBUILD_ACTIONS.has(args.action) && focusSignalId !== null) {
      await ctx.scheduler.runAfter(0, internal.layout.build, {
        signalId: focusSignalId,
        // Кадр 0:45: правка своей цены обязана вывести FeatureMatrix на холст.
        ...(args.action === "edit_plan_price" ? { emphasis: "pricing_edit" as const } : {}),
      });
    }

    return { messageId };
  },
});

export const send = action({
  args: {
    workspaceId: v.id("workspaces"),
    blockId: v.string(),
    action: v.string(),
    payload: v.string(),
  },
  returns: v.union(v.object({ messageId: v.id("chatMessages") }), v.null()),
  handler: async (
    ctx,
    args,
  ): Promise<{ messageId: Id<"chatMessages"> } | null> => {
    return await ctx.runMutation(internal.uiEvents.handleEvent, args);
  },
});
