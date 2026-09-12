import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveCompanyPricing } from "../src/lib/companyPricing.ts";

test("resolveCompanyPricing is ready with empty plans when context exists", () => {
  const state = resolveCompanyPricing({
    kind: "convex",
    companyName: "Helpdesk AI",
    contextStatus: "ready",
    error: null,
    context: {
      plans: [],
      keyFeatures: ["Clean LLM-ready markdown/JSON"],
    },
  });

  assert.equal(state.kind, "ready");
  if (state.kind !== "ready") {
    return;
  }
  assert.deepEqual(state.data.plans, []);
  assert.deepEqual(state.data.keyFeatures, ["Clean LLM-ready markdown/JSON"]);
  assert.equal(state.data.fromConvex, true);
});

test("resolveCompanyPricing is empty only when there is no company context", () => {
  const state = resolveCompanyPricing({
    kind: "convex",
    companyName: "Helpdesk AI",
    contextStatus: "ready",
    error: null,
    context: null,
  });
  assert.equal(state.kind, "empty");
});
