import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { BlockList } from "@/components/blocks/BlockRenderer";
import type { UiBlock } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * T-30: чат правой панели. История — api.chat.list, вопрос — api.chat.ask.
 * Сообщения role "system" — невидимые UI-события от блоков: в ленту не попадают,
 * существуют только как контекст модели (петля блок → модель → новый layout).
 * Воркспейс берём сами из api.workspace.demo — Convex дедуплицирует подписку с PulseScreen.
 * Callers: ActionPanel (нижняя секция правой панели).
 */

const SUGGESTIONS = [
  "What changed today?",
  "Why is this High?",
  "What should we do?",
] as const;

/** Скелетон показываем, только если ответ идёт дольше секунды. */
const SKELETON_DELAY_MS = 1000;

type ChatMessage = Doc<"chatMessages">;

const bubbleBase =
  "rounded-[var(--radius-md)] border bg-[var(--color-surface)] p-[var(--space-3)]";

const outlineButton = cn(
  "inline-flex items-center gap-[var(--space-2)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-transparent px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] font-[number:var(--weight-medium)] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]",
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

/** Блоки ответа рисует тот же реестр, что и холст: разметки от модели нет. */
function MessageBlocks({ blocks }: { blocks: UiBlock[] }) {
  return (
    <BlockList
      blocks={blocks}
      className="mt-[var(--space-3)] space-y-[var(--space-2)]"
    />
  );
}

function RoleLabel({ role }: { role: "user" | "assistant" }) {
  const isAssistant = role === "assistant";
  return (
    <div className="flex items-center gap-[var(--space-2)]">
      {isAssistant ? (
        <span className="h-2 w-2 rounded-full bg-[var(--palette-info)]" aria-hidden />
      ) : null}
      <span className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
        {isAssistant ? "Grok" : "You"}
      </span>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <article className={cn(bubbleBase, "border-[var(--color-border)]")}>
      <RoleLabel role="user" />
      <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
        {text}
      </p>
    </article>
  );
}

/** Ответ модели — зона AI analysis: dashed-кромка, sans body, info-LED. */
function AssistantBubble({ message }: { message: ChatMessage }) {
  return (
    <article className={cn(bubbleBase, "border-dashed border-[var(--color-border)]")}>
      <RoleLabel role="assistant" />
      {message.text ? (
        <p className="mt-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
          {message.text}
        </p>
      ) : null}
      <MessageBlocks blocks={message.blocks} />
    </article>
  );
}

function PendingBubble() {
  return (
    <article
      className={cn(bubbleBase, "border-dashed border-[var(--color-border)]")}
      aria-busy="true"
      aria-label="Grok is answering"
    >
      <RoleLabel role="assistant" />
      <div className="mt-[var(--space-2)] space-y-[var(--space-2)]" aria-hidden>
        <div className="h-3 w-4/5 animate-pulse rounded bg-[var(--palette-border)]" />
        <div className="h-3 w-full animate-pulse rounded bg-[var(--palette-border)]" />
        <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--palette-border)]" />
      </div>
    </article>
  );
}

function ChatError({
  message,
  onRetry,
  disabled,
}: {
  message: string;
  onRetry: () => void;
  disabled: boolean;
}) {
  return (
    <div
      role="alert"
      className="rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-3)]"
    >
      <p className="font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)]">
        Grok did not answer
      </p>
      <p className="mt-[var(--space-1)] text-[13px] text-[var(--color-text-muted)]">
        {message}
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={disabled}
        className={cn(outlineButton, "mt-[var(--space-3)]")}
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden />
        Retry
      </button>
    </div>
  );
}

export function ChatPanel({ signalId }: { signalId?: Id<"signals"> | null }) {
  const demo = useQuery(api.workspace.demo);
  const workspaceId = demo?.workspace._id;

  const messages = useQuery(
    api.chat.list,
    workspaceId !== undefined ? { workspaceId } : "skip",
  );
  const ask = useAction(api.chat.ask);

  const [draft, setDraft] = useState("");
  const [pendingText, setPendingText] = useState<string | null>(null);
  const [slowAnswer, setSlowAnswer] = useState(false);
  const [failure, setFailure] = useState<{ text: string; message: string } | null>(
    null,
  );

  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  // Лента: system-сообщения — UI-события для модели, человеку их не показываем.
  const visibleMessages = useMemo(
    () => (messages ?? []).filter((message) => message.role !== "system"),
    [messages],
  );

  const lastUserText = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message.role === "user") {
        return message.text;
      }
    }
    return null;
  }, [visibleMessages]);

  // Эхо вопроса до ответа сервера; гасим, как только вопрос приехал в ленту.
  const showOptimisticQuestion =
    pendingText !== null && lastUserText !== pendingText;
  const hasServerPending = visibleMessages.some(
    (message) => message.role === "assistant" && message.status === "pending",
  );
  const showLocalSkeleton = pendingText !== null && slowAnswer;

  useEffect(() => {
    if (pendingText === null) {
      setSlowAnswer(false);
      return;
    }
    const timer = window.setTimeout(() => setSlowAnswer(true), SKELETON_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [pendingText]);

  useEffect(() => {
    const log = logRef.current;
    if (log) {
      log.scrollTop = log.scrollHeight;
    }
  }, [visibleMessages.length, showLocalSkeleton, showOptimisticQuestion]);

  const isBusy = pendingText !== null;
  const isReady = workspaceId !== undefined;

  const submit = useCallback(
    (rawText: string) => {
      const text = rawText.trim();
      if (text.length === 0 || workspaceId === undefined || isBusy) {
        return;
      }

      setPendingText(text);
      setFailure(null);
      setDraft("");

      void ask({
        workspaceId,
        text,
        ...(signalId ? { signalId } : {}),
      })
        .catch((error: unknown) => {
          const message =
            error instanceof Error ? error.message : "Chat request failed";
          setFailure({ text, message });
        })
        .finally(() => {
          setPendingText(null);
          // Фокус не теряется: следующий вопрос можно печатать сразу.
          inputRef.current?.focus();
        });
    },
    [ask, isBusy, signalId, workspaceId],
  );

  const isEmptyThread =
    visibleMessages.length === 0 &&
    !showOptimisticQuestion &&
    !showLocalSkeleton &&
    !hasServerPending;

  const composerHint = !isReady
    ? "Connecting to workspace…"
    : isBusy
      ? "Grok is answering…"
      : "Model inference — verify against evidence";

  return (
    <section
      className="flex shrink-0 flex-col gap-[var(--space-3)] border-t border-[var(--color-border)] bg-[var(--color-bg)] p-[var(--space-4)]"
      aria-label="Chat with Grok"
    >
      <header className="flex items-center gap-[var(--space-2)]">
        <MessageSquare className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden />
        <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]">
          Ask Grok
        </h3>
      </header>

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label="Conversation"
        className="max-h-[min(280px,35vh)] min-h-0 space-y-[var(--space-2)] overflow-y-auto"
      >
        {isEmptyThread ? (
          <p className="font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text-muted)]">
            Ask about the signal on screen — pick a prompt below or type your own.
          </p>
        ) : null}

        {visibleMessages.map((message) =>
          message.role === "user" ? (
            <UserBubble key={message._id} text={message.text} />
          ) : message.status === "pending" ? (
            <PendingBubble key={message._id} />
          ) : (
            <AssistantBubble key={message._id} message={message} />
          ),
        )}

        {showOptimisticQuestion && pendingText !== null ? (
          <UserBubble text={pendingText} />
        ) : null}

        {showLocalSkeleton ? <PendingBubble /> : null}
      </div>

      {failure ? (
        <ChatError
          message={failure.message}
          onRetry={() => submit(failure.text)}
          disabled={isBusy || !isReady}
        />
      ) : null}

      <div
        role="group"
        aria-label="Suggested questions"
        className="flex flex-wrap gap-[var(--space-2)]"
      >
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            type="button"
            onClick={() => submit(suggestion)}
            disabled={isBusy || !isReady}
            className={cn(
              "rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-[var(--space-2)] py-[var(--space-1)] font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text)] hover:bg-[var(--palette-recessed)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
              "disabled:cursor-not-allowed disabled:opacity-50",
            )}
          >
            {suggestion}
          </button>
        ))}
      </div>

      <form
        className="flex flex-col gap-[var(--space-2)]"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <label
          htmlFor="chat-panel-input"
          className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-wide text-[var(--color-text-muted)]"
        >
          Your question
        </label>
        <div className="flex items-center gap-[var(--space-2)]">
          <input
            id="chat-panel-input"
            ref={inputRef}
            type="text"
            value={draft}
            autoComplete="off"
            disabled={!isReady}
            placeholder="Why is this High?"
            onChange={(event) => setDraft(event.target.value)}
            className={cn(
              "min-w-0 flex-1 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--palette-recessed)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[14px] text-[var(--color-text)] placeholder:text-[var(--color-text-muted)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--palette-info)]",
              "disabled:cursor-not-allowed disabled:opacity-60",
            )}
          />
          <button
            type="submit"
            disabled={isBusy || !isReady || draft.trim().length === 0}
            aria-busy={isBusy}
            className={cn(outlineButton, "shrink-0")}
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            Send
          </button>
        </div>
        <p className="text-[11px] text-[var(--color-text-muted)]">{composerHint}</p>
      </form>
    </section>
  );
}
