# Crash Analysis & Pattern Library — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Whole-word fix killed multi-word trigger keywords — anti-pattern guardrail silently dead for several approaches
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure (regression introduced by commit 25d6de5)
- **File**: `src/lib/pattern-library-db.ts:644` + `src/lib/pattern-extractor.ts:314`
- **Scenario**: `extractTriggerKeywords` always seeds the anti-pattern's keywords with the raw `APPROACH_KEYWORDS` phrases — many of which are multi-word: `'state machine'`, `'state graph'`, `'behavior tree'`, `'base class'`, `'data table'`, `'data asset'`, `'curve table'`, `'montage section'`, `'anim notify'`, `'add component'`. The new matcher tokenizes the prompt into single words (`promptWords = new Set(lower.split(/[^a-z0-9]+/))`) and tests `promptWords.has(kw)` — a Set of single tokens can never contain a two-word string. For a mined `state-machine` anti-pattern the keyword list is `['state machine','fsm','transition','state graph','behavior tree', …]`: the textbook prompt "Implement a state machine for dialogue with transitions" matches **zero** keywords ('transitions' ≠ 'transition' under exact whole-word match, the phrases can't match at all), so with the new `matchedKeywords.length < 2` floor no warning ever fires. Same for `montage-based` (only 'montage'/'playmontageandwait' are matchable → max 1 hit) and `data-driven`. The existing test even demonstrates the dead weight: its prompt contains "base class" verbatim, yet matchScore is 50 (2/4) instead of 75 because the phrase keyword can't count — and the dead phrases still inflate the `matchScore` denominator for every anti-pattern.
- **Root cause**: The fix tokenized only one side of the comparison. The comment in `extractTriggerKeywords` claims "Tokenize the same way the matcher does … so mined keywords are clean whole words that can actually match", but the approach-keyword seeding loop (`pattern-extractor.ts:314-319`) adds the raw phrases untokenized, and the matcher has no n-gram/phrase path and no stemming (plural forms miss).
- **Impact**: Structural false negatives — the guardrail the 06-09 fix was meant to make trustworthy now silently never fires for state-machine, montage-based, and data-driven anti-patterns (and under-scores all others), so users walk into approaches with mined 70–95% failure rates with no warning. Nothing logs the suppression.
- **Fix sketch**: When matching, split each trigger keyword on the same `[^a-z0-9]+` tokenizer: single-token keywords use `promptWords.has`, multi-token keywords match if all their tokens appear (or via an anchored `\b…\b` regex on the raw prompt). Alternatively tokenize phrases at mining time (store `'state'`,`'machine'` as a phrase entry). Add light stemming (strip trailing 's') and exclude never-matchable entries from the matchScore denominator. Add a regression test: a state-machine prompt must trigger the state-machine anti-pattern.

## 2. Imported real-project crash logs invert game/engine frame detection and blame the AI module via `KERNELBASE!RaiseException`
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case / wrong-results
- **File**: `src/lib/crash-analyzer/analysis-engine.ts:278` (+ `:29` MODULE_MAP)
- **Scenario**: `parseCrashLog` classifies a frame as game code with `isGame = moduleName.includes('MyGame') || !moduleName.includes('UnrealEditor-')`. Import a genuine crash log from any real project (module `UnrealEditor-ARPG`, not the sample's `MyGame`): every actual game frame contains `UnrealEditor-` and lacks `MyGame`, so `isGameCode = false`; meanwhile every OS/CRT/driver frame (`KERNELBASE`, `ntdll`, `MSVCP140`, `nvgpucomp64`) is flagged `isGameCode = true`. Then `mapToModule` regex-scans those "game" frames: `KERNELBASE!RaiseException` — present in virtually every Windows SEH/assert crash — matches `/AI|BehaviorTree|…/i` via the `ai` substring in "R**ai**seException", so the crash is displayed as `mappedModule: 'arpg-ai'`.
- **Root cause**: The heuristic assumes the project is literally named "MyGame" and that anything non-engine is game code — exactly backwards for real logs; plus the unanchored 2-letter `/AI/i` pattern matches inside common OS function names (the same substring-vs-word failure class as prior finding #4).
- **Impact**: Wrong results in the only analysis the Import workflow performs: the crash row and detail panel blame the wrong module ('arpg-ai' for nearly any imported assert), culprit-frame detection can't find real game frames, and `FrameRow`/CrashTimeMachine highlight OS frames as "your code". Distinct from 06-09 findings #1 (persistence) and #2 (crashType ordering).
- **Fix sketch**: Treat `UnrealEditor-<X>` modules as game code when `<X>` is not a known engine module (or accept a configurable project-module name); explicitly classify a denylist (`ntdll`, `KERNELBASE`, `ucrtbase`, `MSVCP*`, GPU drivers) as non-game. Anchor MODULE_MAP's `/AI/` to word boundaries (`/\bAI\b|BehaviorTree|…/`).

## 3. Clearing search/filters leaves stale filtered patterns, and the Sort dropdown is inert in the default view
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-staleness
- **File**: `src/components/modules/evaluator/PatternLibraryView.tsx:101-106`
- **Scenario**: Type "GAS" in the Pattern Library search → debounced `searchPatterns()` replaces `patterns` with the filtered set. Now clear the input (or unset the last filter): the effect's guard `if (searchQuery || moduleFilter || categoryFilter)` is false, so no fetch runs — the list keeps showing the old "GAS" subset indefinitely (stats above still say e.g. "34 Patterns" while 3 rows render). Separately, changing Sort with no query/filter active re-runs the effect but the same guard skips the fetch, so the Sort dropdown visibly does nothing until a filter is set.
- **Root cause**: The effect only knows how to *apply* filters, not *clear* them — there is no else-branch restoring the unfiltered dashboard list, and `sortBy` participates in the dep array but not in the guard condition.
- **Impact**: Users see a silently wrong (stale, filtered) pattern list after clearing a search, and the sort control appears broken in the most common (unfiltered) state.
- **Fix sketch**: Add an else-branch: when all three filters are empty, debounce-call `searchPatterns()` anyway (empty params + sortBy is a valid query) or `fetchDashboard()`. Simplest: always run `searchPatterns()` in the effect and let empty params return the full sorted list.

## 4. Anti-pattern pre-dispatch check ships the full enriched prompt in a GET query string — large prompts 431 and the catch swallows it
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/stores/patternLibraryStore.ts:291` (+ `src/components/cli/AntiPatternWarning.tsx:53`)
- **Scenario**: `useModuleCLI` fires `checkPromptBeforeDispatch(prompt, …)` with the same enriched prompt it dispatches (task prompts built by `buildTaskPrompt` carry injected context/error-memory and can run many KB; URL-encoding inflates them further). The check issues `GET /api/pattern-library?action=check-prompt&prompt=<everything>`; past Node's ~16KB header limit the server answers 431, the bare `catch { return EMPTY_WARNINGS; }` swallows it, and the fire-and-forget caller logs nothing — so the guardrail is skipped precisely for the biggest, riskiest dispatches.
- **Root cause**: Prompt transported as a query parameter instead of a request body, combined with a catch-all that treats every failure as "no warnings".
- **Impact**: Silent guardrail bypass for long prompts; no telemetry that the check failed, so the gap is invisible.
- **Fix sketch**: Add a `check-prompt` action to the route's POST handler with `{ prompt, moduleId }` in the JSON body and switch both clients to it; log check failures (`logger.debug`) instead of silently returning empty.

## UI findings

## 5. Crash list rows and crash pattern cards are mouse-only clickable divs — keyboard users cannot open anything
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/evaluator/CrashAnalyzerView.tsx:422` (CrashListItem), `:756` (PatternCard), `:488` (close button)
- **Scenario**: Tab through the Crash Reports tab: every crash row is a `<div onClick … cursor-pointer>` with no `tabIndex`, `role`, or key handler — focus skips straight from the search input to the next tab. The detail panel, callstack, AI diagnosis, and fix prompt are unreachable by keyboard; same for expanding pattern cards. The detail panel's close button is icon-only (`XCircle`) with no `aria-label`.
- **Root cause**: Interactive cards built as divs instead of buttons. The sibling `PatternLibraryView.PatternCard` already demonstrates the correct in-app pattern (`<button className="w-full … text-left">` header).
- **Impact**: Core analyzer flow is unusable without a mouse (WCAG 2.1.1 failure); screen readers announce no actionable elements in the crash list.
- **Fix sketch**: Convert both card headers to `<button type="button" className="w-full text-left …">` (the PatternLibraryView pattern), add `aria-expanded` to the expandable pattern card and `aria-pressed`/selected semantics to list rows, and `aria-label="Close crash details"` on the X button.

## 6. PatternLibraryView double-pads and nests a second scroll region inside the evaluator tab container
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/evaluator/PatternLibraryView.tsx:118-120,276`
- **Scenario**: EvaluatorModule already wraps every tab in `px-6 py-5 overflow-y-auto` (`EvaluatorModule.tsx:132`). PatternLibraryView adds its own `px-6 pt-6 pb-4` header and `px-6 pb-6` content inside a `flex flex-col h-full` shell with its own `overflow-y-auto` — so its content sits ~48px from the edge while every sibling tab (Crash Analyzer, Deep Eval, …) sits at 24px, and scrolling happens in a nested inner scrollbar instead of the shared tab scroll.
- **Root cause**: The view was built as a self-contained full-height page and never adapted to the padded, scrolling tab container the other evaluator views rely on.
- **Impact**: Visibly misaligned gutters when switching between adjacent evaluator tabs, plus awkward nested-scrollbar behavior (wheel events captured by the inner region, header eats fixed height).
- **Fix sketch**: Drop the internal `px-6`/`h-full`/`overflow-y-auto` wrappers and lay the view out as `space-y-*` content like CrashAnalyzerView, letting EvaluatorModule own padding and scroll.

## 7. Three hand-rolled icon-select dropdowns beg for extraction; sibling search inputs disagree on radius and focus treatment
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/evaluator/PatternLibraryView.tsx:223-269` (+ `CrashAnalyzerView.tsx:260-266`)
- **Scenario**: Module, Category, and Sort are three byte-for-byte-identical `relative` wrappers (appearance-none select + left icon + right chevron, both `pointer-events-none`). Meanwhile the two sibling search inputs diverge: Pattern Library uses `rounded-lg … focus:border-violet-500/40`, Crash Analyzer uses `rounded-md … focus:ring-1 focus:ring-status-red-strong` — different corner radii and a different focus mechanism (border-tint vs ring) for the same control one tab apart.
- **Root cause**: No shared `IconSelect`/`SearchInput` primitive in `components/ui`, so each view re-implements and drifts.
- **Impact**: Inconsistent focus affordance across the evaluator (ring vs border is noticeable when keyboard-navigating), and every future filter copy-pastes 8 lines of boilerplate that can drift further.
- **Fix sketch**: Extract `<IconSelect icon={…} value onChange>{options}</IconSelect>` and a shared search-input class (keep per-view accent via a prop), then swap the three dropdowns and both search fields onto them.

## 8. Author Pattern modal can only file patterns under modules that already have patterns
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/PatternLibraryView.tsx:115,729-738`
- **Scenario**: The modal's Module dropdown is fed by `moduleIds = topModules.map(...)` — modules derived from *existing* dashboard patterns. On a fresh library it offers only the hardcoded `arpg-character` fallback; on a partially-mined library, the module you most want to hand-author for (one with zero mined patterns) is simply absent, so the user either can't proceed or mis-files the pattern under the wrong module.
- **Root cause**: Wrong data source — the dropdown reuses the *filter* population (modules with data) instead of the module registry that defines all valid `SubModuleId`s (`MODULE_LABELS`/`SUB_MODULES` already exist as the single owner per `pattern-extractor.ts:115`).
- **Impact**: Authoring — explicitly designed as the bootstrap path that "outranks mined entries" — is blocked or corrupted exactly in the empty/uncovered-module case it exists for.
- **Fix sketch**: Populate the modal's select from the module registry constant (label + id), independent of `topModules`; keep `topModules` only for the list-filter dropdown.

## 9. Import panel feedback: stale success message survives a failed import, and the failure renders far away at the top of the page
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/evaluator/CrashAnalyzerView.tsx:820-827,854-856` (+ `:174-181`)
- **Scenario**: Import a valid log → green "Imported crash crash-xyz…" appears beside the button. Now paste an unparseable log and click Import & Analyze: the request 400s, the store sets `error`, which renders in the generic error card at the very top of the view (above the stats bar, likely scrolled out of sight) — while the old green success message still sits next to the button, telling the user the import worked.
- **Root cause**: `importResult` is set on success but never cleared at the start of the next attempt or on failure, and the panel has no local error slot — errors only surface via the page-level banner.
- **Impact**: Success theater on failed imports; users retry-paste the same broken log or walk away believing it imported.
- **Fix sketch**: Clear `importResult` (and store `error`) at the top of `handleImport`; on failure render the store error inline beside the button in red; wrap the inline status in an `aria-live="polite"` region so the outcome is announced.
