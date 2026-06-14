# Blueprint Transpiler & C++ Codegen — zen-perf scan
> Context: UE5 Integration & Project Setup / Blueprint Transpiler & C++ Codegen
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Duplicated, diverged `generateEffectsCode` — the live copy emits a misleading `// Period:` line the canonical copy was fixed to drop
- **Severity**: high
- **Lens**: architecture
- **Category**: duplicated logic / dead code
- **File**: src/lib/gas-codegen.ts:119, src/components/modules/core-engine/sub_ability/blueprint/codegen.ts:14
- **Scenario**: A maintainer fixes a GAS codegen bug (or audits it) and edits whichever `generateEffectsCode` they find first. The two copies already disagree, so the fix lands in the wrong one.
- **Root cause**: There are TWO `generateEffectsCode` functions. `gas-codegen.ts:119` is the documented "canonical pure string builder", but the live GAS editor (`sub_ability/blueprint/index.tsx:17,61`) imports `generateEffectsCode` from the local `./codegen.ts`, which *re-exports* `generateAttributeSetHeader`/`generateTagsHeader` from `@/lib/gas-codegen` but defines its **own** `generateEffectsCode`. A repo-wide grep for `generateEffectsCode` (4 hits) shows the `gas-codegen.ts` export has **zero** importers — it is dead. The two bodies have already drifted: the live copy still has a stale `// Period: ${eff.cooldownSec}s` comment line (codegen.ts:23) that directly contradicts the careful 6-line warning 20 lines below it (codegen.ts:44-49) and the matching comment in the canonical copy (gas-codegen.ts:141-147), which explains that emitting cooldown as `Period` silently turns the effect into a repeating DoT tick.
- **Impact**: Dead code masquerading as the source of truth (it carries the authoritative doc comment), plus a self-contradicting generated artifact: the live `.cpp` preview prints `// Period: <n>s` immediately above a comment saying "emitting it as Period would turn the effect into a repeating DoT tick." A user copying that header gets mixed signals about the exact bug the comment warns against.
- **Effort**: 2 · **Value**: 7
- **Fix sketch**: Delete `generateEffectsCode` from `gas-codegen.ts` (keep it as the home for the two shared header builders) and have `codegen.ts` re-export the single implementation, OR move the one true `generateEffectsCode` into `gas-codegen.ts` and re-export it from `codegen.ts`. Either way, drop the stale `// Period:` line (codegen.ts:23) so only the correct cooldown comment survives.

## 2. `generateNodeLogic` follows exec edges by matching pin IDs against node IDs/pin *names* — graph traversal is both wrong and O(n²·pins)
- **Severity**: high
- **Lens**: both
- **Category**: incorrect logic / O(n^2) traversal
- **File**: src/lib/blueprint-cpp-codegen.ts:378, src/lib/blueprint-cpp-codegen.ts:345, src/lib/blueprint-cpp-codegen.ts:357
- **Scenario**: Transpiling any Blueprint whose exec chain spans more than one node (the bundled sample `TakeDamage`/BeginPlay graphs already do). The emitted function body silently loses statements past the first node, or wires the wrong successor.
- **Root cause**: `BlueprintPin.linkedTo` holds **pin IDs** (per the type comment in `types/blueprint.ts:8`), but the walker resolves successors with `graph.nodes.find((n) => n.id === nextId || n.pins.some((p) => p.name === nextId))` (line 378-379) — comparing a pin ID against a node ID, then falling back to comparing it against pin *names*. The Branch handler repeats the same incoherent match on `thenPin.linkedTo`/`elsePin.linkedTo` (lines 345 and 357: `p.name === id || n.id === id`). Because the parser never builds a pin-ID→node index (parsePin in `blueprint-parser.ts:144` doesn't even assign pin IDs), these matches only succeed by accident. Separately, each `walk()` does a full `graph.nodes.find` scanning every node and every pin per outgoing edge, so a linear chain of N nodes costs O(N²·pins).
- **Impact**: Generated `.cpp` bodies are unreliable for any multi-node graph — the core promised value of the transpiler. The O(n²·pins) scan also makes large graphs needlessly slow on the server route. The bug is masked today only because most node types fall through to `// TODO` comments.
- **Effort**: 5 · **Value**: 7
- **Fix sketch**: In `parseBlueprintJson`, assign stable pin IDs and build a `Map<pinId, nodeId>` (or `Map<nodeId, node>`) once. Resolve `linkedTo` pin IDs to their owning node via that map instead of `graph.nodes.find(...)`. Replace all three `n.id === id || p.name === id` matches with a single pin-ID lookup, turning the traversal into O(N+E).

## 3. `findJargonInText` does a full ~60-term `String.includes` sweep per warning line, re-run on every render
- **Severity**: medium
- **Lens**: performance
- **Category**: repeated work / missing memoization
- **File**: src/lib/blueprint-jargon.ts:349, src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:345
- **Scenario**: A transpile result with many warnings; each `<DecoratedJargon text={w.message} />` (line 345) decorates its text by scanning the full jargon dictionary, and the whole warnings list re-renders on any parent state change (tab switch, copy-feedback toggle, showCode toggle).
- **Root cause**: `findJargonInText` (the backing primitive for inline decoration) iterates every key in `ALL_JARGON` (UPROPERTY specifiers + macros + K2Node labels + conflict + change types ≈ 60 entries) and calls `text.includes(term)` for each — O(terms × textLen) per call. None of the warning rendering is memoized, and `BlueprintTranspilerView` keeps `copiedHeader`/`copiedSource`/`showCode` state at the top so unrelated toggles re-render the entire `TranspilePane`, including the warnings `StaggerContainer`.
- **Impact**: For a header with K warnings, every incidental re-render redoes K×60 substring scans plus the framer-motion `StaggerItem` work. Small in absolute terms but entirely repeated work on hot UI interactions (copy button flashes a 2-state toggle via `setTimeout`).
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Memoize the decorated warning rows (`useMemo` keyed on `result.warnings`), or have `DecoratedJargon` cache its parse per `text`. Cheaply, precompute a single regex alternation of all jargon terms once at module load and run one `text.match` instead of 60 `includes`.

## 4. `BlueprintTranspilerView` rebuilds style/config objects inline and lifts copy-feedback state to the top, forcing whole-pane re-renders
- **Severity**: medium
- **Lens**: performance
- **Category**: unnecessary re-renders
- **File**: src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:238, src/components/modules/game-systems/blueprint-transpiler/BlueprintTranspilerView.tsx:69
- **Scenario**: Typing in the Blueprint JSON `<textarea>` (line 227) updates `blueprintJson` on every keystroke; the parent re-renders both panes, and the large `<pre>` code block (line 332) plus every button re-evaluates its inline `style={{ backgroundColor: `${ACCENT}${OPACITY_20}`, ... }}` object.
- **Root cause**: `copiedHeader`, `copiedSource`, `showCode` and `activeTab` all live in the top-level `BlueprintTranspilerView` (lines 68-71), and `TranspilePane`/`DiffPane` are plain function components (not memoized) receiving fresh inline-object props each render. The transpile result `<pre>` re-mounts its full code string on unrelated state changes, and the copy-feedback `setTimeout` toggle (lines 102-103) re-renders the entire pane just to flip one icon.
- **Impact**: On large pasted Blueprints the per-keystroke re-render walks the whole output subtree (stats bar, code tabs, the big `<pre>`, warnings stagger). Noticeable input lag with multi-thousand-line C++ output held in `result.headerCode`/`sourceCode`.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Hoist the static style objects to module-level constants (they only depend on `ACCENT`/opacity tokens). Wrap `TranspilePane`/`DiffPane`/`ChangeCard` in `React.memo`. Keep copy-feedback state local to the output subtree (or the copy button) so a clipboard toast doesn't re-render the editor.

## 5. C++ header regexes use unbounded lazy character classes — backtracking risk and silent mis-parses on pasted source
- **Severity**: low
- **Lens**: performance
- **Category**: regex robustness
- **File**: src/lib/cpp-semantic-parser.ts:44, src/lib/cpp-semantic-parser.ts:50
- **Scenario**: A user pastes a real (large, formatted) `.h` into the Semantic Diff tab; `parseHeader` runs `PROPERTY_REGEX`/`UFUNCTION_REGEX` over each brace-matched class body.
- **Root cause**: `PROPERTY_REGEX` (line 44) uses `(\w[\w<>,\s*&]+?)\s+(\w+)` — a lazy class that includes whitespace and can span many tokens before the trailing `\s+(\w+)(?:=|;|{)`. On bodies that have a `UPROPERTY(...)` not immediately followed by a simple declaration, the engine backtracks across the whitespace-bearing class. `UFUNCTION_REGEX` (line 50) has the same `[\w<>,\s*&]*?` shape. Both run inside the per-class loop, so cost compounds with class count.
- **Impact**: Mostly latent (typical headers are small), but on adversarial or machine-generated input the lazy whitespace classes are a classic ReDoS-ish backtracking hazard, and the greedy/lazy boundary occasionally captures a multi-line "type" — feeding a wrong type into the diff's type-conflict check (`blueprint-semantic-diff.ts:57`) and producing a spurious `conflict`.
- **Effort**: 3 · **Value**: 3
- **Fix sketch**: Tighten the type capture to exclude newlines and bound repetition (e.g. `[\w:<>,*&]` without `\s`, plus a single optional space group), or parse the declaration line-by-line after the `UPROPERTY(...)`/`UFUNCTION(...)` anchor instead of one mega-regex. Add a guard test with a large pasted header.
