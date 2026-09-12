/**
 * Exa client + evidence scoring for external verification (T-23).
 *
 * One `POST /search` per verification. Highlights come back inline — the content
 * of the first 10 results is included in the search price, so `/contents` is
 * never called. Pure functions plus the HTTP helper; Convex functions live in
 * `verify.ts`.
 */

import { env } from "./_generated/server";
import { REASONING_SYSTEM_PROMPT } from "./prompts/reasoning";

export const EXA_SEARCH_URL = "https://api.exa.ai/search";

/** Let Exa pick the retrieval strategy; `neural`/`keyword` no longer exist. */
export const EXA_SEARCH_TYPE = "auto";

export const EXA_NUM_RESULTS = 8;

/** Flat price of one `/search` with inline contents (docs/STACK.md §3). */
export const EXA_SEARCH_COST_USD = 0.007;

const EXA_TIMEOUT_MS = 30_000;

/** `evidence.fragment` is rendered inline by SourceList — keep it short. */
const MAX_FRAGMENT_CHARS = 600;
const MAX_TITLE_CHARS = 200;

const MIN_QUERY_CHARS = 20;
const MAX_QUERY_CHARS = 300;
const MIN_QUERY_WORDS = 5;
const MAX_QUERY_WORDS = 40;

/** Boolean/site operators degrade Exa's neural ranking — reject them outright. */
const QUERY_OPERATORS = /\bsite:\s*\S|\bAND\b|\bOR\b|\bNOT\b|[()]/;

const TRACKING_PARAM = /^(utm_|ref$|ref_|fbclid$|gclid$|mc_cid$|mc_eid$|igshid$)/i;

export type ExaHit = {
  url: string;
  title: string;
  fragment: string;
  publishedDate: string | null;
};

export type ExaSearchOutcome =
  | { ok: true; hits: ExaHit[]; costUsd: number }
  | { ok: false; hits: ExaHit[]; costUsd: number; detail: string };

export type ExaQueryPayload = { query: string; reasoning: string };

/** Input the query prompt is built from — the signal plus who it is about. */
export type QuerySubject = {
  competitorName: string;
  competitorUrl: string;
  signal: {
    type: string;
    title: string;
    summary: string;
    previousState: string;
    currentState: string;
  };
};

export function readExaApiKey(): string {
  const key = (env as Record<string, string | undefined>).EXA_API_KEY;
  if (!key) {
    throw new Error(
      "EXA_API_KEY is not set on the Convex deployment — run `npx convex env set EXA_API_KEY`",
    );
  }
  return key;
}

/**
 * Dedupe key for an evidence URL: protocol, `www.`, trailing slash, fragment and
 * tracking params dropped, remaining params sorted. Unparseable input falls back
 * to the lowercased raw string so a malformed URL still dedupes against itself.
 */
export function normalizeEvidenceUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return trimmed.toLowerCase();
  }

  const params = [...parsed.searchParams.entries()]
    .filter(([key]) => !TRACKING_PARAM.test(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`);

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const path = parsed.pathname.replace(/\/+$/, "");
  const search = params.length > 0 ? `?${params.join("&")}` : "";
  return `${host}${path}${search}`;
}

export const EXA_QUERY_INSTRUCTIONS = `${REASONING_SYSTEM_PROMPT}

Write ONE web search query that would surface INDEPENDENT, third-party confirmation
of a competitor change we detected on the competitor's own page.
Return ONLY JSON matching the schema.

Rules:
- Exa is a neural search engine: describe the ideal page in natural language, not keywords.
- Name the competitor explicitly and state the substance of the change (what moved, from what to what).
- Prefer sources that are NOT the competitor's own marketing page: news coverage, changelog write-ups, forum threads, review sites, analyst posts.
- ${MIN_QUERY_WORDS}-${MAX_QUERY_WORDS} words, ${MIN_QUERY_CHARS}-${MAX_QUERY_CHARS} characters.
- No boolean operators (AND/OR/NOT), no parentheses, no \`site:\` filters.
- reasoning: one sentence naming the kind of page you expect to rank first.`;

export const EXA_QUERY_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["query", "reasoning"],
  properties: {
    query: { type: "string" },
    reasoning: { type: "string" },
  },
} as const;

export function buildQueryPromptInput(subject: QuerySubject): string {
  return [
    `Competitor: ${subject.competitorName} (${subject.competitorUrl})`,
    "",
    `Change type: ${subject.signal.type}`,
    `Title: ${subject.signal.title}`,
    `Summary: ${subject.signal.summary}`,
    `Previous state: ${subject.signal.previousState}`,
    `Current state: ${subject.signal.currentState}`,
  ].join("\n");
}

/**
 * Total validator for the query payload. Rejects: non-objects, missing or
 * non-string fields, an empty `reasoning`, a query outside the character or word
 * bounds, a query carrying boolean/`site:` operators, and a query that never
 * names the competitor.
 */
export function makeQueryValidator(
  competitorName: string,
): (value: unknown) => value is ExaQueryPayload {
  const needle = competitorName.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

  return (value: unknown): value is ExaQueryPayload => {
    if (!value || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    if (typeof row.query !== "string" || typeof row.reasoning !== "string") {
      return false;
    }
    if (row.reasoning.trim().length === 0) return false;

    const query = row.query.trim();
    if (query.length < MIN_QUERY_CHARS || query.length > MAX_QUERY_CHARS) {
      return false;
    }
    const words = query.split(/\s+/).filter((word) => word.length > 0);
    if (words.length < MIN_QUERY_WORDS || words.length > MAX_QUERY_WORDS) {
      return false;
    }
    if (QUERY_OPERATORS.test(query)) return false;
    if (needle.length > 0 && !query.toLowerCase().includes(needle)) return false;

    return true;
  };
}

type RawResult = {
  url?: unknown;
  title?: unknown;
  text?: unknown;
  highlights?: unknown;
  publishedDate?: unknown;
};

/** Prefer the highlight Exa picked; fall back to `text` when highlights are absent. */
function pickFragment(row: RawResult): string {
  if (Array.isArray(row.highlights)) {
    const best = row.highlights.find(
      (item) => typeof item === "string" && item.trim().length > 0,
    );
    if (typeof best === "string") return best.trim();
  }
  return typeof row.text === "string" ? row.text.trim() : "";
}

function toHit(row: unknown): ExaHit | null {
  if (!row || typeof row !== "object") return null;
  const raw = row as RawResult;
  if (typeof raw.url !== "string" || raw.url.trim().length === 0) return null;

  const url = raw.url.trim();
  const title =
    typeof raw.title === "string" && raw.title.trim().length > 0
      ? raw.title.trim()
      : url;

  return {
    url,
    title: title.slice(0, MAX_TITLE_CHARS),
    fragment: pickFragment(raw).slice(0, MAX_FRAGMENT_CHARS),
    publishedDate:
      typeof raw.publishedDate === "string" ? raw.publishedDate : null,
  };
}

function readCostUsd(payload: unknown): number {
  if (!payload || typeof payload !== "object") return EXA_SEARCH_COST_USD;
  const cost = (payload as { costDollars?: { total?: unknown } }).costDollars;
  const total = cost?.total;
  return typeof total === "number" && Number.isFinite(total)
    ? total
    : EXA_SEARCH_COST_USD;
}

function readErrorDetail(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const message = payload as { error?: unknown; message?: unknown };
    if (typeof message.error === "string") return `${message.error} (HTTP ${status})`;
    if (typeof message.message === "string") return `${message.message} (HTTP ${status})`;
  }
  return `Exa HTTP ${status}`;
}

/**
 * One paid search. Never throws on a remote failure — the caller decides whether
 * an Exa outage fails the run, and only a charged (2xx) call reports a cost.
 */
export async function exaSearch(query: string): Promise<ExaSearchOutcome> {
  const apiKey = readExaApiKey();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), EXA_TIMEOUT_MS);

  try {
    const response = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        type: EXA_SEARCH_TYPE,
        numResults: EXA_NUM_RESULTS,
        contents: { highlights: true },
      }),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      return {
        ok: false,
        hits: [],
        costUsd: 0,
        detail: `Exa returned non-JSON (HTTP ${response.status})`,
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        hits: [],
        costUsd: 0,
        detail: readErrorDetail(payload, response.status),
      };
    }

    const results = (payload as { results?: unknown }).results;
    const hits = Array.isArray(results)
      ? results.flatMap((row) => {
          const hit = toHit(row);
          return hit ? [hit] : [];
        })
      : [];

    return { ok: true, hits, costUsd: readCostUsd(payload) };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "AbortError" || /timeout/i.test(error.message));
    return {
      ok: false,
      hits: [],
      costUsd: 0,
      detail: timedOut ? "Exa search timed out" : "Exa search request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

/* -------------------------------------------------------------------------- */
/* Scoring: Exa hits → evidence rows → a new signal confidence                */
/* -------------------------------------------------------------------------- */

export type Stance = "confirming" | "conflicting" | "related";

export type EvidenceRow = {
  url: string;
  title: string;
  fragment: string;
  confidence: number;
  stance: Stance;
};

/** Honest empty state — the exact string T-24's SourceList renders. */
export const NO_CONFIRMATION = "no external confirmation found";

export const CONFIDENCE_MIN = 0;
export const CONFIDENCE_MAX = 1;

/** Per-evidence confidence by stance, decayed slightly down the result list. */
const STANCE_CONFIDENCE: Record<Stance, number> = {
  confirming: 0.8,
  conflicting: 0.4,
  related: 0.55,
};
const RANK_DECAY = 0.02;
const MIN_EVIDENCE_CONFIDENCE = 0.2;

/** Signal-confidence deltas, applied per source and then capped. */
const CONFIRM_BONUS_PER_SOURCE = 0.05;
const MAX_CONFIRM_BONUS = 0.2;
const CONFLICT_PENALTY_PER_SOURCE = 0.08;
const MAX_CONFLICT_PENALTY = 0.24;

/** Shortest word treated as a distinguishing token for non-numeric changes. */
const MIN_WORD_TOKEN = 4;
const NUMBER_TOKEN = /\$?\d[\d.,]*/g;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Numbers carry a price change; otherwise fall back to distinguishing words. */
function stateTokens(state: string): string[] {
  const numbers = [...state.matchAll(NUMBER_TOKEN)]
    .map((match) => match[0].replace(/[$,]/g, "").replace(/\.$/, ""))
    .filter((token) => token.length > 0);
  if (numbers.length > 0) return numbers;

  return state
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= MIN_WORD_TOKEN);
}

/** Whole-token match, so `16` does not confirm itself out of `2016`. */
function mentions(blob: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?![a-z0-9])`).test(blob);
}

function classifyHit(
  hit: ExaHit,
  currentTokens: string[],
  conflictTokens: string[],
): Stance {
  const blob = `${hit.title} ${hit.fragment}`.toLowerCase();
  if (currentTokens.some((token) => mentions(blob, token))) return "confirming";
  if (conflictTokens.some((token) => mentions(blob, token))) return "conflicting";
  return "related";
}

/**
 * A hit confirms when it repeats the state we now observe, conflicts when it
 * only repeats the state we replaced, and is merely related otherwise.
 * Conflicting sources carry the note in their title so SourceList shows it.
 */
export function toEvidenceRows(
  hits: ExaHit[],
  previousState: string,
  currentState: string,
): EvidenceRow[] {
  const currentTokens = stateTokens(currentState);
  const conflictTokens = stateTokens(previousState).filter(
    (token) => !currentTokens.includes(token),
  );

  return hits.map((hit, rank) => {
    const stance = classifyHit(hit, currentTokens, conflictTokens);
    return {
      url: hit.url,
      title: stance === "conflicting" ? `Conflicting — ${hit.title}` : hit.title,
      fragment: hit.fragment,
      confidence: round2(
        clamp(
          STANCE_CONFIDENCE[stance] - rank * RANK_DECAY,
          MIN_EVIDENCE_CONFIDENCE,
          CONFIDENCE_MAX,
        ),
      ),
      stance,
    };
  });
}

/** External confirmation raises confidence, contradiction lowers it. Clamped 0..1. */
export function recalcConfidence(
  base: number,
  confirming: number,
  conflicting: number,
): number {
  const bonus = Math.min(confirming * CONFIRM_BONUS_PER_SOURCE, MAX_CONFIRM_BONUS);
  const penalty = Math.min(
    conflicting * CONFLICT_PENALTY_PER_SOURCE,
    MAX_CONFLICT_PENALTY,
  );
  return round2(clamp(base + bonus - penalty, CONFIDENCE_MIN, CONFIDENCE_MAX));
}

export function verifyNote(
  found: number,
  created: number,
  conflicting: number,
): string {
  if (found === 0) return NO_CONFIRMATION;
  if (conflicting > 0) {
    const plural = conflicting === 1 ? "" : "s";
    return `${conflicting} source${plural} contradict the detected change — confidence lowered`;
  }
  if (created === 0) return "external confirmation already on file";
  return `${created} external source${created === 1 ? "" : "s"} confirm the change`;
}
