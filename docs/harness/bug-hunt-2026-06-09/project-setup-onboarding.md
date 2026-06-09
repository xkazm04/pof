# Bug Hunt — Project Setup & Onboarding
> Total: 4
> Severity: 0 critical, 3 high, 1 medium, 0 low

## 1. Cross-project checklist contamination on fresh-project setup
- **Severity**: high
- **Category**: state-corruption
- **File**: src/stores/projectStore.ts:79-91 (completeSetup), 169-192 (saveToRecent)
- **Scenario**: A user has Project A open with a partly-completed checklist, opens the Setup Wizard, picks "Start Fresh" → `handleStartFresh` → `completeSetup()` runs for brand-new Project B. `completeSetup` calls `saveToRecent()` (which reads `getChecklistProgress()`) and then `saveModuleProgress(projectPath)` for the new path.
- **Root cause**: The `moduleStore.checklistProgress` is never cleared when the active project changes. `resetProject()` and `completeSetup()` reset `projectStore` fields but leave the moduleStore holding Project A's live checklist/health/history. So `getChecklistProgress()` returns Project A's data, which is written into Project B's `recent_projects.checklist_json`, and `saveModuleProgress(B)` persists Project A's full progress map under Project B's path in SQLite. The persisted `pof-modules` localStorage (`checklistProgress`, `moduleHealth`, `moduleHistory`) is shared globally with no project key, so the contamination is durable.
- **Impact**: corruption — a freshly created project inherits another project's "done" checklist items, health scores, and task history; recent-projects shows a wrong `checklistDone/Total`; the false "already complete" state can cause the next-step engine and any code-gen gating to skip real setup work.
- **Fix sketch**: Make project switching the single source of truth for module state. In `completeSetup` (fresh branch) and `resetProject`, clear moduleStore (`checklistProgress`/`moduleHealth`/`checklistVerification`/`moduleHistory` → `{}`) *before* `saveToRecent`/`saveModuleProgress`, and have `loadModuleProgress` always overwrite (not merge) so an empty DB row yields an empty store. Better: key the persisted `pof-modules` state by `projectPath` so two projects can never share one map.

## 2. UE5 Remote Controller leaks its polling interval and writes state after unmount
- **Severity**: high
- **Category**: resource-leak
- **File**: src/components/modules/project-setup/UE5RemoteController.tsx:615-658, 648-651, 717
- **Scenario**: User opens the Remote Controller, clicks Connect (`onClick={() => { connect(); startPolling(); }}`) which starts `setInterval(fetchState, 5000)`, then navigates to another module so the component unmounts (the module shell suspends/unmounts panels). The interval keeps firing.
- **Root cause**: `pollRef` is only cleared inside the Disconnect handler. There is no `useEffect(() => () => clearInterval(pollRef.current), [])` unmount cleanup. The interval survives unmount and every 5s calls `fetchState()` → `tryApiFetch` → `setConnState(...)` on an unmounted component. Because `pollRef` lives on the unmounted instance, it can never be cleared again — it leaks for the page's lifetime, and each remount that connects spawns another orphaned interval.
- **Impact**: resource leak + UX degradation — accumulating intervals hammer `/api/ue5-bridge/query` forever (battery/CPU/network), React "setState on unmounted component" warnings, and a thundering-herd of poll requests after repeated connect/navigate cycles.
- **Fix sketch**: Add a mount-scoped cleanup `useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, [])`, and guard `fetchState`/`connect` state writes with a `mountedRef` (as `useLiveCoding` already does). Make this class impossible by moving polling into a `useEffect` keyed on `isConnected` so React owns the interval lifecycle instead of imperative button handlers.

## 3. "Detect projects" performs an unbounded whole-machine scan that blocks the wizard
- **Severity**: medium
- **Category**: silent-failure
- **File**: src/app/api/filesystem/browse/route.ts:371-443 (scanForProjects), 394-406, 418-432
- **Scenario**: The Setup Wizard calls `detect-projects` on every mount (`SetupWizard` useEffect, `PathBrowser` init). On a machine with several large drives, `scanForProjects` adds *every* drive root (`C:\`, `D:\`, …) plus every detected engine dir as a candidate, then `readdir`s each root and `Promise.all`s `findUProjectFiles` over *every* top-level folder on *every* drive, plus `readEngineVersion` + `validateUEProject` per hit.
- **Root cause**: The scan has no time budget, no result cap, no concurrency limit, and no caching across mounts. Drive roots commonly contain hundreds of top-level folders (Program Files, Windows, node_modules-laden dev trees), so the fan-out is huge and unbounded; on network/removable drives a single slow `readdir` stalls the whole `Promise.all`. The wizard sits on its "Scanning for UE projects..." spinner with no timeout fallback (`catch` only swallows hard errors, not slowness).
- **Impact**: UX degradation — first-run onboarding can hang for many seconds to minutes; on a slow/disconnected mapped drive it can appear to hang indefinitely, and because the result isn't cached every wizard/PathBrowser mount repeats the full scan.
- **Fix sketch**: Bound the scan: cap total candidates and matches, add a per-`readdir` timeout (`Promise.race`), skip system folders (`Windows`, `Program Files`, `$Recycle.Bin`) and non-fixed drive types, run with a small concurrency pool, and memoize the result for N seconds server-side. Surface a "scan timed out — browse manually" path so the UI never blocks on filesystem latency.

## 4. Engine auto-detection sets an unsupported `ueVersion`, hiding all projects and persisting bad state
- **Severity**: high
- **Category**: logic-error
- **File**: src/components/modules/project-setup/PathBrowser.tsx:143-147, 234-240; src/components/modules/project-setup/SetupWizard.tsx:60-65, 10-14
- **Scenario**: On a machine with UE 5.4 (or a source build whose `Build.version` reports e.g. `5.4.2`, or `EngineAssociation` is a GUID), `PathBrowser` auto-fires `onEngineDetected(engines[0].version)` which calls `setProject({ ueVersion: "5.4.2" })`. The wizard then derives `selectedMajorMinor = "5.4"` and filters detected projects with `engineVersion.startsWith("5.4")`.
- **Root cause**: `ueVersion` is treated as a free-form string but the rest of the flow assumes it is one of the three canonical `UE_VERSIONS` values (5.5/5.6/5.7). A detected version outside that set is accepted verbatim with no validation/clamping. No version pill matches (`ueVersion === v.value` is false for all), the project list filter excludes everything that *is* installed for that engine, and `completeSetup` then writes the unsupported `ueVersion` into `recent_projects` and persisted store state.
- **Impact**: UX degradation + corruption — valid existing projects vanish from the "Open Existing" list (user believes none exist), the version selector shows nothing selected, and downstream prompts/build commands that branch on `ueVersion` (e.g. AI-coverage hint, web-search fallback) get a value they don't recognize; the bad version persists across sessions.
- **Fix sketch**: Normalize detected engine versions to a supported `major.minor` before storing (`clampToSupportedVersion(detected) ?? nearest`), and validate `ueVersion` at the trust boundary in `setProject` so only canonical values are ever persisted. When no supported match exists, show an explicit "UE 5.4 detected — not officially supported" state instead of silently filtering everything out.
