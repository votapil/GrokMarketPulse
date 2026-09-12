import assert from "node:assert/strict";
import { test } from "node:test";
import {
  heroImageAlt,
  withLocalLandingEdits,
  type LandingPayload,
} from "../src/components/artifacts/landingPreviewLogic.ts";

const base: LandingPayload = {
  type: "landing",
  headline: "Outcomes beat empty seats",
  subheadline: "Why $39 list price is not the same as AI that closes tickets.",
  offer: "Book a 15-minute demo of Helpdesk AI Pro.",
  benefits: [],
  differentiation: "We optimize for resolution rate.",
  comparison: [],
  socialProofPlaceholders: [],
  cta: "See the difference",
  sections: [],
};

test("heroImageAlt uses headline and stays useful when headline is empty", () => {
  assert.equal(
    heroImageAlt("Outcomes beat empty seats"),
    "Outcomes beat empty seats — hero",
  );
  assert.equal(heroImageAlt("   "), "Landing page hero");
});

test("withLocalLandingEdits returns a new payload and leaves other fields", () => {
  const next = withLocalLandingEdits(base, {
    headline: "Price is not the product",
    cta: "Book a walkthrough",
  });
  assert.notEqual(next, base);
  assert.equal(base.headline, "Outcomes beat empty seats");
  assert.equal(next.headline, "Price is not the product");
  assert.equal(next.cta, "Book a walkthrough");
  assert.equal(next.subheadline, base.subheadline);
});
