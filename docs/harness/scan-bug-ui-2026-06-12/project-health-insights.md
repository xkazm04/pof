# Project Health & Insights — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Pattern miner stamps the module-wide success rate onto every approach cluster, corrupting confidence and "switch to it" advice
- **Severity**: High
- **Lens**: bug
- **Category**: wrong-results
- **File**: `src/lib/pattern-extractor.ts:183`
- **Scenario**: A module has 18 sessions: approach A (data-driven) succeeds 8/9, approach B (inheritance) succeeds 5/17 attempts overall but yields a 5-session success cluster. `successRate = successful.length / sessions.length` is computed once from ALL module sessions (line 183, inside the module loop but outside the per-approach cluster loop), so approach B's pattern is stored with the module-wide ~55% rate instead of its true ~29%.
- **Root cause**: The per-pattern metric is derived from the wrong population. Every approach cluster in a module shares one blended rate, while the anti-pattern path right next to it (lines 400-405) correctly computes per-approach rates — the two pipelines disagree about the same approach.
- **Impact**: Corrupted derived metrics that propagate: `computeConfidence(cluster.length, 1, successRate)` (line 185) can label a mostly-failing approach 'promising'; the pattern description text asserts the false percentage; the anti-pattern `bestAlternative` filter (`p.successRate >= 0.5`, line 417) can recommend a bad approach as the alternative; and `checkPromptForAntiPatterns` then tells users "The X approach succeeds 55% — switch to it?" about an approach that fails 71% of the time. An approach can simultaneously be stored as a success pattern and flagged as an anti-pattern with contradictory numbers.
- **Fix sketch**: Compute the rate per approach inside the cluster loop: `const approachSessions = sessions.filter(s => detectApproach(s.prompt) === approach); const successRate = cluster.length / approachSessions.length;` (reuse the `approachOf` memoization pattern already used by `extractAntiPatterns`). Feed the same per-approach rate into confidence and the description.

## 2. Stale persisted checklist item IDs count as completed — completion can exceed 100% and inflate health, milestones, and velocity
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/health-engine.ts:48` (also 401-404)
- **Scenario**: A user checks items; later a registry update renames or removes checklist items (the module-registry comment promises "Add/remove a checklist item and both update automatically"). `checklistProgress` persists in localStorage (`pof-modules`) and via `/api/project-progress`, and `toggleChecklistItem` only flips values — orphaned `true` keys are never pruned. The user re-checks the renamed items, so progress now holds both old and new IDs as `true`.
- **Root cause**: `computeModuleHealth` and the `completedChecklistItems` loop count `Object.values(progress).filter(Boolean)` — every truthy key, with no intersection against the module's *current* checklist IDs. `WeeklyDigestView` already solved this correctly by filtering through `MODULE_ITEM_IDS`; the health engine never did, so the two surfaces use different counting rules and drift after any registry edit.
- **Impact**: `checklistCompletion = completed / mod.checklistCount` exceeds 100, pushing `healthScore` past 100, the heatmap bar past its track, and `ProgressRing` past full; `overallCompletion` inflates; milestones flip to "Achieved" before they are; simulated velocity (seeded from the inflated `completedChecklistItems`) and predictions follow. The Weekly Digest checklist count silently disagrees with the Health dashboard.
- **Fix sketch**: Pass or derive the valid item-ID set per module (registry is already imported) and count only `progress[id]` for current IDs — share one helper with WeeklyDigestView's `MODULE_ITEM_IDS` logic. Defensively `Math.min(completed, mod.checklistCount)` as a second line of defense.

## 3. fetchHealth has no request sequencing — the crash-enriched refresh can lose the race to the stale first fetch
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/stores/projectHealthStore.ts:62-83` (trigger chain in `src/components/modules/evaluator/HolisticHealthView.tsx:89-121`)
- **Scenario**: On mount, HolisticHealthView fires `fetchHealth(...)` with `crashInput = null` and `fetchCrashAnalysis()` concurrently. When crash stats land, the `crashInput` memo changes, `handleRefresh` gets a new identity, and the effect fires a second POST while the first is still in flight. Whichever response resolves last wins the `set(...)`.
- **Root cause**: The store treats every response as authoritative — there is no request counter, abort, or staleness check, and the view intentionally refires on each input change (checklist toggles, scan completion, crash/perf stats arrival), making overlapping in-flight requests the normal case, not the exception.
- **Impact**: If the crash-less first response resolves after the enriched second one (sqlite lock, larger scanHistory payload), the dashboard shows Crash Analyzer "Ready"/inactive and a null performance fusion despite real data in the DB, until a manual Refresh. Wrong results with no error surfaced.
- **Fix sketch**: Keep a monotonically increasing `requestId` in the store; capture it before the await and bail out of `set(...)` if a newer request started (`if (id !== latestId) return;`). An AbortController on the previous fetch achieves the same.

## 4. Health dashboard fabricates "healthy" status for subsystems that have never run
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/health-engine.ts:359-383`
- **Scenario**: A fresh project with zero localization runs, zero combat sims, and zero economy sims opens the Holistic Health view. The Subsystem Status grid shows green "healthy" dots for Localization Pipeline, Combat Simulator, and Economy Simulator with metric "Ready" — while their own detail text admits nothing has run ("Run pipeline to check i18n readiness").
- **Root cause**: These three signals hardcode `status: 'healthy'`, unlike their siblings in the same function: perf and crash signals correctly return `'inactive'` when no data exists (and crash even distinguishes "no crashes recorded" from "never imported"). The success-theater default predates the real-signal upgrade and was never aligned.
- **Impact**: A health dashboard that reports green for unchecked subsystems misleads triage — i18n readiness or economy inflation problems hide behind a healthy dot, and the user has no cue that 3 of 7 signals are placebo. Erodes trust in the signals that are real.
- **Fix sketch**: Return `status: 'inactive'` (it already renders gray via `SIGNAL_COLORS.inactive`) for never-run subsystems, mirroring `buildPerfSignal`'s null branch; flip to a score-derived status once each subsystem persists a latest-run artifact.

## 5. /api/weekly-digest bypasses the error envelope — any DB failure surfaces as a cryptic JSON parse error
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/weekly-digest/route.ts:4-7`
- **Scenario**: `generateWeeklyDigest()` throws (locked/corrupt SQLite file, failed `session_analytics` query). The route has no try/catch and does not use the project's `withRoute` wrapper, so Next returns a non-JSON 500. Client-side, `apiFetch` runs `res.json()` on it and throws `Unexpected token 'I'…`, which `FetchError` renders verbatim.
- **Root cause**: Every other route in this context wraps errors into the `{ success: false, error }` envelope (project-health and structured-insights both do); this one returns the raw result of an unguarded synchronous call, so the established error contract silently doesn't hold for this endpoint.
- **Impact**: The Weekly Digest view's error state shows a JSON parse artifact instead of the actual failure cause; users can't tell a DB problem from a code bug, and the Retry button gives no better information.
- **Fix sketch**: `export const GET = withRoute(async () => apiSuccess({ digest: generateWeeklyDigest() }), 'Failed to generate weekly digest');` — one line, reusing the existing helper from `@/lib/api-utils`.

## UI findings

## 6. "Scan Project" is a dead primary CTA — styled, enabled, and wired to nothing
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/ProjectHealthDashboard.tsx:271-292`
- **Scenario**: The dashboard's most prominent button ("Scan Project", accent-tinted, with a Play icon) has no `onClick` at all. The adjacent copy ("Run a scan to analyze your UE5 project structure…") and the empty state both direct users to it; clicking produces nothing, and only the hover tooltip ("Scan functionality requires CLI integration") explains why.
- **Root cause**: The scan flow was scaffolded but never wired — the component even selects `setScanning`, `setLastScan`, and `addScanToHistory` from the evaluator store (lines 77-79) without ever calling them. The button kept its primary styling while losing its handler.
- **Impact**: Core action of the view silently fails; first-time users (who have no scan data and see only this CTA) hit a wall and assume the app is broken. Tooltip-only explanation is undiscoverable and inaccessible to keyboard/touch users.
- **Fix sketch**: Either wire it to the CLI scan task via `useModuleCLI`/`TaskFactory` (pattern already in this file for `handleFix`), or render it visibly disabled with inline helper text ("Requires CLI integration") instead of a tooltip.

## 7. Radar module drill-down is mouse-only; icon-only dismiss buttons are unlabeled
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/ProjectHealthDashboard.tsx:398` (also 232-237, 492-497)
- **Scenario**: Selecting a module on the radar — the only way to reach the per-module issues, recommendations, and "Fix with Claude" actions — is an SVG `<g onClick>` with `cursor-pointer` but no `tabIndex`, `role`, or key handler. The regression-alert dismiss `X` and module-detail close `X` are icon-only buttons with no `aria-label`.
- **Root cause**: Interactive SVG elements don't get focus semantics for free, and the established accessible pattern already in this codebase (WeeklyDigestView's `SparklineBar`: `tabIndex={0}`, `role`, `aria-label`) wasn't applied here.
- **Impact**: Keyboard and screen-reader users cannot open the module detail panel at all — the dashboard's entire remediation flow is unreachable — and dismiss buttons announce as unlabeled "button".
- **Fix sketch**: Give each radar node `tabIndex={0} role="button" aria-label={`${d.label}: ${d.score}/100`}` plus an Enter/Space `onKeyDown`, and add a `:focus-visible` outline on the dot. Add `aria-label="Dismiss alert"` / `"Close module detail"` to the X buttons.

## 8. Hand-rolled PRIORITY_COLORS diverges from SEVERITY_TOKENS — and its 'low' entry is invalid CSS
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/evaluator/ProjectHealthDashboard.tsx:44-49`
- **Scenario**: Low-priority recommendation cards render with no background tint and no border: `PRIORITY_COLORS.low` concatenates an alpha suffix onto a CSS variable (`'var(--text-muted)12'`, `'var(--text-muted)25'`), which is not a parsable color, so the browser silently drops the declarations. The badge bg `${pc.text}15` is equally invalid for 'low'. Critical/high/medium rows (hex-based) tint correctly, making 'low' rows look broken next to them.
- **Root cause**: The component reinvents a severity palette instead of using `SEVERITY_TOKENS` from `@/lib/chart-colors`, which already provides exactly `critical/high/medium/low` with valid `color/bg/border` triples — hex+alpha concatenation only works on hex constants, never on `var()` references.
- **Impact**: Visible inconsistency in the Recommendations lists (one priority tier unstyled), plus a second severity color-language in a module that elsewhere uses the canonical tokens (InsightCard uses `SEVERITY_COLORS`).
- **Fix sketch**: Delete `PRIORITY_COLORS` and map `rec.priority`/`alert.severity` through `SEVERITY_TOKENS[...]` (`.color/.bg/.border`); fall back to `SEVERITY_TOKENS.low`.

## 9. ModuleHeatCell advertises interactivity (hover ring) but does nothing when clicked
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/HolisticHealthView.tsx:449-476`
- **Scenario**: Heatmap cells light up with `hover:ring-1` on mouseover, inviting a click to inspect the module — but they are plain `<div>`s with no handler. In the same Overview tab, the visually similar `SignalCard`s do drill into tabs, so users learn "cards here are clickable" and then get nothing from the heatmap (the densest, most inviting grid on the page).
- **Root cause**: A hover affordance was added without an action, and `hover:ring-1` has no ring color utility, so it falls back to a barely-visible default — a half-built interaction pattern. The drill mechanism (`onNavigateTab`) is already plumbed into the parent.
- **Impact**: False affordance breeds dead clicks and makes the working drill-downs feel unreliable; module health has no path to detail from this view even though the data (issues count, scores) begs for one.
- **Fix sketch**: Convert the cell to a `<button>` that calls `onNavigateTab('scanner')` (or opens the module's detail), add `focus-ring` like SignalCard, and give the hover ring an explicit color (`hover:ring-1 hover:ring-emerald-400/30`). If no target exists yet, remove the hover ring.

## 10. Six bespoke mini-chart implementations; LineChartSimple's gridlines misrepresent the scale
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/evaluator/HolisticHealthView.tsx:648-804` (also `ProjectHealthDashboard.tsx:713-771, 851-885`)
- **Scenario**: This context alone contains six hand-rolled SVG/CSS charts (BarChartSimple, LineChartSimple, AreaChartSimple, BurndownChart, OverallScoreSparkline, ModuleScoreTrend), each re-implementing min/max normalization, point mapping, labels, and fills with slightly different padding, stroke, and label conventions. Concretely misleading: LineChartSimple draws gridlines at fixed 0/25/50/75/100% of the box (lines 678-684) while the polyline is normalized to the data's min..max — so in the Quality Score Trend a point sitting on the "75%" gridline can be a score of 58.
- **Root cause**: No shared mini-chart primitive exists, so every view copy-pastes and drifts; the gridline layer and the data layer in LineChartSimple use two unrelated coordinate systems.
- **Impact**: Users read quality scores against gridlines that lie; charts across Health/Quality/Velocity tabs have inconsistent paddings, dot sizes, and label styles; every future chart bugfix (e.g. single-point series, divide-by-zero) must be applied six times.
- **Fix sketch**: Extract a small `MiniChart` kit (shared normalize + `<Sparkline>`, `<Bars>`, `<Area>` with one padding/label convention) under `components/ui/`; make gridlines derive from the same min/max scale as the data (or pin the y-domain to 0-100 for score charts).
