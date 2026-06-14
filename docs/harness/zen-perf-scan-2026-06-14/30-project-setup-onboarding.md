# Project Setup & Onboarding — zen-perf scan
> Context: UE5 Integration & Project Setup / Project Setup & Onboarding
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Two large panels (`UE5RemoteController`, `LiveCodingPanel`) are dead code — never mounted
- **Severity**: high
- **Lens**: architecture
- **Category**: dead code
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:605, src/components/modules/project-setup/LiveCodingPanel.tsx:96
- **Scenario**: Maintaining/reviewing the project-setup module; both files look load-bearing but render nowhere.
- **Root cause**: `ProjectSetupModule.tsx` (the only entry point for this module) imports `CreateProjectPanel`, `ProjectFilesPanel`, `BuildVerifyPanel`, `ToolingBootstrapPanel`, `ManifestPreview`, `StatusChecklist`, `NextStepBanner` — but never `UE5RemoteController` or `LiveCodingPanel`. A repo-wide grep for both symbols (and for any `import`/`import(` of those files) finds **zero** call sites; the only hits are doc-comments in `StatusDot.tsx`/`ConnectionStatusBadge.tsx`/`BridgeStatusIndicator.tsx`. There is no barrel `index.ts` re-exporting them either.
- **Impact**: ~790 + ~570 = ~1,360 lines of unreachable UI (4 sub-panels, framer-motion animations, polling logic, the `useLiveCoding` hook + its `/api/pof-bridge/*` polling, plus `pof-bridge`/`ue5-bridge` type surface) shipped, type-checked, and bundled while delivering nothing. It misleads every audit and refactor of this module and inflates the dependency graph (`framer-motion`, bridge types).
- **Effort**: 2 · **Value**: 8
- **Fix sketch**: Confirm with `git log`/feature flags that no route lazy-loads them. If truly orphaned, delete both files (and `useLiveCoding.ts` if it has no other consumer) or wire them into the module behind a tab. If they are "coming soon", move them out of the shipped tree (e.g. a `__wip__` folder excluded from the build) so audits stop treating them as live.

## 2. `useProjectScan` lists `<project>\Source` twice per scan (duplicate filesystem round-trip)
- **Severity**: high
- **Lens**: performance
- **Category**: repeated work
- **File**: src/components/modules/project-setup/useProjectScan.ts:154
- **Scenario**: Every scan of a real UE project (initial mount, every `onComplete` from setup/build/bootstrap CLI, and project switch) when a `Source/` folder exists.
- **Root cause**: The hook POSTs `action:'list'` for `` `${projectPath}\\Source` `` at line 154 to compute `hasBuildFiles`, then POSTs the **identical** request again at line 181 to enumerate `Source/*` for the `projectFiles` list. The two blocks were written independently; the second never reuses `sourceData` from the first.
- **Impact**: Doubles the most expensive part of the scan — a directory walk (`listSubdirectories` in `browse/route.ts` does `readdir` + a `findUProjectFiles` `readdir` per subdir). On a large `Source/` this is a real, repeated disk hit on the server, paid on every scan trigger and every project switch.
- **Effort**: 2 · **Value**: 6
- **Fix sketch**: List `Source` once into a local `sourceData`, derive `hasBuildFiles = sourceData.directories.length > 0`, and reuse the same response when building the `projectFiles` list. Collapses 4 sequential `list` calls per scan to 3.

## 3. `UE5RemoteController` connection poller has no unmount cleanup — `setInterval` leaks
- **Severity**: medium
- **Lens**: both
- **Category**: missing cleanup
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:648
- **Scenario**: User connects (starts the 5 s `setInterval` poll) then navigates away / unmounts the panel without clicking Disconnect.
- **Root cause**: `startPolling()` stores the interval in `pollRef`, but the only `clearInterval` calls are inside the Disconnect button handler (line 727) and at the top of `startPolling` itself. There is **no `useEffect(() => () => clearInterval(pollRef.current), [])`** unmount cleanup, so an unmounted-but-still-polling component keeps firing `fetchState` → `/api/ue5-bridge/query` every 5 s and calls `setConnState` on a dead component. (Also note `fetchState` is invoked via a render-time `if (!initDone.current)` side-effect at line 655 rather than an effect.)
- **Impact**: Leaked timer + background network calls after unmount; React "setState on unmounted component" noise. Currently latent because the component is never mounted (Finding #1) — but it becomes a live leak the moment it is wired in.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: Add `useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);`. Move the mount-time `fetchState()` into a `useEffect([])` instead of the render-body ref guard.

## 4. `recent-projects` save does a save → reload-list → (switch also) save-again fan-out
- **Severity**: medium
- **Lens**: both
- **Category**: redundant requests / coupling
- **File**: src/stores/projectStore.ts:169
- **Scenario**: Completing setup or switching projects (the core onboarding path).
- **Root cause**: `saveToRecent()` POSTs `action:'save'` then unconditionally fires `loadRecentProjects()` (a second GET) on every call. `completeSetup()` calls `saveToRecent()`; `switchProject()` calls `saveToRecent()` **and** `loadRecentProjects()` again at the end (line 261) — so a single switch can hit `/api/recent-projects` with save + GET (from saveToRecent) + touch + GET, two of which return the same list. The GET handler (`route.ts:27`) re-parses `checklist_json` and double-loops every row on each call.
- **Impact**: 3–4 sequential SQLite-backed HTTP round-trips per onboarding action where 2 would do; the recent-projects list is fetched twice per switch. Small data set today, but it is on the hot, user-visible path and the redundancy compounds with `setTimeout(scanProject, 200)` also queued.
- **Effort**: 3 · **Value**: 4
- **Fix sketch**: Have the `save`/`touch` API return the updated list (or the single upserted row) so the store can `set({ recentProjects })` directly instead of issuing a follow-up GET. Drop the duplicate `loadRecentProjects()` at the end of `switchProject` since `saveToRecent` already refreshed it.

## 5. `INVALID_CHARS_RE` redeclared on every `SetupWizard` render; validation regex run 2–3× per keystroke
- **Severity**: low
- **Lens**: performance
- **Category**: missing memoization
- **File**: src/components/modules/project-setup/SetupWizard.tsx:97
- **Scenario**: Typing a project name in "Start Fresh" mode.
- **Root cause**: `const INVALID_CHARS_RE = /.../;` is declared inside the component body (line 97), recreated each render. `nameValid` (line 98) runs `.test()` eagerly every render, and `nameError`'s `useMemo` (line 99) runs the same `.test()` again plus a `split('').filter()` scan. The regex is a stateless literal that never changes.
- **Impact**: Negligible CPU, but it is duplicated validation logic (`nameValid` and `nameError` independently re-derive the same condition) and a per-render allocation — a cheap clarity/SRP win, not a hot-path fix.
- **Effort**: 2 · **Value**: 2
- **Fix sketch**: Hoist `INVALID_CHARS_RE` to module scope (next to `UE_VERSIONS`). Derive `nameValid` from the memoized `nameError` (e.g. `const nameValid = newName.trim().length > 0 && !nameError`) so the regex runs once per keystroke and the two checks can't drift apart.
