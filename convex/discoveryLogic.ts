/**
 * Pure discovery helpers (T-35). No Convex imports — unit-tested from tests/.
 * T-40 reads sameProduct + region + distanceKm; schema cannot grow without S-1,
 * so those fields live in competitors.summary as JSON and kind = direct|adjacent.
 */

export const DISCOVERY_EXA_BUDGET_USD = 2;

export const DISCOVERY_MIN = 3;
export const DISCOVERY_MAX = 5;
export const DISCOVERY_HIT_POOL = 8;

export type DiscoveryHit = {
  url: string;
  title: string;
  fragment: string;
};

export type SuggestionMeta = {
  rationale: string;
  sameProduct: boolean;
  region: string | null;
  distanceKm: number | null;
};

export type RankedCandidate = SuggestionMeta & {
  url: string;
  name: string;
};

/** Match upserted rows to ranked URLs by host — never by array index. */
export function competitorIdForUrl<Id extends string>(
  stored: Array<{ url: string; competitorId: Id }>,
  url: string,
): Id | undefined {
  const host = hostKey(url);
  if (host.length === 0) return undefined;
  return stored.find((row) => hostKey(row.url) === host)?.competitorId;
}

export function hostKey(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return "";
  try {
    const parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return trimmed.toLowerCase().replace(/^www\./, "").split("/")[0] ?? "";
  }
}

export function blockedHosts(companyUrl: string, competitorUrls: string[]): Set<string> {
  const blocked = new Set<string>();
  const own = hostKey(companyUrl);
  if (own.length > 0) blocked.add(own);
  for (const url of competitorUrls) {
    const host = hostKey(url);
    if (host.length > 0) blocked.add(host);
  }
  return blocked;
}

export function pickUniqueHits(
  hits: DiscoveryHit[],
  blocked: Set<string>,
  limit = DISCOVERY_HIT_POOL,
): DiscoveryHit[] {
  const seen = new Set<string>();
  const picked: DiscoveryHit[] = [];
  for (const hit of hits) {
    const host = hostKey(hit.url);
    if (host.length === 0 || blocked.has(host) || seen.has(host)) continue;
    seen.add(host);
    picked.push(hit);
    if (picked.length >= limit) break;
  }
  return picked;
}

export function isOverExaBudget(
  spentUsd: number,
  capUsd = DISCOVERY_EXA_BUDGET_USD,
): boolean {
  return Number.isFinite(spentUsd) && spentUsd >= capUsd;
}

export function kindFromSameProduct(sameProduct: boolean): "direct" | "adjacent" {
  return sameProduct ? "direct" : "adjacent";
}

export function encodeSuggestionMeta(meta: SuggestionMeta): string {
  return JSON.stringify({
    rationale: meta.rationale,
    sameProduct: meta.sameProduct,
    region: meta.region,
    distanceKm: meta.distanceKm,
  });
}

export function decodeSuggestionMeta(
  summary: string,
  kind: string,
): SuggestionMeta {
  try {
    const parsed: unknown = JSON.parse(summary);
    if (parsed && typeof parsed === "object") {
      const row = parsed as Record<string, unknown>;
      if (typeof row.rationale === "string" && typeof row.sameProduct === "boolean") {
        return {
          rationale: row.rationale,
          sameProduct: row.sameProduct,
          region: typeof row.region === "string" ? row.region : null,
          distanceKm:
            typeof row.distanceKm === "number" && Number.isFinite(row.distanceKm)
              ? row.distanceKm
              : null,
        };
      }
    }
  } catch {
    // plain-text summaries from seed / setup
  }
  return {
    rationale: summary,
    sameProduct: kind === "direct",
    region: null,
    distanceKm: null,
  };
}

export function buildDiscoveryQuery(input: {
  name: string;
  category: string;
  products: string[];
  positioning: string;
}): string {
  const products = input.products.slice(0, 3).join(", ");
  return [
    `Companies that compete with ${input.name} in ${input.category}`,
    products.length > 0 ? `selling ${products}` : "",
    input.positioning.length > 0 ? `similar to: ${input.positioning}` : "",
    "official company websites",
  ]
    .filter((part) => part.length > 0)
    .join(". ");
}

function nameFromHit(hit: DiscoveryHit): string {
  const title = hit.title.trim();
  if (title.length > 0 && !/^https?:/i.test(title)) {
    return title.split(/[|–—-]/)[0]?.trim() || title;
  }
  const host = hostKey(hit.url);
  const label = host.split(".")[0] ?? host;
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function rankWithoutGrok(
  hits: DiscoveryHit[],
  blocked: Set<string>,
): RankedCandidate[] {
  return pickUniqueHits(hits, blocked, DISCOVERY_MAX).map((hit) => ({
    url: hit.url,
    name: nameFromHit(hit),
    rationale:
      hit.fragment.trim().length > 0
        ? hit.fragment.trim().slice(0, 220)
        : `Exa company result for ${nameFromHit(hit)}`,
    sameProduct: true,
    region: "unknown",
    distanceKm: 50,
  }));
}

type RawCandidate = {
  url?: unknown;
  name?: unknown;
  rationale?: unknown;
  sameProduct?: unknown;
  region?: unknown;
  distanceKm?: unknown;
};

export function parseGrokCandidates(
  value: unknown,
  knownHosts: Set<string>,
): RankedCandidate[] {
  if (!value || typeof value !== "object") return [];
  const list = (value as { candidates?: unknown }).candidates;
  if (!Array.isArray(list)) return [];

  const seen = new Set<string>();
  const ranked: RankedCandidate[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const row = item as RawCandidate;
    if (typeof row.url !== "string" || typeof row.name !== "string") continue;
    if (typeof row.rationale !== "string" || typeof row.sameProduct !== "boolean") {
      continue;
    }
    const host = hostKey(row.url);
    if (host.length === 0 || !knownHosts.has(host) || seen.has(host)) continue;
    seen.add(host);

    const region =
      typeof row.region === "string" && row.region.trim().length > 0
        ? row.region.trim()
        : "unknown";
    const distanceKm =
      typeof row.distanceKm === "number" && Number.isFinite(row.distanceKm)
        ? Math.max(0, Math.round(row.distanceKm))
        : null;

    ranked.push({
      url: row.url.trim(),
      name: row.name.trim().slice(0, 80),
      rationale: row.rationale.trim().slice(0, 280),
      sameProduct: row.sameProduct,
      region,
      distanceKm,
    });
    if (ranked.length >= DISCOVERY_MAX) break;
  }

  return ranked;
}

export function isGrokCandidatePayload(
  value: unknown,
): value is { candidates: RawCandidate[] } {
  if (!value || typeof value !== "object") return false;
  const list = (value as { candidates?: unknown }).candidates;
  return Array.isArray(list);
}

export const DISCOVERY_GROK_INSTRUCTIONS = `You rank company-website search hits as competitors of OUR company.
Return ONLY JSON matching the schema.

Rules:
- Pick 3 to 5 candidates. Prefer official company homepages, not news or directories.
- sameProduct=true only when they sell the same kind of product (not a distant adjacent tool).
- region: ISO-like country or city/region where they appear based in. Use "unknown" if you cannot tell.
- distanceKm: rough distance from OUR company (from positioning / URL). Integer. Use 50 if unknown.
- rationale: one short sentence a sales lead can read. Cite the overlap, not the search engine.
- url MUST be copied from the provided hit list — never invent a domain.`;

export const DISCOVERY_GROK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["url", "name", "rationale", "sameProduct", "region", "distanceKm"],
        properties: {
          url: { type: "string" },
          name: { type: "string" },
          rationale: { type: "string" },
          sameProduct: { type: "boolean" },
          region: { type: "string" },
          distanceKm: { type: "number" },
        },
      },
    },
  },
} as const;
