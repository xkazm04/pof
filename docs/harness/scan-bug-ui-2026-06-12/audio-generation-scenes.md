# Audio Generation & Scenes — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

## 1. Circular zones (and their attenuation glows) silently swallow emitter placement and zone drawing
- **Severity**: High
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/components/modules/content/audio/AudioScenePainter.tsx:115`
- **Scenario**: User paints a circular zone (VOL_RADIAL), switches to the EMITTER tool, and clicks inside the circle to place an ambient emitter. Nothing happens — no emitter, no error. Same for starting a new zone drag over any circle. Rect zones work fine.
- **Root cause**: `handleCanvasMouseDown` whitelists targets with `target !== svgRef.current && target.tagName !== 'rect'` (added so the grid-pattern `<rect>`s pass). Circle zone bodies, their attenuation-glow `<circle>`s (radius up to `attenuationRadius` — 200–3900 units, a huge dead area; the glow has no `pointerEvents: 'none'` unlike the emitter glow at line 729), and emitter bodies are `<circle>` elements, so the click is dropped. `handleZoneMouseDown` returns before `stopPropagation()` in non-select modes, so the event reaches the canvas handler but fails the tagName check. There is no workaround: dragging an emitter in from outside never recomputes `zoneId` (only `x`/`y` update in `handleMouseMove`), so an emitter can never become a child of a circular zone.
- **Impact**: Core painting interaction silently no-ops over large canvas regions; circular zones can never contain zoned emitters, which then degrades zone-emitter codegen and soundscape grouping.
- **Fix sketch**: In non-select paint modes, skip the target whitelist entirely (any mousedown on the canvas should draw/place); add `pointerEvents: 'none'` to zone attenuation-glow shapes. On emitter drag end, recompute `zoneId` via `findContainingZone` so drag-into-zone re-parents.

## 2. Event Catalog edits are silently wiped on every tab switch
- **Severity**: High
- **Lens**: bug
- **Category**: data-loss
- **File**: `src/components/modules/content/audio/AudioEventCatalog.tsx:113`
- **Scenario**: User spends time curating the catalog — adds custom events, renames triggers, tunes priorities/cooldowns/tags — then clicks "Scene Painter" to check a zone and returns to "Event Catalog". Every edit is gone; the list is back to the 13 hard-coded defaults.
- **Root cause**: `AudioView` mounts the catalog conditionally (`{activeTab === 'events' && <AudioEventCatalog …/>}`, AudioView.tsx:513), and the catalog holds all events in local `useState(() => structuredClone(DEFAULT_EVENTS))`. Unmount discards state; nothing is persisted (not in the scene doc, not localStorage, not lifted to the parent). The design assumes the user generates in one uninterrupted sitting on a single tab.
- **Impact**: Silent loss of all user configuration work; the generation prompt that was sent is also unreproducible afterwards.
- **Fix sketch**: Lift `events` state into `AudioView` (or a zustand slice) so it survives tab switches, or keep all tab panels mounted and toggle visibility. Better: persist the catalog on the audio scene document like zones/emitters.

## 3. The first zone in every scene gets `var(--text-muted)` as its color — hex-opacity concat renders it black/unstyled
- **Severity**: Medium
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/content/audio/AudioScenePainter.tsx:233`
- **Scenario**: User creates a fresh scene and draws their first zone. Instead of a translucent tinted region with a colored outline, the zone renders as a solid black shape with no stroke (and again for the 11th, 21st… zone as the palette wraps).
- **Root cause**: New zones take `color: Object.values(ZONE_COLORS)[zones.length % 10]`, and `ZONE_COLORS['none']` (index 0) is the literal string `'var(--text-muted)'` — the only non-hex entry in the map. Every consumer assumes hex and appends opacity digits: `fill={\`${zoneColor}10\`}` / `stroke={\`${zoneColor}60\`}` (lines 584–597, labels 640–648, minimap 469) produce `var(--text-muted)10`, an invalid SVG paint, so fill falls back to black and stroke to none. The same trap exists in `AudioEventCatalog.tsx:75` where `PRIORITY_CONFIG.low.color = 'var(--text-muted)'` is passed through `withOpacity()` (plain string concat per chart-colors.ts:180), silently dropping the active border/box-shadow on the "Low" priority button.
- **Impact**: Wrong/ugly rendering of the most common case (first zone of a new scene); zone color also disagrees between painter (black) and the soundscape/settings dots (gray, where the var works in inline `style`).
- **Fix sketch**: Replace `'var(--text-muted)'` entries with real hex values (e.g. `STATUS_MUTED` `#94a3b8`) in `ZONE_COLORS` and `PRIORITY_CONFIG`, or make `withOpacity`/the painter detect non-hex colors and skip suffixing. Start the new-zone palette at index 1 so 'none' is never auto-assigned.

## 4. CLI completion stamps `lastGeneratedAt` on whichever scene is active when the run finishes
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/content/audio/AudioView.tsx:86`
- **Scenario**: User clicks "Generate Audio System" on scene A (a multi-minute CLI run), then clicks scene B in the sidebar to keep working. When the CLI completes, scene B gets `lastGeneratedAt = now` written to the DB; scene A — the one actually generated — is never stamped.
- **Root cause**: `audioCli`'s `onComplete` closes over `activeDoc` and `useModuleCLI` keeps the *latest* callback in a ref (`onCompleteRef.current = opts.onComplete` on every render, useModuleCLI.ts:78), so at completion time `activeDoc` is whatever scene is currently selected. The id of the scene the generation was started for is never captured.
- **Impact**: State corruption of generation metadata — the header shows "Last generated <today>" on a scene that was never generated, while the real one looks stale; also fires a spurious PUT + refetch against the wrong row.
- **Fix sketch**: Capture the target scene id at dispatch time (e.g. a `generatingSceneIdRef.current = activeDoc.id` set in `handleGenerateAll`/`handleGenerateZoneCode`) and use that id in `onComplete` instead of `activeDoc.id`.

## 5. Deleting assets/sets removes DB rows only — files leak forever and failures are swallowed
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/audio-gen/route.ts:138`
- **Scenario**: User deletes a variation or a whole set from the Library. The DELETE handler removes the `audio_assets`/`audio_sets` rows (FK cascade) but never unlinks `~/.pof/audio/<setId>/<file>` — generated audio accumulates on disk with no cleanup path. Separately, if the DELETE request fails, `AudioLibraryPanel.handleDeleteAsset/-Set` (AudioLibraryPanel.tsx:91-99) `await apiFetch(...)` with no try/catch — an unhandled rejection, `refresh()` never runs, and the user sees the row still there with zero feedback (unlike the favorite toggle, which uses `tryApiFetch` + rollback).
- **Root cause**: Delete was implemented as a row-level operation; the filesystem half of the asset and the client error path were never wired up.
- **Impact**: Unbounded disk growth in `~/.pof/audio`; silent UI failure on delete errors.
- **Fix sketch**: In the DELETE handler, look up `relPath`(s) before deleting rows and `rm` the file/set directory (best-effort). In the panel, switch deletes to `tryApiFetch` and surface a toast on failure.

## UI findings

## 6. Scene delete is one-click, irreversible, and unconfirmed
- **Severity**: High
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/content/audio/AudioView.tsx:415`
- **Scenario**: The trash button sits in the scene header right next to "Generate Audio System". One misclick calls `deleteDoc(activeDoc.id)` immediately — the entire scene (all zones, emitters, soundscape descriptions, settings) is gone with no confirmation and no undo.
- **Root cause**: No destructive-action guard. Inconsistent even within this module: `AudioLibraryPanel.handleDeleteSet` asks `confirm('Delete this set and all its variations?')` before deleting (AudioLibraryPanel.tsx:96).
- **Impact**: Accidental loss of hours of zone-painting work; users learn to fear the header.
- **Fix sketch**: Gate on a confirm step (the library's `confirm(...)` at minimum, ideally the app's dialog pattern) including the zone/emitter counts; or implement soft-delete with an undo toast.

## 7. 10-tab bar has no overflow handling or tablist semantics, unlike every other module's tab bar
- **Severity**: Medium
- **Lens**: ui
- **Category**: responsiveness
- **File**: `src/components/modules/content/audio/AudioView.tsx:424`
- **Scenario**: With the 13rem scene sidebar always present, on a half-width window (or any viewport under ~1100px) the right-most tabs (Auto Gen, Sound Forge, Library) get clipped off-screen with no scroll affordance — those features become unreachable.
- **Root cause**: The container is `flex items-center gap-1 px-5 border-b` with no `overflow-x-auto`, no wrap, and no `role="tablist"`/`aria-selected`. Sibling modules already solved this (`core-engine/unique-tabs/_shared.tsx:1073` and `UE5RemoteController.tsx:749` use `overflow-x-auto custom-scrollbar` + `role="tablist"` + `aria-label`).
- **Impact**: Features silently inaccessible at common window sizes; screen readers don't announce the tabs as a tab set; inconsistent with the app-wide tab pattern.
- **Fix sketch**: Add `overflow-x-auto custom-scrollbar` and `role="tablist"`/`aria-label` to the container and `role="tab"`/`aria-selected` to `TabButton` (matching the `_shared.tsx` pattern); consider `flex-shrink-0` on tabs.

## 8. Event Catalog rows are mouse-only — keyboard users cannot edit or delete events
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/content/audio/AudioEventCatalog.tsx:386`
- **Scenario**: The only way to open the event editor is clicking a plain `<div onClick>` row — no `tabIndex`, no `role`, no key handler — so keyboard and screen-reader users can never reach the editor at all. The per-row delete button is additionally `opacity-0` until `group-hover`, so even when focused programmatically it is invisible (focus does not trigger the hover reveal).
- **Root cause**: Row built as a styled div with a click handler instead of a button; reveal-on-hover pattern with no `focus-within` equivalent.
- **Impact**: An entire feature (event editing) is inaccessible by keyboard — a WCAG 2.1.1 blocker; invisible-when-focused delete fails 2.4.7.
- **Fix sketch**: Make the row a `<button>` (or add `role="button" tabIndex={0}` + Enter/Space handler) with an `aria-expanded` tie to the editor; change the delete reveal to `opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100`.

## 9. Copy button nested inside the expand button in generated-file rows (invalid interactive nesting)
- **Severity**: Medium
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/content/audio/AudioCodeGenPanel.tsx:189`
- **Scenario**: Each generated file row is a full-width `<button>` (expand/collapse) that contains a second `<button>` (copy). With a keyboard, Tab lands on the outer button and Enter toggles expansion; the inner copy control is announced as part of the outer button's name ("ChevronRight FileCode AudioZone.h 120 lines Copy") and cannot be activated independently by AT.
- **Root cause**: `<button>` inside `<button>` is invalid HTML; only `e.stopPropagation()` on click makes it appear to work for mouse users.
- **Impact**: Copy-per-file is unreachable for keyboard/screen-reader users; invalid markup risks browser parser quirks if this panel is ever server-rendered with a result.
- **Fix sketch**: Make the row a `<div>` with the expand `<button>` and copy `<button>` as siblings (filename area inside the expand button), mirroring how AudioLibraryPanel lays out row actions as sibling buttons.

## 10. Event Catalog is visually off-scale from every sibling audio tab
- **Severity**: Medium
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/content/audio/AudioEventCatalog.tsx:176`
- **Scenario**: Switching between tabs, the Event Catalog suddenly reads ~25% larger than the rest of the module: `text-base` heading, `text-sm` body/labels/buttons, `px-4 py-2` filter chips, `px-6 py-4 rounded-xl` generate CTA, glow/shimmer effects — while Scene Painter chrome, property panels, Library, Code Gen, and Settings all use the app's compact scale (`text-xs` headings, `text-2xs` labels, `px-2.5 py-1.5` chips, `rounded-md`).
- **Root cause**: The component was styled standalone with its own type ramp instead of the module's established tokens; none of its repeated chip/label/badge styles reuse the shared compact patterns.
- **Impact**: The module feels stitched together from two different apps; inconsistent control sizes also shift muscle memory for hit targets between tabs.
- **Fix sketch**: Drop one type step throughout (`text-base→text-sm`, `text-sm→text-xs`, `text-xs→text-2xs`), shrink chip/button paddings to the `px-2.5 py-1.5`/`rounded-md` scale used in AudioView/AudioPropertyPanel, and reserve the shimmer CTA treatment for the single primary action.
