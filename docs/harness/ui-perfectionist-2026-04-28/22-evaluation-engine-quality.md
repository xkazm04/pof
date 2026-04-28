# UI Perfectionist — Evaluation Engine & Quality

> Context: Evaluation Engine & Quality (Quality & Evaluation)
> Files read: 16
> Total: 5 — Critical: 0, High: 2, Medium: 2, Low: 1

## 1. Three divergent severity vocabularies feed the same UI surface

- **Severity**: High
- **Category**: Design System / Severity Taxonomy
- **File**: src/lib/evaluator/finding-collector.ts:10; src/types/gdd-compliance.ts:4; src/lib/evaluator/insight-generator.ts:3
- **Scenario**: Three engines that all surface "issues" to the same dashboard each declare their own severity scale. `FindingSeverity = 'critical' | 'high' | 'medium' | 'low'` (eval findings), `GapSeverity = 'critical' | 'major' | 'minor' | 'info'` (GDD compliance gaps), and `InsightSeverity = 'critical' | 'warning' | 'info' | 'positive'` (correlated insights). Downstream views are forced to author three colour/icon maps for what is conceptually one axis, and a `major` GDD gap and a `high` eval finding render with no visual relationship even though they represent comparable urgency.
- **Root cause**: Each subsystem grew its own taxonomy in isolation; no canonical `Severity` union and no documented mapping between scales.
- **Impact**: Visual inconsistency across panels — same urgency renders different colours/labels depending on which engine produced it. Users cannot triage "everything critical" with a single mental model. Localisation and a11y labels must be duplicated three times.
- **Fix sketch**: Define a canonical `Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'positive'` plus a single `SEVERITY_PRESENTATION` map (label, colour token, icon, sortRank) in a shared module. Have each engine map its native scale onto the canonical one at the boundary (`major → high`, `minor → medium`, `warning → high|medium`). Views consume only the canonical type. Keep the engine-internal types if domain-meaningful, but never let them leak to UI props.

## 2. Three "done/error" status vocabularies for the same scan lifecycle

- **Severity**: High
- **Category**: Status Taxonomy / State Machine Consistency
- **File**: src/lib/evaluator/deep-eval-engine.ts:22, 31; src/types/project-health.ts (referenced by health-engine.ts:9-15)
- **Scenario**: A single deep-eval run carries three different status enums that views must reconcile. `EvalStatus = 'idle' | 'running' | 'completed' | 'error' | 'cancelled'` for the top-level scan; `passStatuses` per module/pass uses `'pending' | 'running' | 'done' | 'error' | 'skipped'`; `ModuleHealthStatus` (downstream) uses `'not-started' | 'healthy' | 'warning' | 'critical'`. "Completed" / "done" / (no equivalent) all mean the same thing; "idle" / "pending" / "not-started" are three names for the unstarted state.
- **Root cause**: Each layer (engine, per-cell progress, health summary) was typed independently. There is no shared lifecycle vocabulary.
- **Impact**: Sidebar / progress UIs that show both the overall scan badge and per-pass cell badges must implement two parallel colour-and-label maps for what reads to the user as "the same status." A pass cell coloured for `done` next to an overall pill coloured for `completed` is a polish smell.
- **Fix sketch**: Standardise on one lifecycle vocabulary at the type boundary (`pending | running | done | error | skipped | cancelled`). Define `LIFECYCLE_PRESENTATION` (label, dot colour token, animated state for `running`) once. Health status remains a separate concept (it's a quality grade, not a lifecycle), but rename `not-started` → `unscored` to stop colliding semantically with `idle`/`pending`.

## 3. Severity icons hardcoded inside engine output (not themeable)

- **Severity**: Medium
- **Category**: Inline Style / Engine-Layer Presentation Drift
- **File**: src/lib/gdd-synthesizer.ts:584-601
- **Scenario**: `gdd-synthesizer.ts` bakes presentation directly into engine output via `statusEmoji()` (`✅ 🟡 ❌ ❓`) and `severityIcon()` (`🔴 🟠 🟡 🟢 ⚪`), embedded inline in markdown table cells the GDD doc renders. The engine is a pure-logic context, but it's authoring visual atoms that downstream views cannot restyle, recolour, or replace with lucide-react icons that match the rest of the app.
- **Root cause**: Markdown emoji was the path of least resistance for a quick GDD render; the colour/icon mapping never made it into a presentation layer. `progressBar()` (line 603) using `█/░` is the same anti-pattern.
- **Impact**: GDD section renders with emoji that don't match the lucide-based iconography elsewhere in the app, can't respect dark/light theme tokens, and have no a11y labels. If the design-system severity colour palette changes, this emoji mapping silently stays stale — guaranteed drift.
- **Fix sketch**: Have the engine emit structured tokens (`status: 'implemented'`, `severity: 'high'`) and let the markdown renderer or a thin presenter layer map to glyphs. If markdown output truly needs inline glyphs, source them from the same `SEVERITY_PRESENTATION` table proposed in finding 1 so a palette change updates both. Same for `progressBar` — emit `{ pct: 67 }` and render the bar in the view.

## 4. Health-score → colour thresholds defined in three incompatible places

- **Severity**: Medium
- **Category**: Design System / Numeric Threshold Drift
- **File**: src/lib/health-engine.ts:72-76; src/lib/evaluator/combined-health.ts:34-39; src/lib/gdd-compliance.ts:131-162
- **Scenario**: Three "module health" scoring functions with different weights and different (or absent) threshold-to-status mappings. `health-engine.ts` weights checklist 60% / quality 40% and bands at >=70 healthy / >=40 warning / <40 critical. `combined-health.ts` uses 40/30/20/10 weighting (quality / depHealth / coverage / activity) and exposes only a raw 0-100 number with no banding. `gdd-compliance.ts` uses 60/30/10 weighting (features / checklist / gap penalty) and again returns a bare 0-100. UI panels showing two of these side-by-side will pick different colour cutoffs because no canonical threshold table exists.
- **Root cause**: Each scoring formula was authored for its own panel; the `score → status → colour` mapping was never extracted as a shared concern, so the second and third engines silently delegate that decision to whoever consumes them.
- **Impact**: A module scoring 65 reads "warning" on one panel and "healthy" on another (or whatever the consumer chose). Visual hierarchy across the Evaluation/Quality surfaces is incoherent, and any "rebalance the colours" change has to be made in N places — guaranteed to drift again.
- **Fix sketch**: Extract one `scoreToBand(score: number): 'excellent' | 'healthy' | 'warning' | 'critical'` plus a `BAND_PRESENTATION` map (colour token, label, icon). All three engines return `{ score, band }` so views never re-derive the band. If the three weighting formulas serve genuinely different questions, document why each exists; otherwise consolidate to one.

## 5. InsightCategory has priority but no canonical presentation map

- **Severity**: Low
- **Category**: Design System / Visual Hierarchy
- **File**: src/lib/evaluator/insight-generator.ts:7-15, 37-194
- **Scenario**: 8 `InsightCategory` values (`brittle-module`, `neglected-module`, `blocked-progress`, `quality-disconnect`, `overworked-low-roi`, `strong-module`, `coverage-gap`, `dependency-bottleneck`) each carry an inline `priority: number` (0-10) baked into the rule body. There is no exported map from category to icon, accent colour, or heading template — every consumer view rebuilds its own switch statement and risks rendering, e.g., `strong-module` with the same accent as `brittle-module`.
- **Root cause**: Priority lives inline in rules (line 51, 70, 88, etc.), and the category→presentation concern was deferred to the view layer.
- **Impact**: Cards/lists that render insights have no shared visual hierarchy guarantee — sort order is consistent (priority is exported on the result) but icon, accent, and category-label rendering will drift between panels. Positive insights (`strong-module`) particularly risk being styled as "info" warnings.
- **Fix sketch**: Add `INSIGHT_CATEGORY_PRESENTATION: Record<InsightCategory, { label, icon, accentToken, defaultSeverity }>` next to the type. Hoist the magic-number priorities into a `CATEGORY_PRIORITY` constant so designers can re-order them without grepping rule bodies. Views import the map; no per-view switch statements.
