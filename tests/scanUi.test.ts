import assert from "node:assert/strict";
import { test } from "node:test";
import { canStartScan, scanButtonTitle } from "../src/lib/scanUi.ts";

test("canStartScan is false without a competitor", () => {
  assert.equal(canStartScan(null, false), false);
});

test("canStartScan is true when a competitor is idle", () => {
  assert.equal(canStartScan("jn72competitor", false), true);
});

test("canStartScan is false while a scan is running", () => {
  assert.equal(canStartScan("jn72competitor", true), false);
});

test("scanButtonTitle explains why the header CTA is idle", () => {
  assert.equal(scanButtonTitle({ hasCompetitor: false, isScanning: false }), "Waiting for workspace competitor");
  assert.equal(scanButtonTitle({ hasCompetitor: true, isScanning: true }), "Scan in progress");
  assert.equal(scanButtonTitle({ hasCompetitor: true, isScanning: false }), "Run Scan");
});
