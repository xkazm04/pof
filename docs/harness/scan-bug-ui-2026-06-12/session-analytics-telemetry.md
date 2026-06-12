# Session Analytics & Telemetry — Bug + UI scan (2026-06-12)

> Total: 8 findings (3 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. The 8b7856f ISO-timestamp-default fix is inert on every existing database
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure (incomplete fix)
- **File**: `src/lib/db.ts:290`
- **Scenario**: Commit 8b7856f changed the `started_at`/`completed_at` defaults from `datetime('now')` (space-separated) to `strftime('%Y-%m-%dT%H:%M:%fZ','now')` so default-inserted rows can't fall outside the lexicographic week-range filter. But the change lives inside `CREATE TABLE IF NOT EXISTS session_analytics` — on any database created before the commit, the statement is a no-op and the old space-format default persists. The exact scenario the commit claims to close ("a future writer, a backfill, an imported row… vanish from digests") still happens on every existing install; only fresh DBs are protected. Worse, old installs that ever take a default write get mixed-format rows where `'2026-06-12 23:59:59'` sorts *below* `'2026-06-12T00:00:01Z'` (`' '` < `'T'`), silently mis-ordering `ORDER BY completed_at DESC` consumers (getRecentSessions, getPromptQualityScore windows, streaks) within a day. (Verified today's writers: `recordSession` is the only INSERT and always binds explicit ISO strings — weekly-digest / project-wrapped / pattern-extractor only SELECT — so no mixed rows exist *yet*; this is a re-armed time bomb, not an active corruption.)
- **Root cause**: SQLite cannot alter a column default in place and `CREATE TABLE IF NOT EXISTS` never updates an existing table's schema; the fix assumed the DDL change reaches all databases. db.ts already has the right precedent (the `feature_matrix_new` rebuild at db.ts:69-89) but no migration was added for session_analytics.
- **Impact**: The fix's stated guarantee ("the format can't diverge") is false for all pre-existing installs — environment-dependent, unreproducible-on-fresh-checkout row loss in weekly digest / daily chart / streaks remains possible, plus intra-day mis-ordering once mixed formats appear.
- **Fix sketch**: On startup, inspect `SELECT sql FROM sqlite_master WHERE name='session_analytics'`; if it still contains `datetime('now')`, rebuild via the feature_matrix pattern (create-new → copy → rename) with the ISO defaults, and run one `UPDATE session_analytics SET completed_at = replace(completed_at,' ','T')||'Z' WHERE completed_at LIKE '% %'` (same for started_at) to normalize any legacy rows.

## 2. Substring matching turns Scroll/Dashboard widgets into "dodge/roll" evidence and fabricates Souls-like suggestions
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case (wrong results)
- **File**: `src/lib/genre-evolution-engine.ts:167`
- **Scenario**: If a scanned UE5 project contains any UCLASS named e.g. `UInventoryScrollWidget`, `UShopScrollBox`, or `ATrollEnemy`, `hasDodgeAbility` fires because the check is `n.includes('roll')` (likewise `includes('dash')` matches `UDashboardWidget`). That alone yields a `dodge-roll-heavy` detection at confidence 60 with the fabricated evidence string "Dodge/roll ability class detected", which clears the ≥50 bar in `generateSuggestions` and emits a pending "Evolve toward Souls-like" card after every scan. Same trap elsewhere: `gameplayEffectCount` counts any name containing `ge_` (`UDamage_OverTime`, `UStage_One`), and `gasAbilityCount` counts `ga_` inside `UMega_Blast` — inflating the confidence boosts in PATTERN_RULES.
- **Root cause**: Signal extraction matches raw substrings of lowercased class names instead of whole camel-case tokens. Commit 25d6de5 fixed exactly this bug class in pattern-library ("match anti-pattern keywords on whole words, not substrings") but the genre engine kept substring semantics. The unused `headerPaths` variable (line 139) suggests intended path-based corroboration was dropped.
- **Impact**: Wrong results presented as telemetry: phantom pattern detections with invented evidence, bogus genre suggestions that re-nag the user (compounded by known finding #2 from 2026-06-09 — dismissals resurrect), and skewed confidence on legitimate patterns.
- **Fix sketch**: Tokenize class names on camel-case/underscore boundaries (`AMyScrollBox` → `["a","my","scroll","box"]`) and compare whole tokens (`roll`, `dash`, `dodge`, `ga`, `ge`) — mirroring the 25d6de5 whole-word approach. Keep multi-token phrases (`gameplayability`) as joined-token checks.

## 3. Clearing the prompt doesn't cancel the in-flight debounce — stale suggestions resurrect for empty input
- **Severity**: Low
- **Lens**: bug
- **Category**: race-condition (stale state)
- **File**: `src/hooks/useSessionAnalytics.ts:80`
- **Scenario**: User types a prompt (schedules the 500ms debounce timer at line 87), then within 500ms selects-all and deletes. The empty-prompt branch (lines 80-83) calls `setSuggestions([])` and returns *before* reaching the `clearTimeout` at line 86 — so the previously scheduled timer still fires, fetches suggestions for the deleted text, and repopulates the panel. The user now stares at "This prompt is much longer than typical successful prompts" under an empty textbox until the next keystroke.
- **Root cause**: The clear-suggestions guard and the debounce-cancel are ordered wrong: the early return treats "empty prompt" as a terminal state but only resets the rendered list, not the pending timer that will overwrite it.
- **Impact**: Wrong/contradictory guidance shown for input that no longer exists; erodes trust in the suggestion feature (deterministically reproducible with type-then-clear inside 500ms).
- **Fix sketch**: Hoist the cancel above the guard: at the top of `fetchSuggestions`, run `if (timeoutRef.current) clearTimeout(timeoutRef.current)` before the `!prompt.trim()` check, so clearing input also voids any scheduled fetch.

## UI findings

## 4. Every failure in the Genre Evolution view is silent — errors are indistinguishable from "no data"
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/TelemetryEvolution.tsx:47`
- **Scenario**: If `GET /api/telemetry` fails (e.g. one corrupt row — known bug #3 from 2026-06-09), the hook's `catch(() => null)` (useGenreEvolution.ts:30) renders the cheerful "No telemetry data yet" empty state over real, existing data. If "Scan Project" fails, `scanProject` returns null, `handleScan` ignores it: the spinner stops and nothing happens. If "Accept Evolution"/"Dismiss" fails, `resolveSuggestion` has no catch anywhere, so the click produces an unhandled promise rejection and zero feedback — the card just stays.
- **Root cause**: useGenreEvolution swallows or leaks every error and exposes no `error` value; the component therefore has no error branch — unlike its sibling SessionAnalyticsDashboard, which renders `<FetchError message onRetry>` for the same situation.
- **Impact**: Users can't distinguish "never scanned" from "feature broken"; failed accepts/dismisses look like dead buttons; support-level confusion with no recovery path (no retry).
- **Fix sketch**: Surface an `error` from useGenreEvolution (stop catching to null; let useCRUD's error flow through) and render the shared `FetchError` with retry. Wrap scan/resolve in try/catch and show a toast (and per-card pending/disabled state) on failure.

## 5. Suggestion disclosure headers have no aria-expanded/aria-controls, unlike the dashboard's identical pattern
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/TelemetryEvolution.tsx:266`
- **Scenario**: Keyboard/screen-reader users tab to an "Evolve toward Souls-like" suggestion header. It's announced as a plain button with no expanded/collapsed state and no relationship to the panel it reveals; after pressing Enter nothing is announced. The same expand-row pattern in SessionAnalyticsDashboard (`ModuleStatsRow`, SessionAnalyticsDashboard.tsx:290-294) does it correctly with `aria-expanded`, `aria-controls`, and a labelled `role="region"` panel.
- **Root cause**: The disclosure pattern was reimplemented in TelemetryEvolution without the ARIA wiring the app already standardized on in the analytics dashboard.
- **Impact**: SR users can't perceive or operate the core interaction of the view (expanding a suggestion to reach the Accept/Dismiss buttons); inconsistent disclosure semantics across modules.
- **Fix sketch**: Add `aria-expanded={isExpanded}` and `aria-controls={panelId}` to the header button and `id={panelId} role="region" aria-label={sug.label}` on the expanded body — mirroring ModuleStatsRow.

## 6. Quality-score trend arrow is icon-and-hue only — no text alternative or explanation
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/SessionAnalyticsDashboard.tsx:261`
- **Scenario**: In "Prompt Quality by Module", the improving/declining/stable verdict — the row's most actionable datum — is rendered as a bare 3px TrendingUp/TrendingDown/Minus icon colored green/red/grey. Screen readers skip it entirely (no aria-label, no text), and sighted users get no definition of what the arrow compares (recent 10 vs prior 10 sessions).
- **Root cause**: The row was carefully built with redundant encoding for the score band (icon shape + word + color via `scoreBand`) but the trend indicator was left with shape+hue only and no accessible name — the one element on the row without it.
- **Impact**: The trend is invisible to assistive tech and ambiguous to everyone else, undermining the dashboard's otherwise color-blind-safe design.
- **Fix sketch**: Wrap the icon in the existing `Tooltip` with content like "Trend: improving — last 10 sessions vs the 10 before" and give it `aria-label={`Trend: ${score.trend}`}` (or render the word at `text-2xs` next to the icon, matching the band treatment).

## 7. Accent-pill buttons and section headers are copy-pasted with drifting hover/focus behavior
- **Severity**: Low
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/core-engine/TelemetryEvolution.tsx:87`
- **Scenario**: The tinted accent button (`backgroundColor: ${color}15`, `border: 1px solid ${color}30`, `transition-all`) is hand-rolled three times (Scan header :87-95, empty-state CTA :164-176, Accept Evolution :342-353), and the icon + uppercase `tracking-wider` section header four times (:192, :244, :386, :445). The copies already drift: the accent buttons declare `transition-all` but define no hover or focus-visible state at all, while the adjacent Dismiss button gets `hover:border-border-bright`, and chips in AcceptedGenres get `hover:brightness-110` — so identical-looking controls respond differently (or not at all) to hover and keyboard focus.
- **Root cause**: No shared `AccentButton`/`SectionHeader` primitives for this module; each instance re-implements the inline color math, so interaction states were forgotten inconsistently.
- **Impact**: Primary actions (Scan, Accept) give no hover affordance and no visible keyboard focus ring; future styling changes must be applied in 7 places and will keep drifting.
- **Fix sketch**: Extract `AccentButton({ color, icon, children, ... })` with built-in `hover:brightness-110` and the app's `focus-ring` class, plus a `SectionHeader({ icon, label, meta })`. Replace all seven call sites.

## 8. Loading states use two different spinners and are never announced
- **Severity**: Low
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/evaluator/SessionAnalyticsDashboard.tsx:52`
- **Scenario**: While fetching, SessionAnalyticsDashboard spins an `Activity` icon (an ECG-pulse glyph rotating looks like a glitch, not a spinner) at `py-12`/`text-text-muted-hover`; TelemetryEvolution uses the proper `Loader2` at `py-20`/`text-text-muted`. Neither container has `role="status"` or sr-only text, so assistive tech hears silence during loads.
- **Root cause**: Each module hand-rolls its centered-spinner block; no shared `LoadingState` primitive, so icon, padding, tone, and ARIA diverge.
- **Impact**: Visibly inconsistent loading affordance between sibling analytics views; loading is unperceivable for screen-reader users.
- **Fix sketch**: Extract a `LoadingState` (Loader2 + `role="status"` + `<span class="sr-only">Loading…</span>`, standard padding/tone) and use it in both components.
