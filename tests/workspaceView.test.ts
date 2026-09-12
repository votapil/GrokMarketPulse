import assert from "node:assert/strict";
import { test } from "node:test";
import { workspacePlanLabel } from "../src/lib/workspaceView.ts";

test("workspacePlanLabel uses a priced Pro plan when present", () => {
  assert.equal(
    workspacePlanLabel([{ name: "Pro", usd: 45, period: "month" }]),
    "Pro $45",
  );
});

test("workspacePlanLabel does not invent Pro $45 when plans are missing", () => {
  assert.equal(workspacePlanLabel([]), "No listed plans");
});

test("workspacePlanLabel prefers the first priced plan when none is named Pro", () => {
  assert.equal(
    workspacePlanLabel([
      { name: "Starter", usd: 19, period: "month" },
      { name: "Scale", usd: 99, period: "month" },
    ]),
    "Starter $19",
  );
});

test("workspacePlanLabel uses the plan name when the price is unknown", () => {
  assert.equal(
    workspacePlanLabel([{ name: "Enterprise", usd: null, period: "year" }]),
    "Enterprise",
  );
});
