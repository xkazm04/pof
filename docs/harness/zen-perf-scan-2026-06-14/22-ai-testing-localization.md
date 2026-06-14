# AI Testing & Localization — zen-perf scan
> Context: AI, Build & Packaging Systems / AI Testing & Localization
> Total: 5
> Severity: critical=0 high=3 medium=2 low=0

## 1. Per-keystroke scenario edits fire a PUT + double full-suite refetch (and clobber local input)
- **Severity**: high
- **Lens**: both
- **Category**: refetch storm / O(n) re-parse / input race
- **File**: src/components/modules/game-systems/AIBehaviorView.tsx:111-116 (handleUpdateScenario) → src/hooks/useCRUD.ts:75-84 (mutate auto-refetch) → src/lib/ai-testing-db.ts:239-243 (getTestingSummary)
- **Scenario**: A user types a scenario description, stimulus label, or expected-action field in `ScenarioCard`. Every `onChange` calls `onUpdate(...)` → `updateScenario` → `mutate(PUT)`.
- **Root cause**: `useCRUD.mutate` unconditionally `await refetch()` after every mutation, and there is no debounce on the text inputs (`AITestingSandbox.tsx:343,399,407,448,456,464` call `onUpdate` on each keystroke). Worse, `refetch` → GET `/api/ai-testing` runs `getAllSuites()` once for the suites payload and again *inside* `getTestingSummary()` (ai-testing-db.ts:240 calls `getAllSuites()` a second time), so each keystroke re-`SELECT *`s every suite + scenario row and `JSON.parse`s every `stimuli`/`expected_actions` blob **twice**.
- **Impact**: One round-trip + 2× full-table reads + 2× JSON.parse of all scenarios per character typed; the returned data also replaces the controlled `value`s mid-edit, causing cursor jumps and dropped characters on slower connections.
- **Effort**: 4 · **Value**: 8
- **Fix sketch**: Keep edits in local component state and flush on blur / debounced (e.g. 400ms) instead of per keystroke; and in `getTestingSummary` accept an already-fetched `suites` array (or have the GET handler call `getAllSuites()` once and derive the summary from it) so the refetch reads/parses the tables a single time.

## 2. `handleRunTests` / failure-reset loops issue N sequential PUTs, each triggering a full refetch
- **Severity**: high
- **Lens**: performance
- **Category**: N+1 mutations / refetch amplification
- **File**: src/components/modules/game-systems/AIBehaviorView.tsx:160-170 (handleRunTests) and 77-92 (testRunCli.onComplete failure reset)
- **Scenario**: User clicks "Run Tests" on a suite with N scenarios; or a CLI run dies and the failure path resets every running scenario.
- **Root cause**: Both loops call `updateScenario({ id, status })` once per scenario id. Each call is a separate PUT that — via `useCRUD.mutate` — awaits its own full `refetch()` (which, per finding #1, scans + parses all suites twice). For N scenarios this is N PUTs and 2N full-table reads, all for what is logically one state transition. The API already has a batch endpoint (`record-run-results`, route.ts:73-90) but the "mark running" path doesn't use anything equivalent.
- **Impact**: A 20-scenario suite generates ~20 PUTs and ~40 `getAllSuites` executions on a single button press; the UI is `await`-blocked through the whole cascade.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Add a `mark-running` (or generic bulk-status) action mirroring `record-run-results` that updates all ids in one request inside a transaction, then refetch once. Have the hook expose a batch mutator so both the run-start and failure-reset paths fire a single PUT.

## 3. Localization `full-pipeline` re-scans/re-filters the same corpus 5× per request
- **Severity**: high
- **Lens**: both
- **Category**: duplicated work / redundant passes
- **File**: src/app/api/localization-pipeline/route.ts:78-98 (full-pipeline) and 53-63 (translate)
- **Scenario**: "Run Full Pipeline" (the primary action of `LocalizationPipelineView`) hits this branch.
- **Root cause**: After one `scanForLocalizableStrings`, the route filters `translatable` (route.ts:81), then `translateBatch` filters the *same* `currentUsage !== nsloctext/loctext` predicate again internally (translation-engine.ts:139-141), then `generateLOCTEXTReplacements` filters it a third time (scan-engine.ts:294-295), and `generateStringTable` + `computeTranslationProgress` each re-iterate the full set. The `translate` action duplicates the route-level filter too. The single source of "translatable strings" is recomputed in 3-4 places.
- **Impact**: Several full O(n) passes over the string set on every pipeline run plus a redundant `.filter` allocation; logic is also fragile — the predicate is copy-pasted in three files and can drift (e.g. someone adds `string_table` to one filter but not the others).
- **Effort**: 3 · **Value**: 6
- **Fix sketch**: Compute `translatable` once in the route, pass it to `translateBatch` (drop its internal re-filter, or have it trust the caller), and feed the same array to replacements/tables/progress. Extract the predicate into one exported `isTranslatable(s)` helper so all call sites share it.

## 4. `validateTranslations` per-locale roll-up is O(locales × entries × findings)
- **Severity**: medium
- **Lens**: performance
- **Category**: nested filter in loop
- **File**: src/lib/localization/qa-engine.ts:252-266
- **Scenario**: QA pass over a translation batch (runs inside `translate`, `validate`, and `full-pipeline`).
- **Root cause**: The per-locale loop calls `entries.filter((e) => e.locale === locale)` and `findings.filter((f) => f.locale === locale)` *inside* the loop (qa-engine.ts:254-255). With L locales, E entries and F findings that is O(L·E + L·F). Entries are already `strings × locales`, so this is effectively quadratic in the configured locale count for a fixed corpus.
- **Impact**: Wasted re-scans of the full entries/findings arrays once per locale; grows with both corpus size and locale count (13 supported locales) on every pipeline run.
- **Effort**: 3 · **Value**: 5
- **Fix sketch**: Single pass — bucket entry counts and findings into `Map<locale, …>` once (incrementing counters / pushing into per-locale tallies), then build `byLocale` from the maps. Reduces to O(E + F).

## 5. `TranslationCard` does an O(n) `strings.find` per row, making the Translations list O(strings × entries)
- **Severity**: medium
- **Lens**: performance
- **Category**: missing lookup map / per-render linear scan
- **File**: src/components/modules/evaluator/LocalizationPipelineView.tsx:576-581 (and 189 search rebuild)
- **Scenario**: Viewing the Translations tab; entries = strings × locales, so the list can be hundreds of rows.
- **Root cause**: For every rendered entry the component runs `strings.find((s) => s.id === e.stringId)` (line 577) — a linear scan of all strings per row → O(strings × entries). Separately, the search path rebuilds `new Set(strings.filter(...).map(...))` on every keystroke inside `filteredEntries` (line 189) with no debounce, re-scanning all strings each character.
- **Impact**: Render and re-filter cost scales multiplicatively with corpus size; typing in the translations search re-scans the whole string array per keystroke while also re-running the O(n²) join on the result.
- **Effort**: 2 · **Value**: 5
- **Fix sketch**: Build a `useMemo(() => new Map(strings.map(s => [s.id, s])), [strings])` once and look up `byId.get(e.stringId)` in the row; reuse the same map for the search-match set. Optionally debounce `searchQuery`.
