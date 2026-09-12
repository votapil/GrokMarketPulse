/**
 * T-28 `history.timeline` — лента изменений конкурента.
 * T-29 `history.chatContext` — усечённый контекст для промпта чата:
 * company context + последние сигналы с assessment + текущий сигнал с evidence
 * + переписка, обрезанная и по числу сообщений, и по символам.
 */

import { v } from "convex/values";
import type { Infer } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalQuery, query } from "./_generated/server";
import { vAssessment, vCompanyContext, vLevel, vSignalStatus } from "./schema";

/** Снапшотов на источник в ленте: демо-сайт флипают десятки раз за день. */
const HISTORY_LIMIT = 200;

/** Первая сумма в долларах из строки состояния сигнала: "Pro $39/mo" → 39. */
export function parsePrice(state: string): number | null {
  const match = state.match(/\$\s?(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

/** Подпись снимка по направлению относительно предыдущего: cut / raised / unchanged. */
export function describeSnapshot(
  isBaseline: boolean,
  previousPrice: number | null,
  price: number | null,
): string {
  const shown = price === null ? "?" : String(price);
  if (isBaseline) return `Baseline Pro $${shown}`;
  if (price === null || previousPrice === null) return `Pro observed at $${shown}`;
  if (price < previousPrice) return `Pro cut to $${shown}`;
  if (price > previousPrice) return `Pro raised to $${shown}`;
  return `Pro unchanged at $${shown}`;
}

export const timeline = query({
  args: { competitorId: v.id("competitors") },
  returns: v.array(
    v.object({
      at: v.number(),
      label: v.string(),
      price: v.union(v.number(), v.null()),
      signalId: v.union(v.null(), v.id("signals")),
    }),
  ),
  handler: async (ctx, { competitorId }) => {
    const competitor = await ctx.db.get("competitors", competitorId);
    if (!competitor) {
      return [];
    }

    const sources = await ctx.db
      .query("sources")
      .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
      .collect();

    const entries: Array<{
      at: number;
      label: string;
      price: number | null;
      signalId: Id<"signals"> | null;
    }> = [];

    for (const source of sources) {
      const snapshots = await ctx.db
        .query("snapshots")
        .withIndex("by_source_and_time", (q) => q.eq("sourceId", source._id))
        .take(HISTORY_LIMIT);

      let previousPrice: number | null = null;
      for (const snapshot of snapshots) {
        const proPlan = snapshot.plans.find((plan) => plan.name === "Pro");
        const price = proPlan?.usd ?? null;
        entries.push({
          at: snapshot.fetchedAt,
          label: describeSnapshot(snapshot.isBaseline, previousPrice, price),
          price,
          signalId: null,
        });
        previousPrice = price ?? previousPrice;
      }
    }

    const signals = await ctx.db
      .query("signals")
      .withIndex("by_competitor", (q) => q.eq("competitorId", competitorId))
      .collect();

    const result = entries.map((entry) => ({ ...entry }));
    for (const signal of signals) {
      const idx = result.findIndex((entry) => entry.at === signal.detectedAt);
      if (idx >= 0) {
        result[idx] = {
          at: signal.detectedAt,
          label: signal.title,
          price: result[idx].price,
          signalId: signal._id,
        };
      } else {
        const proPrice = parsePrice(signal.currentState);
        result.push({
          at: signal.detectedAt,
          label: signal.title,
          price: proPrice,
          signalId: signal._id,
        });
      }
    }

    return result.sort((a, b) => a.at - b.at);
  },
});

// --- T-29: контекст переписки для промпта ---------------------------------

/** Сколько последних сообщений вообще рассматриваем. */
export const MAX_TRANSCRIPT_MESSAGES = 12;
/** Общий бюджет символов на всю переписку в промпте. */
export const MAX_TRANSCRIPT_CHARS = 4_000;
/** Потолок на одно сообщение внутри этого бюджета. */
const MAX_TURN_CHARS = 600;
/** Сколько последних сигналов кладём в контекст. */
const MAX_CONTEXT_SIGNALS = 5;
/** Сколько evidence-фрагментов даём по текущему сигналу. */
const MAX_FOCUS_EVIDENCE = 6;
const MAX_FRAGMENT_CHARS = 400;
/** Из скольких последних сообщений набираем усечённую переписку. */
const TRANSCRIPT_SCAN_LIMIT = 30;

const vRole = v.union(v.literal("user"), v.literal("assistant"), v.literal("system"));

const vTranscriptTurn = v.object({ role: vRole, text: v.string() });

const vContextSignal = v.object({
  signalId: v.id("signals"),
  competitorId: v.id("competitors"),
  competitorName: v.string(),
  artifactId: v.union(v.null(), v.id("artifacts")),
  type: v.string(),
  title: v.string(),
  summary: v.string(),
  previousState: v.string(),
  currentState: v.string(),
  kind: v.string(),
  severity: vLevel,
  urgency: vLevel,
  score: v.number(),
  confidence: v.number(),
  status: vSignalStatus,
  detectedAt: v.number(),
  assessment: v.union(v.null(), vAssessment),
  recommendations: v.array(v.string()),
});

const vEvidenceLine = v.object({
  kind: v.string(),
  title: v.string(),
  url: v.string(),
  fragment: v.string(),
});

const vChatContext = v.object({
  companyName: v.string(),
  companyUrl: v.string(),
  companyContext: v.union(v.null(), vCompanyContext),
  focus: v.union(v.null(), vContextSignal),
  focusEvidence: v.array(vEvidenceLine),
  signals: v.array(vContextSignal),
  transcript: v.array(vTranscriptTurn),
});

export type TranscriptTurn = Infer<typeof vTranscriptTurn>;
export type ContextSignal = Infer<typeof vContextSignal>;
export type ChatContext = Infer<typeof vChatContext>;

export function truncateText(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max)}…`;
}

/**
 * Последние сообщения в хронологическом порядке, обрезанные дважды: по числу
 * реплик и по общему бюджету символов. Вход не мутируется.
 */
export function truncateTranscript(
  turns: ReadonlyArray<TranscriptTurn>,
  maxMessages: number = MAX_TRANSCRIPT_MESSAGES,
  maxChars: number = MAX_TRANSCRIPT_CHARS,
): TranscriptTurn[] {
  const recent = turns.slice(-maxMessages);
  const kept: TranscriptTurn[] = [];
  let budget = maxChars;

  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const turn = recent[i]!;
    const text = truncateText(turn.text, MAX_TURN_CHARS);
    if (text.length === 0) continue;
    if (text.length > budget) break;
    budget -= text.length;
    kept.push({ role: turn.role, text });
  }

  return kept.reverse();
}

function renderSignal(signal: ContextSignal, prefix: string): string {
  const lines = [
    `${prefix} id=${signal.signalId} competitorId=${signal.competitorId}`,
    `  competitor: ${signal.competitorName}`,
    `  ${signal.type}: ${signal.title}`,
    `  summary: ${signal.summary}`,
    `  change: ${signal.previousState} -> ${signal.currentState}`,
    `  kind ${signal.kind}; severity ${signal.severity}; urgency ${signal.urgency}; score ${signal.score}; confidence ${signal.confidence}; status ${signal.status}`,
  ];

  if (signal.assessment !== null) {
    lines.push(
      `  why: ${signal.assessment.why}`,
      `  position change: ${signal.assessment.positionChange}`,
      `  score explanation: ${signal.assessment.scoreExplanation}`,
      `  affected: ${signal.assessment.affectedAreas.join(", ")} / segments: ${signal.assessment.affectedSegments.join(", ")}`,
      `  reaction speed: ${signal.assessment.reactionSpeed}`,
    );
  }

  if (signal.recommendations.length > 0) {
    lines.push(`  recommendations: ${signal.recommendations.join(" | ")}`);
  }

  return lines.join("\n");
}

/** Текстовый блок контекста для промпта. Ничего не читает — чистая функция. */
export function renderChatContext(context: ChatContext): string {
  const parts: string[] = [
    `Our company: ${context.companyName} (${context.companyUrl})`,
    "Company context (JSON):",
    JSON.stringify(context.companyContext, null, 2),
  ];

  if (context.focus === null) {
    parts.push("", "No signal is currently in focus.");
  } else {
    parts.push("", renderSignal(context.focus, "FOCUS SIGNAL"));
  }

  if (context.focusEvidence.length > 0) {
    parts.push(
      "",
      "Evidence for the focus signal (cite these by title and url):",
      ...context.focusEvidence.map(
        (row) => `- [${row.kind}] ${row.title} — ${row.url}\n  ${row.fragment}`,
      ),
    );
  }

  const others = context.signals.filter(
    (signal) => signal.signalId !== context.focus?.signalId,
  );
  if (others.length > 0) {
    parts.push(
      "",
      "Other recent signals:",
      ...others.map((signal) => renderSignal(signal, "SIGNAL")),
    );
  }

  if (context.transcript.length > 0) {
    parts.push(
      "",
      "Conversation so far (system turns are hidden UI events the user triggered):",
      ...context.transcript.map((turn) => `${turn.role}: ${turn.text}`),
    );
  }

  return parts.join("\n");
}

export const chatContext = internalQuery({
  args: {
    workspaceId: v.id("workspaces"),
    focusSignalId: v.union(v.null(), v.id("signals")),
  },
  returns: vChatContext,
  handler: async (ctx, { workspaceId, focusSignalId }): Promise<ChatContext> => {
    const company = await ctx.db
      .query("companies")
      .withIndex("by_workspace", (q) => q.eq("workspaceId", workspaceId))
      .first();

    const recent = await ctx.db
      .query("signals")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(MAX_CONTEXT_SIGNALS);

    const toContextSignal = async (
      signal: (typeof recent)[number],
    ): Promise<ContextSignal> => {
      const competitor = await ctx.db.get("competitors", signal.competitorId);
      const artifacts = await ctx.db
        .query("artifacts")
        .withIndex("by_signal", (q) => q.eq("signalId", signal._id))
        .take(10);
      const ready = artifacts.filter((row) => row.status === "ready");

      return {
        signalId: signal._id,
        competitorId: signal.competitorId,
        competitorName: competitor?.name ?? "Unknown competitor",
        artifactId: ready[ready.length - 1]?._id ?? null,
        type: signal.type,
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
        detectedAt: signal.detectedAt,
        assessment: signal.assessment,
        recommendations: signal.recommendations.map((rec) => rec.title),
      };
    };

    const signals = await Promise.all(recent.map(toContextSignal));

    // Сигнал из другого воркспейса в контекст не пускаем.
    const requested =
      focusSignalId === null ? null : await ctx.db.get("signals", focusSignalId);
    const explicitFocus =
      requested && requested.workspaceId === workspaceId ? requested : null;
    const focus = explicitFocus
      ? await toContextSignal(explicitFocus)
      : (signals[0] ?? null);

    const focusEvidence = focus
      ? (
          await ctx.db
            .query("evidence")
            .withIndex("by_signal", (q) => q.eq("signalId", focus.signalId))
            .take(MAX_FOCUS_EVIDENCE)
        ).map((row) => ({
          kind: row.kind,
          title: row.title,
          url: row.url,
          fragment: truncateText(row.fragment, MAX_FRAGMENT_CHARS),
        }))
      : [];

    const messages = await ctx.db
      .query("chatMessages")
      .withIndex("by_workspace_and_time", (q) => q.eq("workspaceId", workspaceId))
      .order("desc")
      .take(TRANSCRIPT_SCAN_LIMIT);

    const turns = messages
      .map((message) => ({ role: message.role, text: message.text }))
      .reverse();

    return {
      companyName: company?.name ?? "Unknown company",
      companyUrl: company?.url ?? "",
      companyContext: company?.context ?? null,
      focus,
      focusEvidence,
      signals,
      transcript: truncateTranscript(turns),
    };
  },
});
