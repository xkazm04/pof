# Blender MCP Integration — Bug + UI Scan

> Total: 10

## Bug findings

### 1. Connect action uses pre-hydration host/port, silently ignoring saved settings
- **Severity**: High
- **Category**: bug
- **File**: src/components/blender-mcp/BlenderConnectionBar.tsx:45-46
- **Scenario**: User previously saved a custom host (e.g. a remote machine's IP) via the settings panel, which persists `host`/`port` to `localStorage` under the `pof-blender-mcp` key (see `src/stores/blenderMCPStore.ts` partialize). On the next app load, `editHost`/`editPort` are initialized with `useState(host)` / `useState(String(port))` at first render — before zustand's `persist` middleware has rehydrated from `localStorage` (rehydration runs post-mount to avoid SSR mismatch). The component never re-syncs these fields to the store after hydration completes.
- **Root cause**: `useState(host)` / `useState(port)` capture the module's hardcoded defaults (`DEFAULT_BLENDER_HOST`/`DEFAULT_BLENDER_PORT`) once; there is no `useEffect` watching `host`/`port` to push the rehydrated persisted values into `editHost`/`editPort`.
- **Impact**: Both the "Connect" button (`handleConnect` → `connect(editHost, Number(editPort))`) and the settings panel display use the stale default instead of the user's saved value, so the app silently tries to connect to the wrong host/port on every fresh load until the user manually retypes and re-saves settings.
- **Fix sketch**: Add `useEffect(() => { setEditHost(host); setEditPort(String(port)); }, [host, port])`, or derive the input values directly from the store and only buffer edits in local state while `showSettings` is open.

### 2. Dependency edge counts/graph keyed by asset name, not path — collide on duplicate basenames
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/content/models/AssetInventory/useAssetInventory.ts:104-114 (also DependencyGraph.tsx:7-8, AssetCard.tsx:87)
- **Scenario**: A UE5 `Content/` tree commonly has assets with identical basenames in different folders (e.g. `M_Master` under two different subfolders, or auto-generated `T_0`/`SM_Cube` placeholders). The scan returns `relativePath`-unique assets, but `edgeCount` is accumulated by `e.from`/`e.to` (asset **name**), and `DependencyGraph` filters `dependencies` by `e.from === asset.name` / `e.to === asset.name`.
- **Root cause**: The dependency edge model and its consumers use the asset's display `name` as the join key instead of its unique `relativePath`, even though `relativePath` is already used as the React `key` and lookup key elsewhere in the same feature.
- **Impact**: Two differently-located assets sharing a name will have their inbound/outbound edge counts merged, and expanding either one's card renders a dependency graph containing edges that actually belong to the other asset — a wrong, misleading dependency visualization with no error surfaced.
- **Fix sketch**: Key `edgeCount` and the `DependencyGraph` filters by `relativePath` (requires the API's `AssetDependencyEdge.from`/`to` to also carry/resolve to relativePath, or build a name→relativePath disambiguation map when duplicates exist).

### 3. Rescan has no in-flight guard — concurrent requests can race and clobber state
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/models/AssetInventory/useAssetInventory.ts:37-58
- **Scenario**: User clicks "Rescan" twice quickly (e.g. impatient double-click, or clicks Rescan then Retry while an error is being cleared). Two `fetch('/api/filesystem/scan-assets', ...)` calls are in flight; whichever resolves last wins regardless of which was issued last.
- **Root cause**: `handleScan` has no `AbortController`/request-id guard to cancel a superseded request or ignore a stale response; `isScanning` blocks nothing since the button `disabled={isScanning}` only prevents a third click after the first `setIsScanning(true)` synchronously commits, but the two racing promises still both resolve into the same `setScanResult`/`setError`.
- **Impact**: An older, possibly-error response can overwrite a newer successful scan (or vice versa), showing the user stale or incorrect asset counts/errors without any indication a race occurred.
- **Fix sketch**: Track a monotonically increasing request token (or `AbortController`) in the hook; only apply a response if it corresponds to the most recently issued request.

### 4. New CLI session prompt dispatch is a fire-and-forget timer with no listener acknowledgment
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/content/models/ModelsView.tsx:53-61
- **Scenario**: `sendPrompt` creates a new CLI session then does `setTimeout(dispatch, 150)` before dispatching a `pof-cli-prompt` `CustomEvent` on `window`, assuming the new session's listener will be mounted and subscribed within 150ms.
- **Root cause**: The 150ms delay is an arbitrary guess at panel-mount latency; there is no ready/ack signal from the newly created CLI tab, and `window.dispatchEvent` is synchronous with no listeners registered yet if the guess is wrong (slow machine, heavy re-render, or many concurrently open sessions).
- **Impact**: On a slower render, the initial prompt is silently dropped — the user clicks a quick action, sees a new CLI tab open, but nothing is sent to it, with no error or retry.
- **Fix sketch**: Have the CLI session component dispatch a "ready" event (or resolve a promise/ref callback) once its listener is mounted, and queue/replay the prompt against that instead of a fixed timeout.

### 5. Empty/blank port field silently coerces to port 0
- **Severity**: Low
- **Category**: bug
- **File**: src/components/blender-mcp/BlenderConnectionBar.tsx:66, 71
- **Scenario**: User clears the port `<input type="number">` field (e.g. to retype it) and clicks "Connect" or "Save" before finishing.
- **Root cause**: `Number(editPort)` on an empty string evaluates to `0` (not `NaN`), so no validation branch catches it; `connect(editHost, 0)` / `setSettings(editHost, 0, autoConnect)` proceed with an invalid port.
- **Impact**: The app attempts (and persists) a connection to port `0`, producing an opaque low-level connection error instead of a clear "enter a valid port" message.
- **Fix sketch**: Validate `editPort` is a finite integer in the valid TCP port range before enabling Connect/Save; show inline validation state on the input otherwise.

## UI findings

### 6. Asset sort feature is fully built but never exposed in the UI
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/content/models/AssetInventory/useAssetInventory.ts:33-34, 116-125, 138-147 (consumed nowhere in index.tsx)
- **Scenario**: `useAssetInventory` maintains `sortKey`, `sortDir`, `toggleSort`, and `SortIcon` and returns them from the hook, but `AssetInventory/index.tsx` destructures only `displayAssets` (already sorted by the fixed default `name`/`asc`) and never renders any control that calls `toggleSort` or displays `SortIcon`.
- **Root cause**: The sort UI (e.g. column-header buttons or a sort dropdown) was never wired up after the sort logic was built — a "built but unwired" gap.
- **Impact**: Users cannot sort by size or modified date despite the underlying capability existing, and the filter/search bar area feels incomplete relative to what the state model supports.
- **Fix sketch**: Add a small sort control (e.g. chips or a `<select>`) above the asset grid in `index.tsx` that calls `toggleSort(key)` and renders `SortIcon` next to the active key, matching the existing `FilterChip` visual language.

### 7. Dependency Graph label ignores the per-type accent color system used everywhere else
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/models/AssetInventory/AssetCard.tsx:103
- **Scenario**: The expanded card header renders `<div className="text-xs text-cyan-500 ...">` for the "Dependency Graph" label, while every other visual element in the same card (icon background, border, glow, badge) is driven by `conf.color` from `TYPE_CONFIG`, which varies per asset type (mesh/texture/material/etc.).
- **Root cause**: A hardcoded Tailwind color class (`text-cyan-500`) was used instead of the component's own `conf.color` token already in scope.
- **Impact**: For any asset type whose accent isn't cyan, the expanded panel has an inconsistent, seemingly random color that doesn't match the card's theme — breaking the type-color association the rest of the grid relies on to scan assets quickly.
- **Fix sketch**: Replace the hardcoded class with an inline `style={{ color: conf.color }}` (or a Tailwind arbitrary value) consistent with the rest of the card.

### 8. Screenshot lightbox modal has no focus management
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/blender-mcp/ViewportPreview.tsx:159-186
- **Scenario**: Opening the lightbox (`role="dialog" aria-modal="true"`) via click or keyboard (Enter/Space on the stage) does not move focus into the dialog (e.g. to the close button), and closing it does not restore focus to the triggering element.
- **Root cause**: Only an `Escape` keydown listener is wired (lines 41-48); there is no focus trap, no initial-focus effect on open, and no focus restoration on close.
- **Impact**: Keyboard and screen-reader users who open the lightbox lose their place — focus remains on/near the now-covered thumbnail or stage behind the modal, and after closing there's no guarantee focus returns anywhere sensible, harming the exact users the `aria-*` attributes were added to support.
- **Fix sketch**: On `lightboxOpen` becoming true, `ref.current?.focus()` the close button (or dialog container with `tabIndex={-1}`); on close, refocus the element that had focus beforehand (store it in a ref before opening).

### 9. Settings toggle button gives no persistent active-state affordance
- **Severity**: Low
- **Category**: ui
- **File**: src/components/blender-mcp/BlenderConnectionBar.tsx:118-127
- **Scenario**: Clicking the gear icon expands the settings panel (`showSettings=true`), but the button's className is static (`hover:bg-surface-tertiary text-text-muted hover:text-text`) regardless of `showSettings`; only `aria-expanded` changes.
- **Root cause**: No conditional class (e.g. `showSettings ? 'bg-surface-tertiary text-text' : ...`) reflects the open state visually, unlike the Connect/Disconnect button which fully re-themes based on `connection.connected`.
- **Impact**: Sighted users have no glanceable indication the settings panel is currently open versus closed (especially once they scroll or the panel content blends with surrounding chrome), inconsistent with the state-forward styling pattern used elsewhere in the same file.
- **Fix sketch**: Add an active-state class keyed off `showSettings`, matching the treatment already given to the Connect/Disconnect button.

### 10. Bridge manifest freshness timestamp omits the date, misrepresenting staleness
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/content/models/AssetInventory/BridgeManifestCard.tsx:29
- **Scenario**: The card reads `Last updated {new Date(summary.generatedAt).toLocaleTimeString()}` — only a time-of-day (e.g. "Last updated 3:41:02 PM"). If the Blender bridge manifest is a day (or more) old, this still shows just a time with no date qualifier.
- **Root cause**: `toLocaleTimeString()` was used instead of a combined date+time (or relative "X hours/days ago") formatter.
- **Impact**: A stale manifest reads as freshly generated at a glance, which is exactly the kind of "success theater" that can mislead a user into trusting out-of-date bridge data during an asset review.
- **Fix sketch**: Use a relative-time formatter (e.g. "2 hours ago" / "Yesterday, 3:41 PM") or include the date whenever `generatedAt` isn't from today.
