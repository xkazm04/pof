# Bug+UI Scan Fix Wave 4 — Silent Failures, Dead Controls & Dishonest Success

> 4 commits, 7 High-severity findings closed across 13 files. Theme B (success-theater) + silent-failure honesty.
> Every finding here shares one anti-pattern: **the UI lied about state** — a failure looked like success, or a dead control looked live.

## Commits

| # | Commit | Findings closed | Files |
|---|---|---|---|
| 1 | `<c1>` fix(ai-testing,asset-forge): flush debounced edit on unmount + cap local poll retries | ai-testing-localization #1, visual-asset-generation #1 | DebouncedFields.tsx, useForgeStore.ts |
| 2 | `<c2>` fix(evaluator): honest quality dashboard errors + no dead Scan Project button | quality-evaluation-engine #2, project-health-insights #1 | AggregateQualityDashboard/index.tsx, ProjectHealthDashboard/HealthHeader.tsx |
| 3 | `<c3>` fix(telemetry,materials): surface silent scan + style-transfer failures | session-analytics-telemetry #1, level-materials-authoring #2 | useGenreEvolution.ts, TelemetryEvolution/index.tsx, MaterialStyleTransfer/{useMaterialStyleTransfer.ts,index.tsx} |
| 4 | `<c4>` fix(layout-lab): surface a failed artifact write instead of faking success | layout-lab-pipeline-steps #3 | labArtifactClient.ts, labPipelineStore.ts, Baseline/useBaseline.ts, PipelineRail.tsx, Baseline/index.tsx |

(Commit SHAs: see `git log` — c1 first of the wave, c4 last.)

## What was fixed

1. **Debounced edit dropped on unmount** — DebouncedFields' cleanup comment claimed to flush the pending commit but only cleared the timer; collapsing a card mid-debounce silently discarded the edit. Now a `pendingRef` holds the latest value and the cleanup commits it via a ref-held callback (nulled on normal fire/blur — no double-commit).

2. **Infinite retry storm** — `submitLocalJob`'s poll loop had no consecutive-failure cap (unlike `submitMcpJob`'s 3-strikes); a stuck status endpoint retried forever with the job frozen in "Generating". Mirrored the 3-strikes cap → job fails cleanly after 3 misses.

3. **Quality dashboard failed open to "healthy"** — swallowed `/api/feature-matrix` failures into `console.error` and cleared loading, rendering empty/stale as fine. Added error state: centered error tile w/ Retry on first-load failure, inline "showing previously loaded data" banner on refresh failure.

4. **Dead "Scan Project" button** — no onClick; looked live, did nothing. Verified no scan trigger exists anywhere in the code, so it's now honestly disabled with a "Requires CLI integration" caption rather than a hover-only hint.

5. **Silent genre-scan failure** — `useGenreEvolution.scanProject` swallowed failures to `null` and the caller never checked; the button just reverted to idle. Now sets a `scanError` state surfaced as an inline alert.

6. **Silent style-transfer failure** — `MaterialStyleTransfer` analysis errors failed silently. Added an `analyzeError` state (network + server-error branches) rendered as an inline alert, cleared on retry/new-image.

7. **Failed artifact write reported as success** — `postArtifact` returned `void`, so a failed POST left the optimistic local artifact looking persisted. It now returns `Promise<boolean>`; the write-through sets a new per-step `syncError` on failure, and the pipeline rail shows a persistent "Not synced to server" badge. Success-path optimistic UX untouched.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors (full project, after all 4 commits) |
| Affected-area tests | 155/155 pass (evaluator, layout-lab artifact-sync + Baseline, core-engine/Telemetry, game-systems) |

## Pattern catalogue (items 8–9)

8. **"Fail closed to silence" is a lie the UI tells** — a `catch { console.error }` with no error state renders whatever stale/empty data was already there as if it were fresh and healthy. Every fetch/scan/analyze catch on a surface that represents *state* needs a visible error path; the more the surface is *about* health/correctness (dashboards, gates), the worse the silent-failure lie. Fix: an `error` state + inline alert using the repo's established pattern; distinguish empty from failed.
9. **Dead-control honesty** — a styled primary button with no handler (or a "flush" that doesn't flush, a `void` write that can fail) reads as a working affordance. If the backing action genuinely doesn't exist yet, make the control honestly disabled/labeled; never leave a live-looking no-op. Grep for buttons whose onClick is absent/empty and async helpers returning `void` that can fail.

## Cumulative status (Waves 1–4)

- **9/9 Criticals** + **18 High** closed (11 in W3, 7 in W4), 23 fix commits + 4 wave summaries.
- ~22 High remain (destructive-action guards, global-state leaks, remaining races, the `slug()`/timestamp-ID collisions, plus UI-heavy Highs like design-system inconsistency).

## What remains

Wave 5 (design-system consistency sweep + the UI-heavy Highs — Fable), Wave 6 (data-corruption Highs: slug/timestamp-ID collisions, global-state leaks, destructive-action guards; then the Medium/Low tail + test backfill).
