# AI Testing & Localization — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Test-run / Auto-detect CLI round-trip never closes — scenario statuses, lastRunOutput, and the pass-rate ring are permanently dead
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/game-systems/AIBehaviorView.tsx:132` (handleRunTests), `:119-130` (handleGenerateStimuli), `src/lib/prompts/ai-testing.ts:148` & `:176-179`
- **Scenario**: User clicks "Run Tests" (or the Sparkles "Auto-detect" stimuli button). A prompt is dispatched to a CLI session via `testRunCli.sendPrompt(...)` / `testGenCli.sendPrompt(...)` — and that is the end of the data flow. `useModuleCLI` exposes an `onComplete(success)` callback, but `AIBehaviorView` passes none, and no code anywhere parses CLI output back into the DB (grep confirms the only writer of `status`/`last_run_output` is the generic `update-scenario` PUT, which the UI only calls with `description`/`stimuli`/`expectedActions`). The `buildMockStimuliPrompt` even instructs the model to "Return ONLY the two JSON arrays" — machine-shaped output with no consumer.
- **Root cause**: The feature's data model (6-state `ScenarioStatus` incl. `running`, `lastRunOutput`, `lastRunAt`, the spinning `STATUS_META.running` pill, the "Last Run Output" panel, the pass-rate ring, and `getTestingSummary`'s passed/failed counts) assumes a write-back path from CLI runs that was never wired. `passed`/`failed`/`error`/`running` are unreachable states in the product flow.
- **Impact**: Success theater — tests "run" but every scenario stays `draft` forever; pass rate reads 0% regardless of outcomes; the Last Run Output panel and running spinner can never render. Users must read raw terminal output and get no persisted history, while the UI silently implies it tracks results.
- **Fix sketch**: Pass `onComplete` to `testRunCli`/`testGenCli` and (mirroring the parseManualReviews pattern) regex-extract a structured JSON result block from session output, then call `updateScenario({ id, status, lastRunOutput, lastRunAt })` / merge auto-detected `stimuli`/`expectedActions`. Set `status: 'running'` when dispatching so the existing spinner state becomes real.

## 2. All AI-testing mutations fail silently — inputs are cleared optimistically and no error ever reaches the UI
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/hooks/useCRUD.ts:75-84` (mutate swallows), `src/components/modules/game-systems/AITestingSandbox.tsx:80-84`, `src/components/modules/game-systems/AIBehaviorView.tsx:75-87`
- **Scenario**: User types a scenario name and presses Enter while the dev server hiccups (or the API returns 4xx/5xx). `handleAddScenario` clears the input immediately, then `mutate` catches the thrown `apiFetch` error, logs to console, and returns `null`. `useAITesting`'s ops convert that to `false`/`null`, and every caller (`handleCreateScenario`, `handleCreateSuite` — which also wipes both suite-name fields, `deleteSuite` onClick) discards the return value. `useCRUD`'s `error` state is only set by `refetch`, so `FetchError` never shows for mutations.
- **Root cause**: `mutate`'s catch-and-return-null contract requires callers to check the result, but every call site in this module fires-and-forgets, and the UI clears user input before the outcome is known.
- **Impact**: Lost user input (typed names vanish), phantom successes (user believes the scenario/suite was created or deleted), and zero feedback — the list simply doesn't change, which reads as a rendering glitch rather than a failed save.
- **Fix sketch**: Surface mutation failures: have `mutate` set the shared `error` state (or rethrow) and make `handleAddScenario`/`handleCreateSuite` await the op and only clear inputs on success; show a toast/inline error on `false`.

## 3. PUT update-scenario accepts non-array `stimuli`/`expectedActions` — one malformed request persistently bricks the sandbox view
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/app/api/ai-testing/route.ts:91-96` (no shape validation), `src/lib/ai-testing-db.ts:207-229` (stringifies whatever arrives), `src/components/modules/game-systems/AITestingSandbox.tsx:308` & `:376`
- **Scenario**: Any client sends `PUT /api/ai-testing` with `{ action: 'update-scenario', id: 1, stimuli: null }` (a natural null-vs-undefined slip in a script/MCP caller). `buildUpdateQuery` checks `!== undefined`, so `null` passes; `JSON.stringify(null)` → the row's `stimuli` column becomes `'null'`. On the next GET, `rowToScenario` runs `JSON.parse('null')` (the `|| '[]'` guard doesn't fire — `'null'` is truthy) and returns `stimuli: null`. The collapsed row then evaluates `scenario.stimuli.length` → TypeError → the whole sandbox tab crash-loops on every render. Same poisoning with a string/object payload (`'x'.map is not a function`). The create path coincidentally survives `null` via `?? []` but not strings/objects.
- **Root cause**: The route trusts the request body's shape end-to-end; the DB layer serializes any JSON-able value; the UI assumes arrays. There is no `Array.isArray` gate anywhere, and the corruption is durable — refresh refetches the same poisoned row.
- **Impact**: Persistent client crash (entire Testing Sandbox tab unusable for that suite) until the row is repaired by hand in SQLite; non-obvious cause since the bad write may have happened long before.
- **Fix sketch**: In the route (or `updateScenario`/`createScenario`), validate `Array.isArray(body.stimuli)` / `Array.isArray(body.expectedActions)` and 400 otherwise. Defense-in-depth: make `rowToScenario` coerce non-array parse results to `[]`.

## 4. "Copy CSV" string-table export does not escape quotes or newlines — silently malformed UE5 import once real strings flow through
- **Severity**: Low
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/components/modules/evaluator/LocalizationPipelineView.tsx:1176-1180`
- **Scenario**: `csvContent` builds rows as `"${r.key}","${r.sourceString}","${r.comment}"`. A source string containing a double-quote (e.g. dialogue: `She said "run".`) or a newline produces a row where the embedded `"` terminates the field early — the pasted CSV mis-parses in UE5's string-table import, shifting columns or splitting rows with no error here. Cannot trigger with today's canned fixtures (the scan regexes capture `[^"]+`), but `fixtures.ts` is explicitly documented as the single seam to be swapped for real scanning/LLM translation, at which point this corrupts output silently.
- **Root cause**: Hand-rolled CSV serialization assumes field values never contain the delimiter/quote characters; no RFC 4180 escaping (`"` → `""`) is applied.
- **Impact**: Corrupted exported string tables — wrong keys/source strings imported into the game with no warning; latent time bomb armed by the planned fixtures-to-real-data swap.
- **Fix sketch**: Add a `csvEscape(v) = '"' + v.replace(/"/g, '""') + '"'` helper and run key/sourceString/comment through it; reject or encode raw newlines deliberately.

## UI findings

## 5. Sandbox editing surface is invisible to assistive tech — icon-only buttons and placeholder-only inputs have no accessible names
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/AITestingSandbox.tsx:210-221` (also `:367-372`, `:412-417`, `:430-435`, `:472-477`, `:387-395`; `AIBehaviorView.tsx:265-271`)
- **Scenario**: A screen-reader or switch user tabs through a scenario card: the add-scenario `+`, add-stimulus `+`, add-expected `+`, and both Trash2 remove buttons announce as unlabeled "button"; the stimulus-type `<select>`, label/description inputs, and the timeout number input expose only placeholders (which vanish once filled). The suite-delete button has only a `title`.
- **Root cause**: Icon-only controls were shipped without `aria-label`/sr-only text, diverging from the app's own convention — `LocalizationPipelineView` in this same scope consistently uses `sr-only` labels, `aria-expanded`/`aria-controls`, and `FOCUS_RING_CLASS` (which the sandbox also lacks on buttons).
- **Impact**: The core test-authoring flow is effectively unusable non-visually; destructive trash buttons are indistinguishable from add buttons; WCAG 4.1.2 / 1.3.1 failures.
- **Fix sketch**: Add `aria-label` to every icon-only button ("Add scenario", "Remove stimulus", "Delete suite"...), `aria-label` on the type select and timeout input, and apply the shared `FOCUS_RING_CLASS` pattern used by the evaluator views.

## 6. One-click, cascade suite deletion with no confirmation or undo
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-systems/AIBehaviorView.tsx:266` (also `AITestingSandbox.tsx:510-516`)
- **Scenario**: The trash icon in the suite header sits 8px from the header text; a single misclick instantly deletes the suite and — now that `foreign_keys = ON` is enforced — cascades away every scenario, stimulus, and expected action in it. Scenario delete inside the expanded card is equally instant. There is no confirm dialog, no undo, and (per finding 2) not even feedback if it fails.
- **Root cause**: Destructive actions were wired straight to the DELETE mutation without a confirmation affordance, despite the payload being an entire authored test suite rather than a single field.
- **Impact**: Irreversible loss of hand-authored test scenarios from one stray click; users learn to fear the toolbar.
- **Fix sketch**: Gate suite (and ideally scenario) deletion behind a lightweight confirm (inline "Delete N scenarios?" two-step button or dialog), or implement soft-delete with an undo toast.

## 7. Both toolbar buttons spin for any background activity — user can't tell whether tests are running or being generated
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-systems/AITestingSandbox.tsx:143` (and `:157`, prop at `AIBehaviorView.tsx:138`)
- **Scenario**: Clicking "Run Tests" flips the single `isGenerating` flag (`testGenCli.isRunning || testRunCli.isRunning`), so the "Generate All Tests" button *also* swaps its icon for a spinner (and vice versa), while every per-scenario "Generate Test"/"Auto-detect" button disables with no individual busy state.
- **Root cause**: Two independent CLI sessions (`testGenCli`, `testRunCli`) already expose separate `isRunning` flags, but the parent ORs them into one prop, erasing which action is in flight.
- **Impact**: Misleading progress feedback — users double-issue actions or wait on the wrong button; spinner loses its meaning as "this action is in progress".
- **Fix sketch**: Pass `isRunningTests` and `isGeneratingTests` separately; spin only the active button and keep the other merely disabled. Track which scenario triggered a single-test generation to localize its busy state.

## 8. Hand-rolled accent chip/button styling repeated 8+ times with inconsistent opacity tokens
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/game-systems/AITestingSandbox.tsx:152-155` (also `:114-129`, `:214-218`, `:500-505`; `AIBehaviorView.tsx:242-246`, `:319-323`)
- **Scenario**: The `{ backgroundColor: ${color}15, color, border: 1px solid ${color}30 }` pill/button pattern is duplicated inline ~8 times across the two AI-testing files. The same file imports `OPACITY_15`/`OPACITY_30` and uses them in some spots (`:138-141`, `:314-318`) but hardcodes the `15`/`30` hex literals in others — two sources of truth for the same opacity within one component. Meanwhile the evaluator views in this scope route equivalent chips through the shared `Badge` + `SEVERITY_TOKENS` system.
- **Root cause**: No shared `AccentButton`/`AccentPill` primitive for the tinted-accent style, so each call site re-derives it and drifts.
- **Impact**: Visual drift risk (theme/opacity changes won't propagate), heavier diffs, and inconsistency with the app's Badge-based convention.
- **Fix sketch**: Extract an `AccentButton`/`AccentPill` (color prop → bg/border/text via `OPACITY_15`/`OPACITY_30`) and replace the inline-style call sites; reuse `Badge` for the passed/failed counters.

## 9. Search text bleeds between Strings and Translations tabs, and filtered-to-zero lists render blank space
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/LocalizationPipelineView.tsx:112` (shared state; inputs at `:437` and `:521`)
- **Scenario**: A single `searchQuery` state feeds both the Strings tab and the Translations tab, while context/locale/preset filters are per-tab. Search "fireball" on Strings, switch to Translations: the list arrives pre-filtered. Combine with a preset chip and the list can shrink to zero rows — below the count text the scroll area is simply empty, with no "no matches — clear filters" empty state (unlike the polished empty states the same view ships for hazards/QA/tables).
- **Root cause**: Filter state was hoisted to the view level for one input reused across tabs; zero-result rendering was never given an explicit branch.
- **Impact**: Momentary "where did my data go?" confusion and a dead-end UI when filters over-constrain; inconsistent with the view's otherwise careful empty-state polish.
- **Fix sketch**: Either scope `searchQuery` per tab or clear it on tab switch; add a small empty-state row ("No strings match — clear search/presets" with a reset button) when `filteredStrings`/`filteredEntries` is empty but the source list is not.
