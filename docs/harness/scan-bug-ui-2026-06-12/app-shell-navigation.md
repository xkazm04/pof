# App Shell & Navigation — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. "+" new-terminal tab creates a session that can never be displayed anywhere
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/layout/CLITabBar.tsx:116-125`
- **Scenario**: User clicks the "+" button in the CLI bottom bar. A "Terminal N" tab appears, but clicking it never shows a terminal. Worse: if an inline terminal was visible at the time, it vanishes (the new session steals `maximizedTabId`). Users can create up to 8 of these dead tabs.
- **Root cause**: `createSession({ label })` is called with no `moduleId`. The only render surface for terminal UI is `ModuleRenderer`'s inline pane, gated by `maximizedSession?.moduleId === activeModuleId` (ModuleRenderer.tsx:156-159). A session with `moduleId === undefined` can never satisfy that (activeModuleId is `string | null`, and `undefined !== null`). `CLIBottomPanel.handleTabClick` then can't navigate either (`if (session.moduleId)` is falsy), so clicking the tab is a no-op. The design assumes every session has an owning module; the "+" button violates that assumption.
- **Impact**: Success theater — the new-tab feature looks functional but produces permanently inaccessible terminals; it also hides the currently visible inline terminal, and Ctrl+J ("toggle maximized") appears broken because the maximized tab is invisible.
- **Fix sketch**: In `CLITabBar`, pass the current active module: `createSession({ label, moduleId: activeModuleId ?? undefined })`. Additionally, in `ModuleRenderer`, treat module-less sessions as "show inline under whatever is active" (`maximizedSession.moduleId == null || maximizedSession.moduleId === activeModuleId`), so orphans remain reachable.

## 2. Renaming a project rewrites `projectPath` to a directory that does not exist
- **Severity**: High
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/layout/TopBar.tsx:139-159`
- **Scenario**: Project "MyGame" lives at `C:\dev\MyGame` (folder name matches display name — the common case, since setup derives one from the other). User opens the project dropdown, renames it to "SuperGame". The stored path silently becomes `C:\dev\SuperGame`, which doesn't exist on disk.
- **Root cause**: `handleRenameConfirm` replaces the last path segment with the new name whenever it equals the old project name, but nothing ever renames the folder on disk (the delete flow even documents "Project files on disk are not deleted"). The assumption "display name tracks folder name" only holds if the app performed an fs rename — it never does.
- **Impact**: Every consumer of `projectPath` (CLI dispatch cwd, file watcher, `/api/filesystem/scan-project`, build runners) silently operates on a phantom directory; scans error or return empty, tasks fail. `saveToRecent()` then persists the corrupted path into SQLite, so the breakage survives restarts and infects the recent-projects switcher.
- **Fix sketch**: Stop deriving the path from the display name — rename should only touch `projectName`. If folder-rename is desired, make it an explicit action that calls a filesystem API, verifies success, and only then updates `projectPath`.

## 3. Out-of-order search responses overwrite newer results (no request sequencing)
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/layout/GlobalSearchPanel.tsx:86-100`
- **Scenario**: User opens the palette (which fires a synchronous full-index rebuild on the server, GlobalSearchPanel.tsx:66) and types "ch", pauses, then "checklist". The "ch" request — queued behind the rebuild — resolves last and replaces the already-rendered "checklist" results, also resetting `activeIndex` to 0 mid-keyboard-navigation.
- **Root cause**: The debounce only delays dispatch; once two fetches are in flight there is no sequence guard or abort. Whichever response lands last wins, regardless of which query it answered. The rebuild-on-every-open (mislabeled "first open") makes a slow first request likely, so the race is realistic, not theoretical.
- **Impact**: Wrong results displayed for the current query; Enter then navigates to a result the user wasn't looking at; `lastRebuilt` can also regress from a stale payload.
- **Fix sketch**: Keep a `requestSeqRef`; capture `const seq = ++requestSeqRef.current` before fetch and ignore the response unless `seq === requestSeqRef.current` (or pass an `AbortController` and abort the previous request in the cleanup).

## 4. Selecting a "Category" search result silently does nothing
- **Severity**: Medium
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/stores/navigationStore.ts:51-70`
- **Scenario**: User searches "content" (or any category name) in the global palette; category docs are indexed (`search-index.ts:61-64`) and rendered with their own Layers icon. User presses Enter on the "Content" category result → the palette closes and nothing navigates.
- **Root cause**: `GlobalSearchPanel.handleSelect` calls `navigateToModule('content')`. `navigateToModule` only handles the three special category ids and sub-module ids; for the four regular categories (`core-engine`, `content`, `game-systems`, `visual-gen`) `getCategoryForSubModule()` returns `undefined` and the function falls through without setting any state. Closing the panel afterwards makes it look like a successful action.
- **Impact**: Success theater for a whole result type — users assume search navigation is broken; categories are also excluded from the filter chips, so the type can't even be filtered out deliberately.
- **Fix sketch**: In `navigateToModule`, check `CATEGORY_MAP[moduleId]` and `set({ activeCategory: moduleId, activeSubModule: null })` for plain categories. Alternatively map category results to their first sub-module before navigating.

## 5. FTS5 highlight markers collide with literal "→" arrows in indexed content
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/lib/search-index.ts:213-214` (and `src/components/layout/GlobalSearchPanel.tsx:377-385`)
- **Scenario**: Many indexed titles/bodies contain literal arrows — e.g. the sub-module label `'BP → C++'` (module-registry.ts:965), checklist text "WASD → IA_Move", "Mixamo→UE5" (module-registry.ts:640,659; feature-definitions.ts:308). Search for "transpiler" or "retarget": the snippet comes back containing those literal arrows, and `highlightMarkers` converts every `→` into an opening `<mark>` with no matching close.
- **Root cause**: `snippet(search_index, …, '→', '←', …)` uses characters as highlight delimiters that legitimately occur in the corpus of a UE5 dev tool. The renderer cannot distinguish marker arrows from content arrows, producing unbalanced `<mark>` tags (highlight bleeds to end of line) and silently deleting the arrow glyph from displayed text ("BP → C++" renders as "BP " + highlighted "C++").
- **Impact**: Corrupted result rendering — wrong highlighting, missing characters — exactly on the kind of content this app indexes most.
- **Fix sketch**: Use non-printable markers, e.g. `snippet(…, '', '', …)`, and have `highlightMarkers` translate ``/`` after HTML-escaping. Literal arrows then pass through untouched.

## UI findings

## 6. CLI tab close "X" is a fake nested button — unreachable by keyboard
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/layout/CLITabBar.tsx:101-111`
- **Scenario**: A keyboard user tabs to a CLI session tab and wants to close it. The close affordance is an `<X role="button">` SVG nested *inside* the tab `<button>`: it has no `tabIndex`, no key handler, and sits at `opacity-30` until mouse hover — so it can neither be focused, activated, nor even seen via keyboard. The same hover-only reveal (without `focus-visible` parity) affects the recent-project remove button (TopBar.tsx:477-484), while EventCard (ActivityFeedPanel.tsx:469-484) does it correctly.
- **Root cause**: Interactive element nested inside another interactive element (invalid ARIA structure), plus a hover-reveal pattern applied without the `focus-visible:opacity-100` counterpart that the activity feed already established.
- **Impact**: Tabs cannot be closed without a mouse; screen readers announce a confusing composite control ("tab… Close… button" inside one tab).
- **Fix sketch**: Restructure each tab as a `group` wrapper containing two sibling buttons (select + close), mirroring the standard pattern; give close `focus-ring` and `focus-visible:opacity-100 focus-visible:scale-100`. Apply the same reveal classes to the ProjectRow remove button.

## 7. The shell's three overlay surfaces each do dialog semantics differently (none fully correct)
- **Severity**: High
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/layout/GlobalSearchPanel.tsx:170-176`
- **Scenario**: Open the search palette and press Tab a few times — focus escapes into the background app while the overlay covers it; on close, focus is dropped on `<body>`, not returned to the Search trigger. The activity-feed drawer (ActivityFeedPanel.tsx:271-281) declares `role="dialog" aria-modal="true"` but never moves or traps focus inside, so SR users have background content hidden while keyboard focus remains out there. Meanwhile the TopBar project dropdown hand-rolls a complete focus trap + Escape + focus-restore (TopBar.tsx:80-122).
- **Root cause**: No shared modal/focus-trap primitive in the chrome; each surface re-implements (or skips) trapping, initial focus, restore-on-close, and dialog roles independently. The search panel has no `role="dialog"`/`aria-modal`/`aria-label` at all.
- **Impact**: Keyboard and screen-reader users interact with invisible background UI; behavior differs surface-to-surface, and every future overlay will fork the pattern again. App-wide leverage: this is the shared chrome.
- **Fix sketch**: Extract a `useFocusTrap(ref, { restoreFocus, initialFocus })` hook (lift TopBar's working implementation) plus dialog props; apply to GlobalSearchPanel (add `role="dialog" aria-modal aria-label="Global search"`) and the activity-feed overlay drawer.

## 8. Activity feed shows raw module ids instead of human labels
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/layout/ActivityFeedPanel.tsx:323`
- **Scenario**: A grouped row reads "3 task complete events in arpg-combat" and event cards' meta row shows `arpg-combat` — internal slugs leak to the user, while the sidebar, search results, and error boundary all resolve the same ids to "Combat"-style labels via `MODULE_LABELS`.
- **Root cause**: `CollapsedGroup` uses `group.moduleId ?? ''` directly and `EventCard` renders `event.moduleId` raw (line 453); the `MODULE_LABELS` lookup used everywhere else (e.g., ModuleRenderer.tsx:64-67, search-index.ts:245) was skipped here.
- **Impact**: Inconsistent vocabulary in the most user-facing surface of the chrome; slugs like `arpg-gas` are cryptic to non-developers of this app.
- **Fix sketch**: Reuse the `moduleLabel(id)` helper (export it from `module-registry` alongside `MODULE_LABELS`) in both `CollapsedGroup` and `EventCard`; fall back to the id only when unknown.

## 9. Search trigger shows mac "⌘K" on Windows while its tooltip says "Ctrl+K"
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/layout/TopBar.tsx:670-672`
- **Scenario**: On this Windows-targeted app the TopBar search button renders a `⌘K` keycap, its `title` says "Search (Ctrl+K)", and the palette's empty state says "Ctrl+K" — three hints, two notations. The `<kbd>` chip itself is re-styled ad hoc in four places (TopBar.tsx:670, GlobalSearchPanel.tsx:192, 257, 288) with differing padding/background combinations.
- **Root cause**: Hardcoded mac glyph plus no shared `Kbd` primitive; each call site re-invents the chip. (The trigger also works by dispatching a synthetic `KeyboardEvent` to itself — TopBar.tsx:658-660 — instead of calling an `openSearch()` API, which is why the hint text and the behavior can drift apart.)
- **Impact**: Wrong platform affordance for the primary shortcut surface; visual drift between keycap chips in the same panel.
- **Fix sketch**: Add a tiny `<Kbd>` component with platform-aware modifier (`navigator.platform`-based "Ctrl"/"⌘") and reuse it in all four spots; expose search open/close via a store or context instead of a synthetic keydown.

## 10. Shared chrome bypasses the color-token system with one-off hex/Tailwind palette values
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/layout/GlobalSearchPanel.tsx:22`
- **Scenario**: The "Build" result type is colored with a hardcoded `'#94a3b8'` while every sibling type uses `chart-colors` tokens; `ModuleErrorBoundary` styles its error state with Tailwind `red-400`/`red-500/10`/`red-500/20` (lines 54-55, 61, 98) and TopBar's delete flow mixes `text-red-400` with `bg-status-red-subtle` tokens (lines 345-373); SidebarL2's plan button uses raw `blue-500/15`/`blue-400` (lines 236-239) where the app's semantic `STATUS_INFO` exists.
- **Root cause**: No enforced rule that shell chrome colors come from `chart-colors.ts` / CSS variables; one-off values accreted per component.
- **Impact**: Error-red and info-blue render in slightly different shades across the shell, and a future theme/palette change will miss these hardcoded spots — high leverage since this is the app-wide chrome.
- **Fix sketch**: Replace `'#94a3b8'` with a named token; swap `red-*` classes in ModuleErrorBoundary/TopBar for `STATUS_ERROR` + `status-red-*` utilities; use `STATUS_INFO` for the SidebarL2 plan button. Consider a lint rule banning hex literals in `components/layout`.
