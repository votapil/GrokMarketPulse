# Local Review: track B incoming (T-21…T-42 / T-22b / T-33)

**Reviewed**: 2026-09-12
**Decision**: APPROVE with comments

## Summary
B contracts for demo path are sound: snapshots.latest omits markdown, verify closes runs, usage pages, Fal fail-open, setupWatchlist preserves AcmeFlow. No CRITICAL/HIGH blockers for merge. Live rehearsal after A's FeatureMatrix pin: CLEAN through Generate landing.

## Findings

### CRITICAL
None

### HIGH
None (prior "T-21 not reviewed" gap closed by reading act/artifacts/costs + live Generate)

### MEDIUM
- `DemoToggle.tsx`: pressed chip 14px white on `#ff4757` ≈ 3.34:1 — violates DESIGN-BLOCKS body-<18px-on-accent; outline treatment preferred.
- `SourceList` (A, fixed in `f82d484`): empty copy while verifying — fixed before commit.
- Exa hits can be off-brand (Akiflow); confidence may look high — demo caveat only.

### LOW
- ArtifactScreen Summary fact line is model-only (why/positionChange) without anchoring previous→current state.
- Heading order Summary h2 before page h1 Artifact.
- workspace `Date.now()` / `.collect()` in mutations/actions — OK (not queries).

## Validation
| Check | Result |
|---|---|
| Type check | Pass |
| Lint | Skipped |
| Tests | Skipped (no e2e in package) |
| Build | Skipped this pass |
| Rehearsal | Pass after pin (17:33 CLEAN) |

## Acceptance lines written
`docs/progress/A.md` — T-22a/b, T-23, T-25, T-26, T-33, T-41, T-42, T-21 reconfirmed.
