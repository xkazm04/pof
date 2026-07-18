# Project Setup & Onboarding — Bug + UI Scan

> Total: 10

**Context-map discrepancy**: `LiveCodingPanel.tsx`, `UE5RemoteController.tsx`, and `src/hooks/useLiveCoding.ts` are listed in the context map but no longer exist on `master` — they were deliberately removed in commit `fe7e2ff1` ("refactor(project-setup): delete never-mounted UE5RemoteController + LiveCodingPanel"). `PathBrowser.tsx` was refactored into a folder (`PathBrowser/index.tsx` + `usePathBrowser.ts` + `helpers.ts` + `types.ts`) — all four files were read in full. Live-coding/remote-control functionality now lives in `BridgeEndpointHealth/`, `LiveStateSyncPanel/`, `BidirectionalStateSyncPanel/`, `TestHarnessPanel/`, `src/hooks/useUE5Connection.ts`, and `src/lib/ue5-bridge/*` — outside this scan's declared scope, so not audited here. Findings below cover the 9 files/folders that do exist.

## Bug findings

### 1. `useProjectScan.scan()` has no re-entrancy guard — concurrent scans race and can leave the checklist stuck on stale data
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/modules/project-setup/useProjectScan.ts:53-197
- **Scenario**: `scan` is invoked from four independent triggers that can overlap: the path-change effect (`useProjectScan.ts:199-210`), the manual "re-scan" button (`onScan` in `StatusChecklist.tsx:125`), and three separate CLI `onComplete` callbacks in `ProjectSetupModule.tsx:30-52` (setup/build/bootstrap sessions) all calling `scanRef.current()`. If a user clicks "re-scan" while a bootstrap-triggered scan from a just-finished CLI session is still in flight (a realistic first-run sequence: install tools, then immediately hit re-scan), two `scan()` calls run concurrently.
- **Root cause**: `scan()` performs 2-4 sequential awaited fetches and unconditionally calls `setScanning(true)`/`setChecklist(items)`/`setScanState('settled')` at the end with no request token, generation counter, or `isScanning`-guard to reject a second concurrent invocation.
- **Impact**: Whichever call resolves last wins, regardless of which was started last. An older scan (e.g. one launched before a tool install completed) can finish after a newer one and overwrite the checklist with stale "tool missing" data, or vice-versa mask a real missing tool. Because `deriveNextStep()` (`nextStep.ts:30`) derives the single "do this next" CTA straight from `missingToolCount`/`hasProject`, this can point the user at the wrong action (e.g. suggesting "Create Project" over an already-created one, re-triggering the exact stale-checklist scaffold-over-existing-project bug the code comment at `useProjectScan.ts:46-50` says was already fixed once for the mount/unmount case).
- **Fix sketch**: Add a monotonically increasing generation/request id (or `AbortController`) captured at the start of `scan()`; before each `set*` call, compare against the latest id and no-op if stale. Alternatively gate re-entrancy with the existing `scanning` state (`if (scanning) return;` at the top of `scan`).

### 2. `usePathBrowser.browse()` has no request sequencing — fast navigation can display a directory listing that doesn't match `currentPath`
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/project-setup/PathBrowser/usePathBrowser.ts:34-53
- **Scenario**: User double-clicks a suggested directory, or clicks one detected project and then immediately another before the first `/api/filesystem/browse` (`action: 'list'}` round-trip resolves — plausible on a slow network drive or large directory. Both `browse()` calls are in flight; whichever HTTP response lands second wins.
- **Root cause**: `browse()` sets `currentPath`/`pathInput`/`directories` unconditionally from whatever response arrives, with no correlation between the request that was fired and the response being applied (no abort, no ignore-if-stale check).
- **Impact**: The visible directory listing can end up showing the contents of directory A while `currentPath`/`pathInput` (and thus the "Select This Directory" button target) reflects directory B, or vice versa — user selects a path they never actually navigated to, silently misconfiguring the first-run project path.
- **Fix sketch**: Track an incrementing request id or `AbortController` per `browse()` call; ignore/drop responses whose id doesn't match the latest dispatched request.

### 3. "Start Fresh" never checks whether the target folder already exists or is non-empty before committing the path
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/project-setup/SetupWizard.tsx:100-109
- **Scenario**: User types a project name that collides with an existing folder under `DEFAULT_PROJECTS_DIR` (e.g. a leftover empty folder from a previous aborted attempt, or a differently-cased duplicate on Windows' case-insensitive filesystem). `handleStartFresh` only validates the name against `INVALID_CHARS_RE`; it never calls the filesystem API to check if `${DEFAULT_PROJECTS_DIR}\\${name}` already contains files.
- **Root cause**: No existence/collision check is made before `setProject(...)` + `completeSetup()` commit the path and mark setup complete; `CreateProjectPanel` (downstream) then has Claude scaffold directly into that path.
- **Impact**: Silent scaffold-over-existing-content risk — a same-named leftover directory's contents could be mixed with or partially overwritten by the new scaffold, with no warning shown to the user at the point where it would still be cheap to rename.
- **Fix sketch**: Before `completeSetup()`, fire a `list` browse call (already available via `/api/filesystem/browse`) against the target path and, if it exists and is non-empty, show an inline warning/confirmation instead of proceeding silently.

### 4. `handleFixAllMissing` silently no-ops when the bootstrap-generation call disagrees with the checklist
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/project-setup/ProjectSetupModule.tsx:71-83
- **Scenario**: `ToolingBootstrapPanel`/`StatusChecklist`'s "Fix All Missing Tools" button is only rendered when `missingToolCount > 0` (stale-scan-derived). Clicking it calls `/api/filesystem/browse` with `action: 'generate-bootstrap'`; if that endpoint's own live check reports `data.allInstalled === true` (a real possibility right after the user manually installed a tool outside the app, or immediately after a bootstrap CLI session completed but before a rescan lands), the handler just `return`s.
- **Root cause**: The `if (data.allInstalled) return;` early-return gives no user feedback at all — no toast, no checklist refresh trigger, no re-enabling of the "next step" flow.
- **Impact**: User clicks a visibly-enabled, non-loading button and nothing happens; the button never shows its loading state (bootstrapCLI.sendPrompt is never called) so there's no indication the click was even received — reads as a broken button on the app's first-run screen.
- **Fix sketch**: On `allInstalled`, trigger a rescan (`scanRef.current()`) so the stale checklist/missingToolCount clears and the button disappears, and/or surface a brief inline "Already installed — rescanning" message.

### 5. Manifest import executes arbitrary pasted shell commands with a single click and no confirmation
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/project-setup/StatusChecklist.tsx:101-113
- **Scenario**: A user pastes a manifest JSON (e.g. shared by a teammate, or copy-pasted from an untrusted source/chat) containing a `tools[].installCommand` field. `handleImportManifest` builds a prompt embedding every `installCommand` verbatim and immediately calls `onBootstrapFromManifest(prompt)`, which sends it straight to the bootstrap CLI session — the only gate is JSON-shape validation (`Array.isArray(parsed.tools)`), not command content.
- **Root cause**: `jsonValidation` (StatusChecklist.tsx:73-94) validates structure only; there's no review/diff step showing exactly which commands will run before `handleImportManifest` fires them.
- **Impact**: A malicious or simply typo'd `installCommand` (e.g. `rd /s /q C:\` embedded as a "cleanup step") is passed straight through to an automated CLI executor with no user-visible confirmation of the actual command text — the UI only ever showed a count ("N tools detected... M to install"), never the commands themselves.
- **Fix sketch**: Before sending, render the resolved command list (the same `missing` string already built) in a confirm step so the user sees literal commands, not just a tool count, prior to execution.

## UI findings

### 6. `SetupWizard` (the app's actual first screen) uses a completely different design system from every other Project Setup panel
- **Severity**: High
- **Category**: ui
- **File**: src/components/modules/project-setup/SetupWizard.tsx:41-296
- **Scenario**: `SetupWizard` renders with `data-theme="blueprint"`, hand-rolled inline `style={{...}}` objects keyed off `--lab-*` CSS custom properties, and imports `Panel`/`Button`/`Input`/`Chip` from `@/components/layout-lab/ui` plus `labFontVars` from `@/components/layout-lab/fonts`. Every other file in this same folder (`CreateProjectPanel`, `BuildVerifyPanel`, `ToolingBootstrapPanel`, `ProjectFilesPanel`, `StatusChecklist`, `NextStepBanner`) uses Tailwind utility classes against the app's semantic tokens (`text-text-muted`, `bg-surface`, `SurfaceCard`, `@/components/ui/Button`).
- **Root cause**: `SetupWizard` appears to have been built against a separate "layout-lab" experimental design system that was never reconciled with the shipped semantic-token system used everywhere else in Project Setup (and, per repo conventions, the rest of the app).
- **Impact**: The very first thing a new user sees looks, animates, and is styled entirely differently from the screen they land on one click later (`ProjectSetupModule`) — a jarring identity break at the highest-stakes moment (first run), and a maintenance hazard since token/theme updates applied to `@/components/ui/*` won't reach this screen.
- **Fix sketch**: Port `SetupWizard` onto the shared `SurfaceCard`/`Button`/`Input` components and semantic Tailwind tokens used by the rest of the module, dropping the `layout-lab` dependency.

### 7. `PathBrowser` hardcodes raw hex colors instead of the semantic tokens it uses two lines away
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/project-setup/PathBrowser/index.tsx:57, 113-117
- **Scenario**: The outer container is `bg-[#0d0d24]` (line 57) and the "Installed Engines" list uses `text-[#3b82f6]`/`hover:bg-[#3b82f6]/5` (lines 113-117), while the "Suggested Locations" and "Detected UE Projects" lists immediately below use the app's semantic `text-accent-setup`/`hover:bg-accent-subtle` tokens for visually equivalent rows.
- **Root cause**: Copy-pasted/legacy styling for the engine-detection block was never migrated to the semantic tokens used by the sibling blocks in the same component.
- **Impact**: The engine list renders a different blue and a different panel background than every other row type in the same browser, and won't respond to any future theme/token changes (dark/light variant work, accent recoloring) the way the rest of the component will.
- **Fix sketch**: Replace `bg-[#0d0d24]` with the same surface token used by sibling panels (e.g. `bg-surface`) and `text-[#3b82f6]`/`hover:bg-[#3b82f6]/5` with `text-accent-setup`/`hover:bg-accent-subtle` to match the Suggested Locations/Detected Projects blocks directly below.

### 8. De-emphasized ("dimmed") panels remain fully interactive, contradicting their own visual signal
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/project-setup/ProjectSetupModule.tsx:117-119, 162-204
- **Scenario**: `dimUnless()` applies `opacity-50` to `CreateProjectPanel`/`BuildVerifyPanel`/`ToolingBootstrapPanel` whenever they're not the currently-suggested next step. The buttons inside those panels (`Create Project with Claude`, `Build & Verify Project`, `Fix All Missing Tools`) are not otherwise disabled by this wrapper — only their own internal `disabled` props (unrelated to `nextStep`) gate them.
- **Root cause**: The dimming is purely a CSS opacity treatment (`opacity-50 transition-opacity`) with no accompanying `pointer-events-none`/`aria-disabled`/`tabIndex={-1}` on the wrapped subtree.
- **Impact**: A panel visually says "not your priority right now" while its CTA is still fully clickable and keyboard-focusable — a user can act on a de-emphasized panel anyway, undercutting the module's stated design goal ("one calm thing to do next", per the `nextStep.ts` docblock) and creating a mismatch between visual affordance and actual interactivity, including for screen-reader/keyboard users who get no signal at all that the panel is secondary.
- **Fix sketch**: When `dimUnless` applies, also disable interaction on the wrapped subtree (`pointer-events-none` + `aria-hidden`/`inert`, or thread a `disabled` prop through to the panel's own button) so dimmed = actually inert.

### 9. Two differently-styled buttons perform the identical "fix missing tools" action simultaneously on screen
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/project-setup/StatusChecklist.tsx:190-205, src/components/modules/project-setup/ToolingBootstrapPanel.tsx:31-41
- **Scenario**: Whenever `missingToolCount > 0`, both the sidebar's "Fix {N} Missing" button (`StatusChecklist.tsx`, `size="sm"`) and the main panel's "Fix All Missing Tools" button (`ToolingBootstrapPanel.tsx`, default size) are visible at the same time, wired to the exact same `onFixAllMissing` handler.
- **Root cause**: The same action was implemented redundantly in two places (sidebar quick-action + main-panel panel) without consolidating into one canonical control once both are shown together.
- **Impact**: Visual redundancy directly contradicts the module's own "one calm thing to do next" design principle stated in `nextStep.ts`'s docblock, and wastes vertical space in the narrow 224px sidebar for a duplicate of an action already prominent in the main column.
- **Fix sketch**: Drop the sidebar "Fix {N} Missing" button (or replace it with a compact status link that scrolls to/highlights the main `ToolingBootstrapPanel` CTA) so there's a single actionable button for this step.

### 10. In-progress button labels in this module use ASCII "..." while the rest of the app has standardized on the Unicode ellipsis "…"
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/project-setup/CreateProjectPanel.tsx:42, src/components/modules/project-setup/BuildVerifyPanel.tsx:42, src/components/modules/project-setup/ToolingBootstrapPanel.tsx:37, src/components/modules/project-setup/StatusChecklist.tsx:198
- **Scenario**: `loadingLabel="Creating Project..."`, `"Building & Verifying..."`, `"Installing Tools..."`, and `"Installing..."` all use three literal periods.
- **Root cause**: Commit `a7a8d6f9` ("fix(ui-perfectionist/wave8): use ellipsis character for in-progress UI states") established the Unicode ellipsis "…" as the canonical convention for in-progress labels and applied it across 6 files including two other files in this very folder (`BlueprintInspector.tsx`, and the now-deleted `LiveCodingPanel.tsx`) — but never touched these four `loadingLabel` strings, which sit in the same module.
- **Impact**: Minor visual/typographic inconsistency within a single module — some in-progress labels use the correct typographic ellipsis, others don't, visible to anyone who compares the "Fix Tools" loading state against the (already-converted) equivalents elsewhere.
- **Fix sketch**: Replace `"..."` with `"…"` in the four `loadingLabel` strings listed above to match the established convention.
