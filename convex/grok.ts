/**
 * Shared xAI Responses client for Convex actions.
 * Never log the API key. Never dump raw scrapes past the truncate limit.
 */

import { env } from "./_generated/server";

const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

/** Default text model (1M context, cheaper than 4.6). */
export const GROK_DEFAULT_MODEL = "grok-4.3";

/** Artifact / heavier reasoning model. */
export const GROK_ARTIFACT_MODEL = "grok-4.6";

/** Stay well under long_context_threshold (200k tokens); ~4 chars/token. */
export const MAX_MARKDOWN_CHARS = 40_000;

export type GrokJsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type CallGrokArgs = {
  model?: string;
  input: string | Array<Record<string, unknown>>;
  instructions?: string;
  schema?: GrokJsonSchema;
  maxOutputTokens?: number;
  /** Explicit reasoning effort for reasoning models; omit for non-reasoning. */
  reasoningEffort?: "low" | "medium" | "high";
};

export type CallGrokResult = {
  text: string;
  costUsdTicks: number;
  raw: unknown;
};

export function truncateMarkdown(markdown: string, maxChars = MAX_MARKDOWN_CHARS): string {
  if (markdown.length <= maxChars) {
    return markdown;
  }
  return `${markdown.slice(0, maxChars)}\n\n[truncated]`;
}

export function extractMessageText(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const output = (payload as { output?: unknown }).output;
  if (!Array.isArray(output)) {
    return "";
  }
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const row = item as { type?: string; content?: unknown };
    if (row.type !== "message" || !Array.isArray(row.content)) continue;
    for (const part of row.content) {
      if (!part || typeof part !== "object") continue;
      const block = part as { type?: string; text?: string };
      if (typeof block.text === "string" && block.text.length > 0) {
        return block.text;
      }
    }
  }
  return "";
}

export function ticksToUsd(costInUsdTicks: number): number {
  return costInUsdTicks / 10_000_000_000;
}

function readCostTicks(payload: unknown): number {
  if (!payload || typeof payload !== "object") return 0;
  const usage = (payload as { usage?: { cost_in_usd_ticks?: unknown } }).usage;
  const ticks = usage?.cost_in_usd_ticks;
  return typeof ticks === "number" && Number.isFinite(ticks) ? ticks : 0;
}

/**
 * POST /v1/responses — not chat/completions.
 * Text from output[] where type === "message" → content[0].text.
 */
export async function callGrok(args: CallGrokArgs): Promise<CallGrokResult> {
  const apiKey = (env as Record<string, string | undefined>).XAI_API_KEY;
  if (!apiKey) {
    throw new Error("XAI_API_KEY is not set on the Convex deployment");
  }

  const model = args.model ?? GROK_DEFAULT_MODEL;
  const body: Record<string, unknown> = {
    model,
    input: args.input,
    max_output_tokens: args.maxOutputTokens ?? 2048,
  };

  if (args.instructions) {
    body.instructions = args.instructions;
  }

  if (args.reasoningEffort) {
    body.reasoning = { effort: args.reasoningEffort };
  }

  if (args.schema) {
    body.text = {
      format: {
        type: "json_schema",
        name: args.schema.name,
        schema: args.schema.schema,
        strict: args.schema.strict ?? true,
      },
    };
  }

  const response = await fetch(XAI_RESPONSES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  const rawText = await response.text();
  let raw: unknown;
  try {
    raw = JSON.parse(rawText) as unknown;
  } catch {
    throw new Error(`xAI returned non-JSON (${response.status})`);
  }

  if (!response.ok) {
    const errMsg =
      raw && typeof raw === "object" && "error" in raw
        ? JSON.stringify((raw as { error: unknown }).error)
        : `HTTP ${response.status}`;
    throw new Error(`xAI responses error: ${errMsg}`);
  }

  const text = extractMessageText(raw);
  return {
    text,
    costUsdTicks: readCostTicks(raw),
    raw,
  };
}

export function parseJsonWithRetry<T>(
  text: string,
  validate: (value: unknown) => value is T,
): { ok: true; value: T } | { ok: false; error: string } {
  try {
    const parsed: unknown = JSON.parse(text);
    if (validate(parsed)) {
      return { ok: true, value: parsed };
    }
    return { ok: false, error: "JSON failed schema validation" };
  } catch {
    return { ok: false, error: "Response was not valid JSON" };
  }
}
