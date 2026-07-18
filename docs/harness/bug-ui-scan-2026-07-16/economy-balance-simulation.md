# Economy & Balance Simulation — Bug + UI Scan

> Total: 9

## Bug findings

### 1. No re-entrancy guard on Run Simulation lets a stale response overwrite a newer one
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/evaluator/EconomySimulatorView/index.tsx:84 (root cause: src/stores/economySimulatorStore.ts:131)
- **Scenario**: A user double-clicks "Run Simulation" (or fires it via Enter + a trailing click, or a duplicated touch/pointer event) before React re-renders the `disabled` prop from `blockReason`. `handleRun` calls `runSimulation(config)` twice; the store's `runSimulation` sets `isSimulating: true` synchronously but never checks whether a run is already in flight before issuing the fetch.
- **Root cause**: `runSimulation` (economySimulatorStore.ts:131-157) has no `if (get().isSimulating) return null;` early exit, so two concurrent invocations both call `apiFetch('/api/economy-simulator', ...)`. Whichever network response resolves last wins, regardless of which request was issued first.
- **Impact**: The UI can end up displaying metrics/alerts/supplyDemand from an out-of-order response — e.g. the result for an older config replaces the result for the config the user most recently edited, with no indication that a race occurred.
- **Fix sketch**: Add an early `if (get().isSimulating) return null;` guard inside `runSimulation` (and mirror it in `generateCode`), or track a request-id/AbortController in the store and drop responses that aren't from the latest request.

### 2. Regenerating UE5 code can silently blank the code viewer
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:37,39-42,57
- **Scenario**: User generates code (5 files returned, selects file index 4), then clicks "Regenerate" after changing the simulation config; the new `codeGenResult` only has 3 files. `selectedFile` state is never reset by `handleGenerate` (lines 39-42).
- **Root cause**: `activeFile = codeGenResult?.files[selectedFile] ?? null` (line 57) resolves to `null` once `selectedFile` is out of range for the new file array, and no tab in the new tab strip matches `selectedFile === i`, so nothing highlights either.
- **Impact**: The code panel appears to have lost its content — no tab is selected and no `CodeViewer` renders — with no error message, making it look like regeneration failed even though it succeeded.
- **Fix sketch**: Reset `setSelectedFile(0)` inside `handleGenerate` right before/after `generateCode()` resolves successfully.

### 3. "Download All" can silently drop files due to browser multi-download throttling
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:44-55
- **Scenario**: `handleDownloadAll` synchronously loops over every generated file, creating an `<a>` and calling `.click()` for each in the same tick.
- **Root cause**: Chromium-based browsers throttle/block automatic multi-file downloads triggered without an intervening user gesture per file (some show a one-time "this site is trying to download multiple files" prompt; others just drop downloads past a small count). The code has no per-file delay, no user consent flow, and no verification that each download actually started.
- **Impact**: Clicking "All" can silently save only the first 1-3 files while the rest are dropped by the browser, and the user has no way to tell the download set is incomplete.
- **Fix sketch**: Either zip the files client-side/server-side into a single archive download, or space out the `.click()` calls with a small delay and detect/report blocked downloads (e.g. via the File System Access API when available).

### 4. Duplicate generated filenames would collapse file tabs via key collision
- **Severity**: Low
- **Category**: bug
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:129
- **Scenario**: If the code-gen backend ever emits two files with the same `filename` (e.g. a future template producing two `.h` variants before renaming), React's `key={file.filename}` on the tab list causes a key collision.
- **Root cause**: The tab list keys strictly off `filename` with no fallback to array index or a generated id, assuming server-side filenames are always unique.
- **Impact**: React will only reconcile/render one of the colliding tabs (typically the last), silently hiding a generated file from the UI even though it exists in `codeGenResult.files` and would be included in "Download All".
- **Fix sketch**: Key the tabs by `${file.filename}-${i}` (or an id field from the API) so duplicate filenames can't collapse distinct entries.

## UI findings

### 5. No visible keyboard-focus state on interactive controls
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:74-144
- **Scenario**: Tabbing through the header toggle, Generate/Regenerate, Download All, and each file tab.
- **Root cause**: Every interactive element defines `hover:` styles (e.g. `hover:bg-cyan-500/20`, `hover:text-text`) but none define a `focus-visible:` ring/outline, so mouse-hover and keyboard-focus are visually indistinguishable — keyboard users get no feedback on which control is focused.
- **Impact**: Keyboard-only users (and screen-magnifier users tabbing through controls) cannot tell which button/tab currently has focus, making the panel hard to operate without a mouse.
- **Fix sketch**: Add a shared `focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:outline-none` (or the design system's standard focus token) to each button/tab.

### 6. Truncated file description has no fallback to read the full text
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:153-156
- **Scenario**: A generated file's `description` is longer than the available width of the description bar above the code viewer.
- **Root cause**: The `<p className="... truncate">{activeFile.description}</p>` clips overflow with an ellipsis but sets no `title` attribute, so there is no native tooltip (or any other affordance) to reveal the rest of the text.
- **Impact**: Any description longer than the container is permanently and irrecoverably truncated for the user — information from the generator is lost from the UI.
- **Fix sketch**: Add `title={activeFile.description}` to the paragraph (cheap, no new component needed) so hovering reveals the full text.

### 7. Disabled-button UX is inconsistent between the two sibling panels
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:90-101 vs src/components/modules/evaluator/EconomySimulatorView/index.tsx:127-141
- **Scenario**: Comparing the "Run Simulation" button (wrapped in a `<span title={blockReason}>` so a disabled button still surfaces a tooltip explaining why) to the "Generate/Regenerate" button in the sibling code-gen panel, which has no equivalent explanation and is only ever disabled while `isGenerating` (a self-explanatory spinner state) — but the surrounding pattern in the same feature otherwise establishes "disabled controls should explain themselves."
- **Root cause**: The two panels were built with different disabled-state conventions even though they sit in the same view and are visually paired (one directly below the other).
- **Impact**: Minor pattern inconsistency within one screen; not currently harmful since Generate's only disabled reason is self-evident, but the convention silently breaks down as soon as another disabled condition is added to EconomyCodeGenPanel.
- **Fix sketch**: Reuse the same `<span title={...}>` wrapper convention on any future disabled condition added to the Generate button, to keep the two panels visually/behaviorally consistent.

### 8. File tab strip gives no affordance that it scrolls
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/EconomyCodeGenPanel.tsx:126
- **Scenario**: A code-gen result with many files (or long filenames) on a narrow viewport/panel width.
- **Root cause**: The tab row uses `overflow-x-auto` with no scroll-shadow/gradient fade at the edges and no scroll-snap, so offscreen tabs are invisible and give no visual hint that horizontal scrolling is possible.
- **Impact**: Users on narrower viewports may not discover that additional generated files exist beyond the visible tabs, effectively hiding files from view.
- **Fix sketch**: Add a subtle edge fade (`mask-image` gradient or a positioned shadow) when the strip is scrollable, matching the pattern likely already used elsewhere in the app for horizontally-scrolling tab strips.

### 9. "Critical/Warnings" stat card packs two numbers into one ambiguous value
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/evaluator/EconomySimulatorView/index.tsx:187-192
- **Scenario**: The stat card renders `${criticalAlerts}/${warningAlerts}` (e.g. "2/5") under the single label "Critical/Warnings", colored red only when `criticalAlerts > 0`.
- **Root cause**: Unlike the other three stat cards which show one clearly-labeled metric each, this card compresses two independent counts into one slash-separated string with only the card's overall color reacting to criticals — nothing visually distinguishes which number is which without reading the label text carefully.
- **Impact**: At a glance (the point of a stat-card row), it's easy to misread which half of "2/5" is critical vs warning, especially since the color doesn't change based on the warning count at all.
- **Fix sketch**: Split into two small inline badges (e.g. a red chip for criticals, amber chip for warnings) or add distinct color per number within the value string, consistent with how `AlertsSection` colors severities elsewhere.
