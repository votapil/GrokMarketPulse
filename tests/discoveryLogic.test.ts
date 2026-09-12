import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DISCOVERY_EXA_BUDGET_USD,
  blockedHosts,
  buildDiscoveryQuery,
  competitorIdForUrl,
  decodeSuggestionMeta,
  encodeSuggestionMeta,
  hostKey,
  isOverExaBudget,
  kindFromSameProduct,
  parseGrokCandidates,
  pickUniqueHits,
  rankWithoutGrok,
} from "../convex/discoveryLogic.ts";

test("hostKey strips www, path, query and fragment", () => {
  assert.equal(
    hostKey("https://www.Zendesk.com/pricing?utm_source=x#top"),
    "zendesk.com",
  );
});

test("competitorIdForUrl matches by host, not by list position", () => {
  const stored = [
    { url: "https://freshdesk.com/pricing", competitorId: "id-fresh" },
    { url: "https://www.zendesk.com", competitorId: "id-zen" },
  ];
  assert.equal(competitorIdForUrl(stored, "https://zendesk.com/help"), "id-zen");
  assert.equal(competitorIdForUrl(stored, "https://evil.example"), undefined);
});

test("blockedHosts includes our company and existing competitor hosts", () => {
  const blocked = blockedHosts("https://helpdesk.ai", [
    "https://www.acmeflow.example/pricing",
  ]);
  assert.equal(blocked.has("helpdesk.ai"), true);
  assert.equal(blocked.has("acmeflow.example"), true);
});

test("pickUniqueHits drops blocked hosts and duplicate domains", () => {
  const blocked = new Set(["helpdesk.ai"]);
  const picked = pickUniqueHits(
    [
      { url: "https://helpdesk.ai/blog", title: "Us", fragment: "" },
      { url: "https://www.zendesk.com", title: "Zendesk", fragment: "helpdesk" },
      { url: "https://zendesk.com/pricing", title: "Zendesk pricing", fragment: "" },
      { url: "https://freshdesk.com", title: "Freshdesk", fragment: "support" },
    ],
    blocked,
    8,
  );
  assert.deepEqual(
    picked.map((row) => row.url),
    ["https://www.zendesk.com", "https://freshdesk.com"],
  );
});

test("isOverExaBudget stops paid search at the T-31 stand-in cap", () => {
  assert.equal(isOverExaBudget(DISCOVERY_EXA_BUDGET_USD, DISCOVERY_EXA_BUDGET_USD), true);
  assert.equal(isOverExaBudget(DISCOVERY_EXA_BUDGET_USD - 0.001, DISCOVERY_EXA_BUDGET_USD), false);
});

test("encode/decode suggestion meta round-trips fields T-40 needs", () => {
  const encoded = encodeSuggestionMeta({
    rationale: "Same inbox + AI drafts for SMB.",
    sameProduct: true,
    region: "US",
    distanceKm: 80,
  });
  assert.deepEqual(decodeSuggestionMeta(encoded, "direct"), {
    rationale: "Same inbox + AI drafts for SMB.",
    sameProduct: true,
    region: "US",
    distanceKm: 80,
  });
});

test("decodeSuggestionMeta falls back when summary is plain text", () => {
  assert.deepEqual(decodeSuggestionMeta("Added from setup watchlist", "adjacent"), {
    rationale: "Added from setup watchlist",
    sameProduct: false,
    region: null,
    distanceKm: null,
  });
});

test("kindFromSameProduct maps the T-40 same-product filter onto kind", () => {
  assert.equal(kindFromSameProduct(true), "direct");
  assert.equal(kindFromSameProduct(false), "adjacent");
});

test("buildDiscoveryQuery names the category without boolean operators", () => {
  const query = buildDiscoveryQuery({
    name: "Helpdesk AI",
    category: "customer support / helpdesk",
    products: ["Inbox", "AI Copilot"],
    positioning: "AI-native helpdesk for SMB in EU/US",
  });
  assert.match(query, /Helpdesk AI/);
  assert.match(query, /helpdesk/i);
  assert.equal(/\bAND\b|\bOR\b|site:/.test(query), false);
});

test("parseGrokCandidates keeps 3–5 rows that match known hit URLs", () => {
  const known = new Set(["zendesk.com", "freshdesk.com", "intercom.com", "gong.io"]);
  const parsed = parseGrokCandidates(
    {
      candidates: [
        {
          url: "https://www.zendesk.com",
          name: "Zendesk",
          rationale: "Same helpdesk category.",
          sameProduct: true,
          region: "US",
          distanceKm: 120,
        },
        {
          url: "https://freshdesk.com",
          name: "Freshdesk",
          rationale: "Adjacent support suite.",
          sameProduct: true,
          region: "IN",
          distanceKm: 400,
        },
        {
          url: "https://evil.example",
          name: "Nope",
          rationale: "Hallucinated",
          sameProduct: true,
          region: "US",
          distanceKm: 1,
        },
        {
          url: "https://intercom.com",
          name: "Intercom",
          rationale: "Customer messaging overlap.",
          sameProduct: false,
          region: "IE",
          distanceKm: 90,
        },
        {
          url: "https://gong.io",
          name: "Gong",
          rationale: "Wrong category.",
          sameProduct: false,
          region: "US",
          distanceKm: 200,
        },
      ],
    },
    known,
  );
  assert.equal(parsed.length, 4);
  assert.equal(parsed.some((row) => hostKey(row.url) === "evil.example"), false);
});

test("rankWithoutGrok takes at most five unique hits as a fallback", () => {
  const ranked = rankWithoutGrok(
    [
      { url: "https://a.example", title: "A", fragment: "helpdesk" },
      { url: "https://b.example", title: "B", fragment: "" },
      { url: "https://c.example", title: "C", fragment: "" },
      { url: "https://d.example", title: "D", fragment: "" },
      { url: "https://e.example", title: "E", fragment: "" },
      { url: "https://f.example", title: "F", fragment: "" },
    ],
    new Set(),
  );
  assert.equal(ranked.length, 5);
  assert.equal(ranked[0]?.name, "A");
  assert.equal(ranked[0]?.sameProduct, true);
});
