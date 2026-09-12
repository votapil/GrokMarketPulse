/**
 * T-29 · Chat: `chat.ask` пишет реплику пользователя и сразу возвращает id
 * пустого сообщения ассистента (фронт показывает скелетон), а ответ дописывает
 * запланированный action.
 *
 * Ответ модели — `{ response_text, blocks[] }`. Типы блоков проверяются по
 * закрытому перечню НА СЕРВЕРЕ, `props` собирает сервер из настоящих
 * идентификаторов. Ошибка модели → сообщение со `status: "error"`,
 * история при этом не рушится.
 */

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { internal } from "./_generated/api";
import schema, { vBlock } from "./schema";
import {
  callGrok,
  GROK_DEFAULT_MODEL,
  parseJsonWithRetry,
  ticksToUsd,
  truncateMarkdown,
} from "./grok";
import { BLOCK_TYPES, composeBlocks, type UiBlock } from "./layout";
import { renderChatContext, type ChatContext } from "./history";
import { REASONING_SYSTEM_PROMPT } from "./prompts/reasoning";

/** Сколько сообщений отдаём фронту. Лента чата демо-воркспейса короткая. */
const MAX_LISTED_MESSAGES = 200;
/** Потолок блоков в одном ответе ассистента. */
const MAX_CHAT_BLOCKS = 4;
/** Потолок на весь контекст промпта. */
const MAX_CONTEXT_CHARS = 24_000;

/** Человеческий текст на случай, если модель недоступна. */
const ERROR_TEXT =
  "I could not answer that just now — the model call failed. Ask again in a moment.";

export const list = query({
  args: { workspaceId: v.id("workspaces") },
  returns: v.array(schema.doc("chatMessages")),
  handler: async (ctx, { workspaceId }) => {
    // Берём хвост ленты, отдаём в хронологическом порядке.
    const recent = await ctx.db
      .query("chatMessages")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(MAX_LISTED_MESSAGES);

    return [...recent].reverse();
  },
});

/**
 * Пустое сообщение ассистента + запланированная генерация.
 * Общий помощник для `chat.ask` и для событий из `uiEvents.ts`.
 */
export async function queueAssistantTurn(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    createdAt: number;
    focusSignalId: Id<"signals"> | null;
    hint: string;
  },
): Promise<Id<"chatMessages">> {
  const assistantMessageId = await ctx.db.insert("chatMessages", {
    workspaceId: args.workspaceId,
    role: "assistant",
    text: "",
    blocks: [],
    status: "pending",
    createdAt: args.createdAt,
  });

  await ctx.scheduler.runAfter(0, internal.chat.generate, {
    workspaceId: args.workspaceId,
    assistantMessageId,
    focusSignalId: args.focusSignalId,
    hint: args.hint,
  });

  return assistantMessageId;
}

export const startExchange = internalMutation({
  args: {
    workspaceId: v.id("workspaces"),
    text: v.string(),
    signalId: v.optional(v.id("signals")),
  },
  returns: v.object({ messageId: v.id("chatMessages") }),
  handler: async (ctx, { workspaceId, text, signalId }) => {
    const now = Date.now();

    await ctx.db.insert("chatMessages", {
      workspaceId,
      role: "user",
      text,
      blocks: [],
      status: "ready",
      createdAt: now,
    });

    const messageId = await queueAssistantTurn(ctx, {
      workspaceId,
      createdAt: now + 1,
      focusSignalId: signalId ?? null,
      hint: "Answer the last user message.",
    });

    return { messageId };
  },
});

export const finish = internalMutation({
  args: {
    messageId: v.id("chatMessages"),
    text: v.string(),
    blocks: v.array(vBlock),
  },
  returns: v.null(),
  handler: async (ctx, { messageId, text, blocks }) => {
    const message = await ctx.db.get("chatMessages", messageId);
    if (!message) return null;

    // Копии, а не ссылки на входной массив — вход не мутируем.
    await ctx.db.patch("chatMessages", messageId, {
      text,
      blocks: blocks.map((block) => ({ ...block, props: { ...block.props } })),
      status: "ready",
    });
    return null;
  },
});

export const fail = internalMutation({
  args: { messageId: v.id("chatMessages") },
  returns: v.null(),
  handler: async (ctx, { messageId }) => {
    const message = await ctx.db.get("chatMessages", messageId);
    if (!message) return null;

    await ctx.db.patch("chatMessages", messageId, {
      text: ERROR_TEXT,
      blocks: [],
      status: "error",
    });
    return null;
  },
});

export const CHAT_INSTRUCTIONS = `${REASONING_SYSTEM_PROMPT}

You are the analyst assistant inside GrokMarketPulse, a competitive monitoring app.
Answer the last turn of the conversation using ONLY the context provided.

Answer rules:
- English, plain sentences, at most 120 words. No markdown headings, no HTML, no code.
- Be concrete: name prices, competitors, scores and dates from the context.
- When you explain a severity, score or urgency, cite the evidence by its title and url
  instead of restating the summary.
- A "system" turn is a UI event the user performed in the interface. Treat it as the
  user's instruction and react to what actually changed.
- If the context does not hold the answer, say so in one sentence. Never invent numbers.

Then choose 0 to ${MAX_CHAT_BLOCKS} blocks for the app to render next to your answer.
Allowed block types — CLOSED list, anything else is dropped by the server:
${BLOCK_TYPES.join(", ")}

Block rules:
- Each block carries only a type and the signalId it refers to; copy a signalId from the context.
- You choose WHICH blocks appear. You never choose their content, markup or styling.
- Never pick a block whose data is missing: no recommendations -> no RecommendationCards,
  no artifact -> no ActionPreview, no price history -> no Timeline and no Chart.
- If a signal is in focus, pick at least one of DiffView or MetricCards.
- An empty blocks array is allowed only when the context has no signal at all.`;

export const CHAT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["response_text", "blocks"],
  properties: {
    response_text: { type: "string" },
    blocks: {
      type: "array",
      maxItems: MAX_CHAT_BLOCKS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "signalId"],
        properties: {
          type: { type: "string", enum: [...BLOCK_TYPES] },
          signalId: { type: "string" },
        },
      },
    },
  },
} as const;

type ChatDraftBlock = { type: string; signalId: string };
type ChatDraft = { response_text: string; blocks: ChatDraftBlock[] };

function isChatDraft(value: unknown): value is ChatDraft {
  if (!value || typeof value !== "object") return false;
  const o = value as Record<string, unknown>;
  if (typeof o.response_text !== "string" || o.response_text.trim().length === 0) {
    return false;
  }
  if (!Array.isArray(o.blocks) || o.blocks.length > 8) return false;

  return o.blocks.every((row) => {
    if (!row || typeof row !== "object") return false;
    const block = row as Record<string, unknown>;
    return typeof block.type === "string" && typeof block.signalId === "string";
  });
}

/**
 * Черновик модели → блоки для базы. Тип обязан быть в перечне, signalId — среди
 * сигналов контекста (иначе берём сигнал в фокусе), `props` собирает сервер.
 */
function composeChatBlocks(
  drafts: ReadonlyArray<ChatDraftBlock>,
  context: ChatContext,
): UiBlock[] {
  const known = new Map(
    context.signals.map((signal) => [signal.signalId as string, signal]),
  );
  if (context.focus !== null) {
    known.set(context.focus.signalId, context.focus);
  }

  const fallback = context.focus ?? context.signals[0] ?? null;

  const entries = drafts.flatMap((draft) => {
    const signal = known.get(draft.signalId) ?? fallback;
    if (!signal) return [];
    return [
      {
        type: draft.type,
        refs: {
          signalId: signal.signalId as string,
          competitorId: signal.competitorId as string,
          artifactId: signal.artifactId as string | null,
        },
      },
    ];
  });

  const composed = composeBlocks(entries, MAX_CHAT_BLOCKS);
  if (composed.length > 0 || !fallback) {
    return composed;
  }

  // Чип «Why is this High?» обязан вернуть блоки, даже если модель отдала [].
  return composeBlocks(
    [
      {
        type: "MetricCards",
        refs: {
          signalId: fallback.signalId as string,
          competitorId: fallback.competitorId as string,
          artifactId: fallback.artifactId as string | null,
        },
      },
      {
        type: "DiffView",
        refs: {
          signalId: fallback.signalId as string,
          competitorId: fallback.competitorId as string,
          artifactId: fallback.artifactId as string | null,
        },
      },
    ],
    MAX_CHAT_BLOCKS,
  );
}

function buildChatInput(context: ChatContext, hint: string): string {
  const body = renderChatContext(context);
  const tail = hint.trim().length > 0 ? `\n\nTask: ${hint.trim()}` : "";
  return `${truncateMarkdown(body, MAX_CONTEXT_CHARS)}${tail}`;
}

export const generate = internalAction({
  args: {
    workspaceId: v.id("workspaces"),
    assistantMessageId: v.id("chatMessages"),
    focusSignalId: v.union(v.null(), v.id("signals")),
    hint: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    try {
      const context: ChatContext = await ctx.runQuery(internal.history.chatContext, {
        workspaceId: args.workspaceId,
        focusSignalId: args.focusSignalId,
      });

      const result = await callGrok({
        model: GROK_DEFAULT_MODEL,
        instructions: CHAT_INSTRUCTIONS,
        input: buildChatInput(context, args.hint),
        schema: {
          name: "chat_reply",
          schema: CHAT_JSON_SCHEMA as unknown as Record<string, unknown>,
          strict: true,
        },
        maxOutputTokens: 1200,
        reasoningEffort: "low",
      });

      await ctx.runMutation(internal.costs.log, {
        workspaceId: args.workspaceId,
        provider: "xai",
        op: "chat.generate",
        costUsd: ticksToUsd(result.costUsdTicks),
        credits: 0,
      });

      const parsed = parseJsonWithRetry(result.text, isChatDraft);
      if (!parsed.ok) {
        throw new Error(`malformed chat JSON: ${parsed.error}`);
      }

      await ctx.runMutation(internal.chat.finish, {
        messageId: args.assistantMessageId,
        text: parsed.value.response_text.trim(),
        blocks: composeChatBlocks(parsed.value.blocks, context),
      });
      return null;
    } catch (error) {
      // Ошибку не глотаем: подробности в логи деплоймента, пользователю —
      // сообщение со статусом "error"; остальная история цела.
      const detail = error instanceof Error ? error.message : "unknown error";
      console.error(`chat.generate failed for ${args.assistantMessageId}: ${detail}`);
      await ctx.runMutation(internal.chat.fail, {
        messageId: args.assistantMessageId,
      });
      return null;
    }
  },
});

export const ask = action({
  args: {
    workspaceId: v.id("workspaces"),
    text: v.string(),
    signalId: v.optional(v.id("signals")),
  },
  returns: v.object({ messageId: v.id("chatMessages") }),
  handler: async (ctx, args): Promise<{ messageId: Id<"chatMessages"> }> => {
    return await ctx.runMutation(internal.chat.startExchange, args);
  },
});
