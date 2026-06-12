# Blueprint Transpiler & C++ Codegen — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Editing the Module field inside the dry-run modal makes "Confirm write" overwrite files the user never saw diffed
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:569`
- **Scenario**: User clicks "Write to Project" → dry-run modal shows diffs for `Source/GameA/BP_Player.h/.cpp`. They notice the module is wrong, retype it in the Module input (lines 633-640) — which lives *inside* the dry-run modal — and click "Confirm write". `body(true)` serializes the *current* `moduleName`, so `applyWrite` writes into `Source/GameB/…` — a path whose on-disk contents were never diffed or shown.
- **Root cause**: The dry-run plan and the confirm request are built independently from live state (`body()` re-reads `moduleName` at call time); nothing invalidates the displayed plan when its inputs change. `applyWrite` (`src/lib/blueprint-transpiler-write.ts:72-78`) overwrites unconditionally.
- **Impact**: Silent overwrite of existing hand-written C++ in the new module path — the exact failure mode the dry-run gate exists to prevent. The approved diff is stale the moment the field changes.
- **Fix sketch**: On `moduleName` change while a plan is open, clear the plan (or auto re-run `dryRun`) and disable "Confirm write" until a fresh plan exists. Defense in depth: send the plan's resolved paths (or before-content hashes) with `confirm:true` and have the route reject on mismatch.

## 2. Parser silently discards macro graphs and every event graph after the first
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/blueprint-parser.ts:224-228`
- **Scenario**: A Blueprint export contains a second ubergraph page (UE5 "New Graph" → `EventGraph_1`) or any macro graph. `parseBlueprintJson` keeps only `graphs.filter(g => g.graphType === 'function')` plus the *first* event graph — everything else vanishes: not in the summary, not transpiled, not diffed, no warning anywhere.
- **Root cause**: `BlueprintAsset` models exactly one `eventGraph` and assumes macros don't exist; `parseGraph` even classifies `'macro'` correctly (line 199) only for the result to be dropped. Downstream codegen can never warn because the nodes are gone before it runs.
- **Impact**: Generated C++ is missing entire graphs of logic while the UI reports success ("N nodes, M functions" counts only what survived); Semantic Diff can report "in sync" against a Blueprint that has undiffed behavior.
- **Fix sketch**: Collect non-primary event graphs and macro graphs during parse and either merge extra event graphs' nodes into `eventGraph.nodes`, or surface them as a `droppedGraphs: string[]` field that the transpile route converts into a `warning`-severity `TranspileWarning` per graph.

## 3. Scalar/array JSON parses into a phantom "BP_Unknown" asset — success theater end to end
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/blueprint-parser.ts:212-231`
- **Scenario**: User pastes `[]`, `"some text"`, `123`, or an array-of-assets export into the Blueprint JSON box and clicks Transpile. `JSON.parse` succeeds, the value is cast to `RawBlueprintJson`, every property access returns `undefined`, and the parser "succeeds" with `BP_Unknown : AActor`, zero variables, zero nodes.
- **Root cause**: `parseBlueprintJson` validates only that the string is parseable JSON, not that the result is a plain object shaped like a Blueprint export (`typeof input === 'string' ? JSON.parse(input) : input as RawBlueprintJson` — no shape check). Only `null` happens to throw (property access on null).
- **Impact**: Wrong results presented as success: transpile emits an empty `ABP_Unknown` class the user can "Write to Project"; diff reports every real C++ member as DEL/"removed from Blueprint". No error tells the user their paste was the wrong shape.
- **Fix sketch**: After parse, require `data !== null && typeof data === 'object' && !Array.isArray(data)` and at least one of `ClassName`/`Nodes`/`Variables`/`Graphs`; otherwise throw "not a Blueprint JSON export" so the route returns 400 with a useful message.

## 4. UE5 source parser reads commented-out code as live values — first match shadows the real one
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/lib/ue5-source-parser.ts:146-160`
- **Scenario**: During tuning a dev leaves `// AbilityManaCost = 50.f;` above the live `AbilityManaCost = 20.f;` in `GA_Fireball.cpp`. `parseConstructor` runs `.match()` on the raw file content — no comment stripping — so the *first* (commented) occurrence wins and the UI shows mana cost 50. Same for `parseHeaderDefaults` (`:89`), `parseTags` (`:62-77`, resurrecting deleted-but-commented tag defines), and the `AddTag` scans.
- **Root cause**: Unlike `cpp-semantic-parser.ts` (which has `stripComments`), this module assumes source files contain no commented-out code — false for any file under active tuning. Single-shot `.match()` makes the bug deterministic: earliest occurrence wins regardless of being dead text.
- **Impact**: Wrong ability stats/tags displayed (and fed to whatever consumes `ParsedUE5Data`) with no error; the values look authoritative because they came "from the source".
- **Fix sketch**: Strip `//` and `/* */` comments (reuse/extract the `stripComments` helper from `cpp-semantic-parser.ts`) before running any of the regex extraction in `parseTags`, `parseHeaderDefaults`, `parseClassDescription`, and `parseConstructor`.

## 5. View handlers re-throw hook errors into the void — unhandled rejections; clipboard copy can fail silently
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:84-104`
- **Scenario**: User clicks Transpile with malformed JSON. `useBlueprintTranspiler.parse` sets the error state *and re-throws* (`useBlueprintTranspiler.ts:58`); `handleTranspile`/`handleDiff` `await` it with no catch inside an onClick, producing an `unhandledrejection` (red dev overlay in Next.js, error-telemetry noise in prod). Separately, `copyToClipboard` awaits `navigator.clipboard.writeText` uncaught — on a non-secure origin (LAN http) it rejects, the user gets no "Copied" *and* no failure feedback.
- **Root cause**: The hook's throw-after-setState contract assumes callers catch; the view assumes the hook handles everything. Nobody owns the rejection.
- **Impact**: Disruptive dev overlay on every bad paste; in production, console/telemetry noise; copy failures are fully silent (user pastes stale clipboard contents into their UE project).
- **Fix sketch**: Wrap the bodies of `handleTranspile`/`handleDiff` in try/catch that swallows (the hook's `error` state already drives the banner). Wrap `clipboard.writeText` in try/catch and show a brief "Copy failed" state on rejection.

## UI findings

## 6. Diff change cards are mouse-only — no keyboard expansion, no `aria-expanded`, and TermChip clicks toggle them by accident
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:500-519`
- **Scenario**: Keyboard user tabs through the Semantic Diff results: the card itself is an unreachable `<div onClick>` — the BP/C++ details and AI "Fix" suggestion can never be opened deliberately. Worse, the only focusable things inside (the ADD/MOD `TermChip` *buttons*) bubble their click to the card div, so activating a glossary chip *accidentally* expands/collapses the card.
- **Root cause**: Expansion is hung on a plain div with `cursor-pointer` instead of a button with `aria-expanded` (a convention 10+ other components in the app already follow), and chip clicks aren't `stopPropagation`'d.
- **Impact**: Core diff information (conflict details, suggested resolution) is inaccessible to keyboard/SR users, and pointer users get surprise toggles when inspecting badges.
- **Fix sketch**: Make the card header a `<button type="button" aria-expanded={expanded}>` (full-width, same styling), move `onClick` there, and `e.stopPropagation()` in the chip row. Chevron stays as the visual affordance.

## 7. Write-to-project dry-run dialog hand-rolls a modal instead of using the app's accessible `Modal` primitive
- **Severity**: High
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:624-677`
- **Scenario**: Opening the dry-run modal: focus stays on the trigger behind the backdrop, Tab cycles through the obscured page, Escape does nothing, and screen readers get no `role="dialog"`/`aria-modal`. Every other dialog in the app (via `src/components/ui/Modal.tsx`) has focus trap, initial focus, Esc-to-close, focus restore, and reduced-motion-aware animation.
- **Root cause**: A bespoke `fixed inset-0` overlay was written inline rather than composing the existing `Modal` shell, silently forking the app's dialog behavior.
- **Impact**: Keyboard users can't dismiss or reliably reach the destructive "Confirm write" flow; the dialog also pops in with no animation, visibly inconsistent with the rest of the app.
- **Fix sketch**: Replace the overlay div with `<Modal open={!!plan} onClose={() => setPlan(null)} title={…} icon={<Save/>}>` and keep the body/footer as children. Backdrop-close, Esc, focus trap, and aria wiring come for free.

## 8. Input-panel and accent-CTA markup duplicated across both panes (and the modal)
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:210-243`
- **Scenario**: The "Blueprint JSON" header + Load Sample button + mono textarea + char-count block appears nearly verbatim in `TranspilePane` (210-243) and twice in `DiffPane` (389-424); the inline-styled accent CTA (`backgroundColor: ACCENT+OPACITY_20, border: …OPACITY_30`) is copy-pasted at 234-242, 434-442, and 665-673.
- **Root cause**: No shared `CodeInputPanel`/`AccentButton` extraction; styling lives in repeated inline style objects rather than one component.
- **Impact**: The three instances have already drifted (`min-h-[160px]` vs `min-h-[140px]`, header with/without action slot); future tweaks (e.g. adding a paste-from-file button or fixing focus styles) must be applied 3x and will miss one.
- **Fix sketch**: Extract `CodeInputPanel({icon, title, action?, value, onChange, placeholder, minH})` and `AccentButton({icon, busy, children, ...})`; reuse in both panes and the modal footer.

## 9. One shared error banner leaks across tabs and is never announced to screen readers
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:248-252`
- **Scenario**: Transpile fails ("Failed to parse Blueprint JSON…"). User switches to the Semantic Diff tab — the same red banner is already sitting there (446-450) before they've run anything, implying the diff failed. The banner also appears/disappears with no `role="alert"`/`aria-live`, so SR users never hear async failures (a convention 10+ other modules already follow).
- **Root cause**: `useBlueprintTranspiler` exposes a single `error` string consumed by both panes; neither banner has live-region semantics.
- **Impact**: Misattributed errors erode trust in the tool's verdicts (especially next to diff results), and non-visual users miss failures entirely.
- **Fix sketch**: Clear `error` on tab switch (or track per-action errors in the hook: `parseError`/`transpileError`/`diffError`), and add `role="alert"` to both banner divs.

## 10. Textareas have no programmatic label — placeholder is the only name
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:223-229`
- **Scenario**: The visible "Blueprint JSON" / "Existing C++" headers are plain `<span>`s with no association to their textareas (223-229, 402-408, 417-423). Once content is pasted the placeholder disappears, leaving screen readers announcing an unnamed multiline edit field — in a view with two near-identical code boxes side by side.
- **Root cause**: Header and field are visually adjacent but not linked via `aria-label`/`htmlFor`; placeholder used as the de-facto label.
- **Impact**: SR users can't tell which box is the Blueprint input and which is the C++ input on the diff tab — easy to paste into the wrong one.
- **Fix sketch**: Add `aria-label="Blueprint JSON"` / `aria-label="Existing C++ header or source"` to each textarea (or `id` + `htmlFor` on the header spans). Folds neatly into the finding-8 `CodeInputPanel` extraction.
