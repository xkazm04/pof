# App Shell & Navigation — zen-perf scan
> Context: CLI Terminal & Module Shell / App Shell & Navigation
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Every CLI session mutation re-renders every L2 sidebar StatusBadge (and the whole tab bar / bottom panel)
- **Severity**: high
- **Lens**: performance
- **Category**: store subscription granularity
- **File**: src/components/layout/SidebarL2.tsx:371
- **Scenario**: While a CLI task streams tokens, `cliPanelStore` replaces the whole `sessions` object on each update (`updateSession` rebuilds the map — cliPanelStore.ts:159-162). `StatusBadge` subscribes via `useCLIPanelStore((s) => s.sessions)`, so *every* badge for *every* visible sub-module re-renders on every streamed chunk — and each one re-runs the full `Object.values(sessions)` scan in its `useMemo`. The same coarse `sessions` subscription is repeated in `CLIBottomPanel.tsx:9`, `CLITabBar.tsx:20`, and the `AppShell` beforeunload reads `getState().sessions` (fine there). With N visible modules and a busy terminal, this is N badge re-renders × M updates/sec.
- **Root cause**: Subscribing to the entire `sessions` record instead of deriving the one boolean each badge needs; no `useShallow` and no per-module selector.
- **Impact**: Visible jank in the sidebar during active CLI streaming; O(N·M) wasted renders + array scans in the always-mounted nav rail.
- **Effort**: 4 · **Value**: 7
- **Fix sketch**: Give the store a memo-friendly selector, e.g. `useCLIPanelStore(useShallow((s) => deriveStatusFor(s.sessions, moduleId)))` returning just `'failed' | 'running' | null`, or precompute a `Record<moduleId, status>` slice in the store and subscribe to `s.moduleStatus[moduleId]`. Same treatment for `CLIBottomPanel`'s `runningCount`.

## 2. GlobalSearchPanel rebuilds the entire FTS5 index on every open, and the index is rebuilt synchronously inside the request handler
- **Severity**: high
- **Lens**: both
- **Category**: redundant work / blocking I/O
- **File**: src/components/layout/GlobalSearchPanel.tsx:66
- **Scenario**: Opening the palette (Ctrl+K, or the TopBar Search trigger which synthesizes a Ctrl+K event) fires `handleRebuild(true)` on *every* open. `rebuildSearchIndex` (search-index.ts:46) does `DELETE FROM search_index` then re-inserts categories, every sub-module, every checklist item, every quick action, all feature definitions, all `feature_matrix` rows, all `eval_findings`, and 50 builds — inside one synchronous better-sqlite3 transaction on the request thread. So a keyboard shortcut triggers a full table wipe + hundreds of inserts before the user types anything.
- **Root cause**: "Ensure freshness" was implemented as "rebuild everything" with no staleness check or dirty flag; rebuild is a GET side effect (`/api/search?rebuild=1`).
- **Impact**: Hundreds of ms of blocking DB work + a transient empty index (a search fired during the open-rebuild window can return zero results); load scales with project size.
- **Effort**: 5 · **Value**: 7
- **Fix sketch**: Drop the rebuild-on-open. Rebuild lazily only when stale: compare `getLastRebuildTime()` against a content version / mtime and skip if fresh, or mark the index dirty on the few write paths (feature_matrix / eval_findings / build inserts) and rebuild only then. Keep the manual "Reindex" button for the force path.

## 3. ModuleRenderer keeps up to 5 heavy module trees permanently mounted, all subscribing to live stores while hidden
- **Severity**: medium
- **Lens**: both
- **Category**: keep-alive cost / SRP
- **File**: src/components/layout/ModuleRenderer.tsx:139
- **Scenario**: The LRU keeps 5 module panes (`LRU_CAP`) + 5 inline terminals mounted, hidden only via `display:none`. Suspension relies entirely on each child voluntarily using `useSuspendableSelector` / `useSuspendableEffect` (useSuspend.ts). Any module that calls a plain `useStore(selector)` or `useEffect` keeps re-rendering and running timers/polling while invisible, because `display:none` does not stop React renders or effects. The component also mixes three concerns in one render body: LRU bookkeeping (`lruTouched` mutating state during render, lines 162-173), switch-key animation tracking (180-186), and pane rendering.
- **Root cause**: Opt-in suspension (a context flag children must honor) rather than enforced isolation; LRU + animation + render responsibilities fused into one ~290-line component.
- **Impact**: Up to 4 hidden modules can keep polling/re-rendering; correctness of "suspend" depends on every module author remembering the hook. Hard to reason about which panes are truly idle.
- **Effort**: 6 · **Value**: 5
- **Fix sketch**: Extract LRU state into a `useModuleLru()` hook and the switch-key logic into `useSwitchKey()`, leaving `ModuleRenderer` as pure layout. Consider lowering `LRU_CAP` (e.g. 3) and/or adding a lightweight ESLint guard / wrapper that makes suspension the default for hidden panes rather than opt-in.

## 4. Module component map is fully static-imported — the entire module catalog ships in the shell's first JS chunk
- **Severity**: medium
- **Lens**: performance
- **Category**: code-splitting
- **File**: src/components/layout/ModuleRenderer.tsx:17
- **Scenario**: Lines 17-49 statically `import` ~35 view components (GenreModuleView, all content/game-systems/visual-gen/evaluator/game-director views, InlineTerminal). Because `MODULE_COMPONENTS` references them eagerly, every module's code — Blender pipeline, procedural engine, transpiler, asset viewer, etc. — is bundled into the chunk that loads with the shell, even though only one module is shown at a time and the page even defaults to `NewHome` (page.tsx:24), not this shell.
- **Root cause**: Eager `import` + a static registry object; the `Suspense` boundary at line 231 is already in place but has nothing lazy to await.
- **Impact**: Large initial bundle / parse cost for the legacy shell; the existing `<Suspense fallback={<ModuleSkeleton/>}>` wrapper does no work because nothing is split.
- **Effort**: 4 · **Value**: 5
- **Fix sketch**: Convert `MODULE_COMPONENTS` / `SPECIAL_CATEGORIES` entries to `React.lazy(() => import(...))` (or `next/dynamic`). The Suspense fallback already handles the loading frame; the LRU keep-alive keeps them mounted after first load so the split cost is paid once per module.

## 5. AppShell is a single component wiring 6 global hooks + 9 children, so any one hook's state change re-renders the whole shell subtree
- **Severity**: low
- **Lens**: both
- **Category**: provider/root re-render · SRP
- **File**: src/components/layout/AppShell.tsx:24
- **Scenario**: `AppShell` calls `useActivityFeedBridge`, `useKeyboardShortcuts`, `useFileWatcher`, `useDynamicTitle`, `usePofBridge`, plus `useProjectStore((s)=>s.isSetupComplete)` and `useReducedMotion`, and directly renders TopBar/Sidebar/ModuleRenderer/ActivityFeedPanel/CLIBottomPanel/etc. Any internal state these hooks expose (or any store slice they subscribe to and re-expose) re-renders this top node, and React then reconciles all 9 children. The children are not memoized, so the cost of an avoidable parent render fans out app-wide. Children themselves subscribe to their own slices, so the parent doesn't *need* to own much.
- **Root cause**: The shell doubles as both the side-effect host and the layout tree; effects and layout aren't separated.
- **Impact**: A re-render here is the most expensive in the app; today it's contained because the hooks mostly don't return changing state, but it's a latent cascade and an SRP smell.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Move the global side-effect hooks into a sibling `<ShellEffects/>` component that renders `null`, so their internal state can't re-render the layout tree; keep `AppShell` as pure structure. Optionally `memo` the static children.
