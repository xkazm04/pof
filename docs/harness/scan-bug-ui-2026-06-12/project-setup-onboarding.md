# Project Setup & Onboarding — Bug + UI scan (2026-06-12)

> Total: 9 findings (4 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Project switch never re-scans: stale checklist drives a destructive "Create project" CTA against an existing project
- **Severity**: High
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/components/modules/project-setup/useProjectScan.ts:197-208`
- **Scenario**: User has the Project Setup module open for fresh Project A (no `.uproject` yet — banner says "Create project"). They switch to fully-built Project B via the recent-projects switcher (`switchProject`). `ModuleRenderer` keeps modules LRU-mounted and nothing is keyed by `projectPath`, so `ProjectSetupModule` stays mounted. The mount effect in `useProjectScan` is guarded by `initialScanDone.current` "exactly once for the component's lifetime", so although `scan`'s identity changes with the new `projectPath`, the effect early-returns and no rescan fires.
- **Root cause**: The once-per-lifetime ref guard (added for the StrictMode fix, SP-A Finding A) conflates "don't double-fire on remount" with "never react to a `projectPath` change". `hasProject`, `checklist`, `engines`, and `missingToolCount` all keep Project A's truth while the store already points at Project B.
- **Impact**: The NextStepBanner still shows "Create project"; clicking the CTA sends `buildCreateProjectPrompt({ projectName: B, projectPath: B })` — instructing the CLI to scaffold `.uproject`/`Source/`/GameMode over an **existing** project (potential file overwrite). Inverse direction shows "Build & Verify" for an empty folder. StatusChecklist also displays the old project's path/items until the user manually clicks Scan.
- **Fix sketch**: Track the scanned path instead of a boolean: `const scannedPath = useRef<string | null>(null); useEffect(() => { if (scannedPath.current === projectPath) return; scannedPath.current = projectPath; setTimeout(() => scan(), 0); }, [projectPath, scan]);` — still StrictMode-safe (ref compares value, not lifecycle), and rescans on every project switch.

## 2. "Start Fresh" hardcodes another user's home directory as the default projects path
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/project-setup/SetupWizard.tsx:16,91`
- **Scenario**: Any user whose Windows profile is not `C:\Users\kazda` runs first-time onboarding, types a project name, and clicks "Create & Launch". `DEFAULT_PROJECTS_DIR = 'C:\\Users\\kazda\\Documents\\Unreal Projects'` is baked into the wizard, so `projectPath` becomes a path under a foreign (almost certainly nonexistent) profile directory — and the helper text under the input proudly displays it.
- **Root cause**: The one-click wizard rewrite dropped the dynamic `getHomeDir()` lookup that the (now-orphaned) `PathBrowser` still uses, replacing it with a literal developer-machine path. No validation that the parent directory exists or is writable before `completeSetup()` persists it.
- **Impact**: On any other machine the scaffold prompt asks the CLI to create directories under `C:\Users\kazda\...` — which either fails (creating dirs under `C:\Users` needs elevation) or plants the project in a bogus location; the broken path is then persisted to `recent_projects` and localStorage. First-run onboarding is dead on arrival for every non-author user.
- **Fix sketch**: Resolve the default at runtime: call `/api/filesystem/browse` `{action:'list', path:'~'}` (as `PathBrowser.getHomeDir()` does) on wizard mount and build `<home>\Documents\Unreal Projects`; or add a `default-projects-dir` server action using `os.homedir()`. Validate existence via the existing `validate-path` action before `completeSetup`.

## 3. baffff5 merge regression: `project_progress` rows are now append-only — fresh setup at a reused path resurrects the old checklist forever
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/app/api/project-progress/route.ts:76-104` (with `src/stores/projectStore.ts:86-91`)
- **Scenario**: User creates fresh project "MyGame" (default path P), completes some checklist items (CLI and UI both write P's row), then the scaffold goes sideways — they remove it from recents (`removeRecentProject` deletes only the `recent_projects` row, not `project_progress`) and run the wizard's "Start Fresh" again with the same name → same path P. `completeSetup`'s new-project branch calls `saveModuleProgress(P)` intending to "save the (empty) initial state" — but the POST now merges, and keys the client doesn't send are preserved, so P's old completions survive verbatim.
- **Root cause**: Commit baffff5 changed the POST from overwrite to merge to protect CLI-completed items, but no compensating "replace"/"reset" mode was added, and nothing anywhere deletes a `project_progress` row (grep confirms: only SELECTs target the table outside the upsert). Every code path that previously relied on a full-snapshot save to reset a row — the fresh-project branch of `completeSetup` being the documented one — silently lost that ability.
- **Impact**: A re-created project starts life with stale "done" checklist items, wrong health/verification context after the next `loadModuleProgress`, and inflated `checklistDone` in recents (after the next `saveToRecent`). It also makes any cross-project contamination hit (known bug #1 from 2026-06-09) permanent: contaminated keys can never be flushed by a clean save. There is no self-heal path short of hand-editing SQLite.
- **Fix sketch**: Add a `mode: 'replace'` flag to the POST (skip the merge) and send it from `completeSetup`'s `isNewProject` branch; alternatively expose `DELETE /api/project-progress?path=` and call it on fresh setup and from `removeRecentProject`. Keep merge as the default for autosaves.

## 4. Pending debounced autosave fires across a project switch and merges the old project's checklist into the new project's row
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/services/ProjectModuleBridge.ts:70-81` (with `src/stores/projectStore.ts:203-262`)
- **Scenario**: User toggles a checklist item in Project A (schedules the 2 s `autoSaveLifecycle` timer) and immediately switches to Project B. `switchProject` awaits the explicit saves for A, then `set({ projectPath: B })`, then awaits `loadModuleProgress(B)`. The debounce timer is never disposed; when it fires it reads `projectStore.getState().projectPath` (now B) while `moduleStore` can still hold A's checklist (load fetch in flight) — POSTing A's full snapshot to B's `project_progress` row.
- **Root cause**: `switchProject` cancels terminal sessions and session logs but never calls `autoSaveLifecycle.dispose()`, and the timer callback resolves the project path at fire time instead of capture time. Pre-baffff5 the next clean full save of B overwrote the damage; the merge semantics now preserve A's injected `true` keys indefinitely (B's client snapshot never contains them, so they always win the "stored keys are preserved" branch).
- **Impact**: Cross-project checklist contamination through a new mechanism (timer, not store-reset — distinct from known bug #1), now durable: B permanently shows A's items as complete after the next load, inflating recents' progress counts and misleading module checklists. Window is small per switch (~the load round-trip) but every hit is irreversible given finding 3.
- **Fix sketch**: In `switchProject` (and `resetProject`), call `autoSaveLifecycle.dispose()` before mutating `projectPath`; additionally capture the target path when scheduling (`scheduleAutoSave(projectPath)`) so a stale timer can only ever write to the project it was scheduled for.

## UI findings

## 5. The wizard offers no manual browse / path-entry fallback — undetectable projects simply cannot be opened
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/project-setup/SetupWizard.tsx:215-240`
- **Scenario**: A user's project lives at e.g. `C:\Dev\Games\MyGame` (two levels below a drive root, not in Epic Launcher data, not in `Documents\Unreal Projects`). `detect-projects` scans launcher data, known folders, and drive roots one level deep — so the project is never found. The "Open Existing" tab shows "No UE 5.x projects found" whose only escape hatches are "Switch to <version>" and "Start fresh project". There is no way to type or browse to a path.
- **Root cause**: The one-click wizard rewrite removed the `PathBrowser` integration entirely (the component is now orphaned — zero imports project-wide) without keeping a minimal "browse manually" affordance, betting 100% on auto-detection.
- **Impact**: Onboarding hard-fails for any project in a non-standard location; the user's only recourse is moving their project on disk or editing localStorage. For a first-impression surface this is a functional dead end, not polish.
- **Fix sketch**: Add a "Browse for a project folder…" link in the empty state (and below the list) that opens the existing `PathBrowser` in a modal, or a simple path input that hits `browse {action:'list'}` and accepts any directory with a `.uproject`. Reusing `PathBrowser` also de-orphans already-built code.

## 6. Detection failure is rendered as a confident "No projects found" — silent error with no retry on the first screen
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/project-setup/SetupWizard.tsx:37-58,215-220`
- **Scenario**: The mount-time `detect-projects` fetch throws (server hiccup, the known unbounded-scan timeout, transient dev-server restart). The `catch` swallows it, `projects` stays `[]`, and the user is told "No UE 5.7 projects found" — an authoritative-sounding empty state that is actually an error state. There is no "Rescan" button anywhere in the wizard.
- **Root cause**: Error and empty results collapse into one code path; no `error` state variable exists in the wizard (unlike `PathBrowser`, which has an `ErrorBanner`), and the one-shot effect can never be re-triggered without a full page reload.
- **Impact**: Users with real projects are funneled toward "Start Fresh" (risking duplicate projects) because the app lied about why the list is empty. A transient failure becomes a wrong permanent-looking answer on the app's very first screen.
- **Fix sketch**: Track `error` separately from `projects`; on failure show the shared `ErrorBanner` plus a "Retry scan" button that re-invokes the loader (extract `load()` from the effect). Add the same retry affordance to the genuine empty state ("Rescan").

## 7. Wizard selection states are color-only and carry no semantics for assistive tech
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/project-setup/SetupWizard.tsx:122-172,177-181`
- **Scenario**: A screen-reader or keyboard user tabs through the three UE version pills and the Open Existing / Start Fresh tabs. Selected pills are announced identically to unselected ones (`aria-pressed` missing); the mode tabs are plain buttons (no `role="tab"`/`aria-selected`/`tablist`); the "Scanning for UE projects..." status is not in an `aria-live` region so the transition to results/empty is silent.
- **Root cause**: The wizard predates the a11y patterns the rest of the module already follows — `UE5RemoteController` ships proper `role="tab"`/`aria-selected`/`aria-controls`, and `LiveCodingPanel` uses `aria-live` status text — so this is an internal-consistency gap, not a missing house pattern.
- **Impact**: First-run flow is the single screen every user must pass; selected-version state (which gates which projects are even listed — see filter behavior) is invisible to AT users, and color-only selection also hurts low-vision users.
- **Fix sketch**: Add `aria-pressed={ueVersion === v.value}` to the pills, `role="tablist"`/`role="tab"`/`aria-selected` to the mode tabs (mirroring `TabButton` in UE5RemoteController), and wrap the loading/empty status line in `aria-live="polite"`.

## 8. Hot-patch pipeline visualization never advances — "Write" spins for the entire compile/verify
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/project-setup/LiveCodingPanel.tsx:222-285` (with `src/hooks/useLiveCoding.ts:150-179`)
- **Scenario**: User executes a hot-patch. `useLiveCoding.hotPatch` sets `patchPhase='writing_file'` and then awaits one POST that performs write → compile → verify → (revert) server-side. For the whole 30–120 s compile the four-step pipeline shows the "Write" step active with a spinner; it then jumps straight to the terminal phase. "Compile" and "Verify" are never shown in progress despite the UI promising step-level tracking.
- **Root cause**: The pipeline UI implies live phase streaming, but the data source is a single-shot request — only the initial and final `PofPatchPhase` values ever reach the component.
- **Impact**: Misleading progress ("it's stuck writing the file?") during the longest wait in the panel; users can't tell a slow compile from a hang, undermining trust in the otherwise polished step visualization.
- **Fix sketch**: Poll a phase/status endpoint during the patch (the bridge already exposes compile status polling — reuse `pollCompileStatus`-style GETs to advance `patchPhase`), or honestly degrade the UI to an indeterminate "Patching…" bar with elapsed time until per-phase data exists.

## 9. Icon-only and hover-revealed controls lack accessible names and focus reveal
- **Severity**: Low
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/project-setup/ProjectFilesPanel.tsx:50-60` (also `UE5RemoteController.tsx:695-700`, `JsonViewer` copy at `UE5RemoteController.tsx:98-108`)
- **Scenario**: The per-file copy button in ProjectFilesPanel sits at `opacity-30` and only reaches full opacity on row *hover* (`group-hover:`) — keyboard focus never restores it, so a tabbing user lands on a barely-visible control; it has only a `title`, no `aria-label`. The Remote Controller's settings toggle (Layers/X) and the JSON copy button have no accessible name at all, and the settings toggle doesn't expose `aria-expanded`.
- **Root cause**: Hover-only affordance pattern applied without a matching `focus-within`/`focus-visible` state, and icon buttons added without the `aria-label` discipline used elsewhere (e.g. LiveCodingPanel's labeled disclosure buttons).
- **Impact**: Keyboard users get near-invisible focus targets; screen-reader users hear "button" with no purpose for copy/settings actions across the setup surfaces.
- **Fix sketch**: Add `group-focus-within:opacity-100 focus-visible:opacity-100` alongside `group-hover:opacity-100`; give each icon button an `aria-label` ("Copy file path", "Connection settings", "Copy JSON") and `aria-expanded={showSettings}` on the settings toggle.
