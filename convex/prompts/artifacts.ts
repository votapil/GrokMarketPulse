/**
 * T-21 — generation rules for the three artifact types.
 *
 * Everything the model is told and everything we refuse to accept back lives
 * here: one prompt per artifact type, one strict JSON schema per type, and one
 * total validator per type. `act.ts` loads data and talks to Grok; it must not
 * carry prompt text or acceptance rules.
 *
 * The validators are deliberately total. Every renderer in
 * `src/components/artifacts/**` maps over payload arrays without null guards,
 * so a single missing field is a blank screen rather than a degraded card.
 */

import type { Doc } from "../_generated/dataModel";
import { REASONING_SYSTEM_PROMPT } from "./reasoning";

export type ArtifactType = "battlecard" | "offer" | "landing";

export type BattlecardPayload = {
  type: "battlecard";
  competitorChange: string;
  threat: string;
  competitorStrengths: string[];
  competitorWeaknesses: string[];
  ourStrengths: string[];
  positioning: string;
  objections: Array<{ objection: string; response: string }>;
  talkingPoints: string[];
};

export type OfferPayload = {
  type: "offer";
  headline: string;
  proposition: string;
  value: string;
  conditions: string[];
  differentiators: string[];
  cta: string;
};

export type LandingPayload = {
  type: "landing";
  headline: string;
  subheadline: string;
  offer: string;
  benefits: Array<{ title: string; body: string }>;
  differentiation: string;
  comparison: Array<{ feature: string; us: string; them: string }>;
  socialProofPlaceholders: string[];
  cta: string;
  sections: Array<{ title: string; body: string }>;
};

export type ArtifactPayload =
  | BattlecardPayload
  | OfferPayload
  | LandingPayload;

export type ArtifactContext = {
  company: Doc<"companies"> | null;
  competitor: Doc<"competitors">;
  signal: Doc<"signals">;
  evidence: Doc<"evidence">[];
  recommendation: Doc<"signals">["recommendations"][number];
};

export const ARTIFACTS_SYSTEM_PROMPT = `${REASONING_SYSTEM_PROMPT}

You write sales and marketing artifacts that a revenue team uses the same day.
Return ONLY JSON matching the schema — no prose, no markdown, no HTML.

Rules that apply to every artifact type:
- Argue against THIS competitor's specific change. Naming their new price, plan
  or packaging is mandatory, not decorative.
- Anchor every claim in the supplied company context, signal and evidence.
  Do not invent customers, logos, metrics or case studies.
- Every sentence must survive the question "could this be said about any
  company in any market?". If yes, rewrite it.
- BANNED phrases — their presence makes the response invalid: "growth",
  "synergy", "innovative solution", "cutting-edge", "best-in-class",
  "seamless experience", "leverage", "empower", "next-generation",
  "улучшить маркетинг", "инновационное решение".
- Write in the language of the supplied company context.`;

/** Rejected outright — the model is told these are banned, we enforce it. */
const BANNED_FLUFF =
  /\b(growth|synergy|innovative solution|cutting-edge|best-in-class|seamless experience|leverage|empower|next-generation)\b|улучшить маркетинг|инновационное решение/i;

/** A number, a price or a percentage — proof the text argues with specifics. */
const CONCRETE_ANCHOR = /\$|€|£|\d|%/;

const nonEmpty = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const nonEmptyList = (value: unknown, min: number): value is string[] =>
  Array.isArray(value) && value.length >= min && value.every(nonEmpty);

function pairList<K extends string>(
  value: unknown,
  min: number,
  keys: readonly [K, K],
): boolean {
  if (!Array.isArray(value) || value.length < min) return false;
  return value.every((row) => {
    if (!row || typeof row !== "object") return false;
    const o = row as Record<string, unknown>;
    return keys.every((key) => nonEmpty(o[key]));
  });
}

// ---------------------------------------------------------------------------
// JSON schemas. `type` is never asked of the model — act.ts stamps it — so the
// discriminant cannot come back wrong.
// ---------------------------------------------------------------------------

const stringArray = { type: "array", items: { type: "string" } } as const;

function objectSchema(
  required: readonly string[],
  properties: Record<string, unknown>,
) {
  return {
    type: "object",
    additionalProperties: false,
    required: [...required],
    properties,
  } as const;
}

export const BATTLECARD_JSON_SCHEMA = objectSchema(
  [
    "competitorChange",
    "threat",
    "competitorStrengths",
    "competitorWeaknesses",
    "ourStrengths",
    "positioning",
    "objections",
    "talkingPoints",
  ],
  {
    competitorChange: { type: "string" },
    threat: { type: "string" },
    competitorStrengths: stringArray,
    competitorWeaknesses: stringArray,
    ourStrengths: stringArray,
    positioning: { type: "string" },
    objections: {
      type: "array",
      items: objectSchema(["objection", "response"], {
        objection: { type: "string" },
        response: { type: "string" },
      }),
    },
    talkingPoints: stringArray,
  },
);

export const OFFER_JSON_SCHEMA = objectSchema(
  ["headline", "proposition", "value", "conditions", "differentiators", "cta"],
  {
    headline: { type: "string" },
    proposition: { type: "string" },
    value: { type: "string" },
    conditions: stringArray,
    differentiators: stringArray,
    cta: { type: "string" },
  },
);

export const LANDING_JSON_SCHEMA = objectSchema(
  [
    "headline",
    "subheadline",
    "offer",
    "benefits",
    "differentiation",
    "comparison",
    "socialProofPlaceholders",
    "cta",
    "sections",
  ],
  {
    headline: { type: "string" },
    subheadline: { type: "string" },
    offer: { type: "string" },
    benefits: {
      type: "array",
      items: objectSchema(["title", "body"], {
        title: { type: "string" },
        body: { type: "string" },
      }),
    },
    differentiation: { type: "string" },
    comparison: {
      type: "array",
      items: objectSchema(["feature", "us", "them"], {
        feature: { type: "string" },
        us: { type: "string" },
        them: { type: "string" },
      }),
    },
    socialProofPlaceholders: stringArray,
    cta: { type: "string" },
    sections: {
      type: "array",
      items: objectSchema(["title", "body"], {
        title: { type: "string" },
        body: { type: "string" },
      }),
    },
  },
);

// ---------------------------------------------------------------------------
// Per-type instructions
// ---------------------------------------------------------------------------

const BATTLECARD_INSTRUCTIONS = `${ARTIFACTS_SYSTEM_PROMPT}

Write a SALES BATTLECARD a rep opens mid-call.
- competitorChange: one sentence naming what the competitor changed, with the number.
- threat: why it costs us deals, in revenue terms.
- competitorStrengths / competitorWeaknesses / ourStrengths: 3 items each, concrete and checkable.
- positioning: the one line the rep says when the competitor's price comes up.
- objections: 3 real buyer objections created by THIS change, each with a response the rep can read aloud.
- talkingPoints: 4 short lines, each carrying a fact or a number.`;

const OFFER_INSTRUCTIONS = `${ARTIFACTS_SYSTEM_PROMPT}

Write a TIME-BOXED COMPETITIVE OFFER.
- headline: the offer in under ten words, with the figure in it.
- proposition: what the customer gets, mechanically.
- value: what it is worth to them, in money or time saved.
- conditions: 3 items — eligibility, the window in days, and the cap (seats, accounts or spend). No open-ended discounts.
- differentiators: 3 reasons this beats simply taking the competitor's cheaper plan.
- cta: the exact button text.`;

const LANDING_INSTRUCTIONS = `${ARTIFACTS_SYSTEM_PROMPT}

Write a COMPETITIVE COUNTER-LANDING PAGE that argues against the competitor's new price.
- headline / subheadline: address a buyer who has just seen the competitor's new pricing.
- offer: the concrete commercial answer, with the figure.
- benefits: 3 items, each title plus a body that names a capability, not a feeling.
- differentiation: why cheaper is not the same as better here, argued against their actual plan.
- comparison: 4 rows. "feature" is the dimension, "us" is our position, "them" is the competitor's — each cell short enough for a table cell, and at least one row must carry the price on both sides.
- socialProofPlaceholders: 2 honest placeholders describing the proof to insert later (e.g. "Quote from a customer who migrated in Q3") — never a fabricated quote or logo.
- sections: 2 supporting sections, title plus body.
- cta: the exact button text.

The page is invalid if a reader cannot tell which competitor it answers and at what price.`;

// ---------------------------------------------------------------------------
// Validators — total by design
// ---------------------------------------------------------------------------

function hasBannedFluff(value: unknown): boolean {
  return BANNED_FLUFF.test(JSON.stringify(value));
}

function isBattlecard(value: unknown): value is Omit<BattlecardPayload, "type"> {
  if (!value || typeof value !== "object" || hasBannedFluff(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    nonEmpty(o.competitorChange) &&
    CONCRETE_ANCHOR.test(o.competitorChange) &&
    nonEmpty(o.threat) &&
    nonEmpty(o.positioning) &&
    nonEmptyList(o.competitorStrengths, 2) &&
    nonEmptyList(o.competitorWeaknesses, 2) &&
    nonEmptyList(o.ourStrengths, 2) &&
    nonEmptyList(o.talkingPoints, 3) &&
    pairList(o.objections, 2, ["objection", "response"])
  );
}

function isOffer(value: unknown): value is Omit<OfferPayload, "type"> {
  if (!value || typeof value !== "object" || hasBannedFluff(value)) return false;
  const o = value as Record<string, unknown>;
  return (
    nonEmpty(o.headline) &&
    nonEmpty(o.proposition) &&
    nonEmpty(o.value) &&
    nonEmpty(o.cta) &&
    nonEmptyList(o.conditions, 2) &&
    nonEmptyList(o.differentiators, 2) &&
    CONCRETE_ANCHOR.test(`${o.headline} ${o.value} ${o.conditions.join(" ")}`)
  );
}

function isLanding(value: unknown): value is Omit<LandingPayload, "type"> {
  if (!value || typeof value !== "object" || hasBannedFluff(value)) return false;
  const o = value as Record<string, unknown>;
  const shapeOk =
    nonEmpty(o.headline) &&
    nonEmpty(o.subheadline) &&
    nonEmpty(o.offer) &&
    nonEmpty(o.differentiation) &&
    nonEmpty(o.cta) &&
    nonEmptyList(o.socialProofPlaceholders, 2) &&
    pairList(o.benefits, 3, ["title", "body"]) &&
    pairList(o.sections, 2, ["title", "body"]);
  if (!shapeOk) return false;

  const comparison = o.comparison;
  if (!Array.isArray(comparison) || comparison.length < 3) return false;
  const rowsOk = comparison.every((row) => {
    if (!row || typeof row !== "object") return false;
    const r = row as Record<string, unknown>;
    return nonEmpty(r.feature) && nonEmpty(r.us) && nonEmpty(r.them);
  });
  if (!rowsOk) return false;

  // The whole point of this artifact: it must argue with a real number.
  return CONCRETE_ANCHOR.test(
    `${o.subheadline} ${o.offer} ${o.differentiation} ${JSON.stringify(comparison)}`,
  );
}

type Rules = {
  instructions: string;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  validate: (value: unknown) => boolean;
};

const RULES: Record<ArtifactType, Rules> = {
  battlecard: {
    instructions: BATTLECARD_INSTRUCTIONS,
    schema: BATTLECARD_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "battlecard",
    maxOutputTokens: 2200,
    validate: isBattlecard,
  },
  offer: {
    instructions: OFFER_INSTRUCTIONS,
    schema: OFFER_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "offer",
    maxOutputTokens: 1600,
    validate: isOffer,
  },
  landing: {
    instructions: LANDING_INSTRUCTIONS,
    schema: LANDING_JSON_SCHEMA as unknown as Record<string, unknown>,
    schemaName: "landing",
    maxOutputTokens: 3000,
    validate: isLanding,
  },
};

export function rulesFor(type: ArtifactType): Rules {
  return RULES[type];
}

/**
 * Stamps the discriminant the model was never asked for. Callers pass a value
 * already accepted by `rulesFor(type).validate`.
 */
export function toPayload(type: ArtifactType, value: unknown): ArtifactPayload {
  return { ...(value as object), type } as ArtifactPayload;
}

/** §40 context: company, competitor, signal, evidence, chosen recommendation. */
export function buildArtifactInput(context: ArtifactContext): string {
  const { company, competitor, signal, evidence, recommendation } = context;

  const evidenceLines = evidence.map(
    (row) =>
      `- [${row.kind}] ${row.title} (${row.provider}, confidence ${row.confidence}): ${row.fragment.slice(0, 400)}`,
  );

  return [
    "Our company context (JSON):",
    JSON.stringify(company?.context ?? null, null, 2),
    "",
    `Competitor: ${competitor.name} (${competitor.url}) — ${competitor.kind}`,
    `Competitor summary: ${competitor.summary}`,
    "",
    `Signal: ${signal.title}`,
    `Type: ${signal.type}; kind: ${signal.kind}; severity: ${signal.severity}; score: ${signal.score}`,
    `Summary: ${signal.summary}`,
    `Competitor previous state: ${signal.previousState}`,
    `Competitor current state: ${signal.currentState}`,
    "",
    "Assessment (JSON):",
    JSON.stringify(signal.assessment, null, 2),
    "",
    "Chosen recommendation — the artifact must execute exactly this:",
    `- title: ${recommendation.title}`,
    `- action: ${recommendation.action}`,
    `- rationale: ${recommendation.rationale}`,
    `- expected impact: ${recommendation.expectedImpact}`,
    `- effort: ${recommendation.effort}; risk: ${recommendation.risk}`,
    "",
    "Evidence:",
    evidenceLines.length > 0 ? evidenceLines.join("\n") : "(none)",
  ].join("\n");
}
