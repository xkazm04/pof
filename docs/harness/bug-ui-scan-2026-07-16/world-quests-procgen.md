# World, Quests & Procgen — Bug + UI Scan

> Total: 9

## Bug findings

### 1. Regenerate action can silently target the wrong zone
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_world/index.tsx:83-87
- **Scenario**: User drags the Player Level Filter to a level whose matching zone (e.g. `z-kashyyyk`, level 15-25) has no corresponding row yet in `zoneEntries` (catalog not seeded/loaded for that zone, or it lags behind the static `ZONES` list). `entryByZoneId.get(primaryZoneId)` returns `undefined`, so the code falls back to `zoneEntries[0]` — an arbitrary, unrelated catalog entry (could be Sanctuary or any other zone).
- **Root cause**: `const primaryEntry = (primaryZoneId != null ? entryByZoneId.get(primaryZoneId) : undefined) ?? zoneEntries[0];` treats "not found" and "no filter applied" the same way, defaulting to index 0 instead of `undefined`.
- **Impact**: The lifecycle chip, asset count, and "Regenerate" button now silently operate on a zone the user never selected. Clicking Regenerate fires a generation task against the wrong entity — a destructive, misdirected action with no visual cue that the displayed zone differs from the level-filtered one.
- **Fix sketch**: Only fall back to `zoneEntries[0]` when `primaryZoneId` itself is `undefined` (i.e., `ZONES` is empty); otherwise show an explicit "not yet generated for this zone" state instead of substituting a different entity.

### 2. Non-null assertion on primaryEntry crashes useGeneration when catalog is empty
- **Severity**: Critical
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_world/index.tsx:87
- **Scenario**: On first load / before `useCatalogEntities('zone-map')` has populated any rows (empty catalog, fresh project, or API hiccup), `zoneEntries` is `[]`, so `primaryEntry` is `undefined`. The code calls `useGeneration(primaryEntry!)` anyway.
- **Root cause**: `useGeneration(entity: StoredCatalogEntity)` immediately does `catalogModule(entity.catalogId)` — the `!` assertion only silences TypeScript, it does not prevent the runtime `Cannot read properties of undefined (reading 'catalogId')` crash.
- **Impact**: The whole Zone & Level Architecture tab throws during render before any zone data has loaded, taking down the panel (and, depending on error-boundary placement, more of the page) instead of showing a loading/empty state.
- **Fix sketch**: Guard the `useGeneration` call (or the whole lifecycle-cell block) behind `primaryEntry` being defined, e.g. skip rendering `CatalogLifecycleCell` — and don't call `useGeneration` — until `zoneEntries.length > 0`.

### 3. Topology graph node coordinates exceed the fixed SVG viewBox
- **Severity**: High
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_world/map/TopologyGraph.tsx:31 (data: src/components/modules/core-engine/sub_world/_shared/data.ts:60-67)
- **Scenario**: The SVG is hardcoded to `width={460} height={300} viewBox="0 0 460 300"`, but several zones added later (`z-kashyyyk` topoX=500, `z-korriban` topoX=700, `z-malachor` topoX=850, all topoY up to 300) place nodes far outside that box.
- **Root cause**: `topoX`/`topoY` in `ZONES` were extended for the newer Star-Wars-themed zone set without rescaling to the original 460×300 canvas the topology view was designed for; the SVG has `overflow-visible`, so out-of-bounds nodes paint outside the panel rather than being clipped-and-hidden.
- **Impact**: For any player-level range that includes the later zones, the topology graph visibly spills nodes/edges/tooltips outside the "Zone Topology Graph" panel, overlapping surrounding page content (legend, next panels) instead of rendering inside its box.
- **Fix sketch**: Compute the viewBox from `Math.max` of all `topoX`/`topoY` (mirroring the `axisMax` pattern already used in `DensityLevelGroup`), or normalize `topoX`/`topoY` onto a fixed 0-460/0-300 range when building `TOPOLOGY_NODES`.

### 4. Dangling zone connection IDs render as a blank/undefined chip
- **Severity**: Medium
- **Category**: bug
- **File**: src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx:152-160
- **Scenario**: `selectedZone.connections` lists a zone id (e.g. via a future data edit that renames/removes a zone id but leaves it in another zone's `connections` array). `ZONES.find(z => z.id === connId)` returns `undefined`.
- **Root cause**: `{connZone?.displayName}` optional-chains straight through to rendering nothing, with no fallback label or dev warning — a classic caught-and-forgotten data-integrity gap.
- **Impact**: The Connections list silently shows an empty chip (icon with no text) instead of surfacing that the zone graph data is inconsistent, making a real content bug invisible to whoever edits `ZONES`/`connections` next.
- **Fix sketch**: Fall back to `connZone?.displayName ?? connId` (or a visibly-flagged "unknown zone" chip) so a broken reference is obvious rather than blank.

## UI findings

### 5. Level-filter tick labels bleed past the panel edges at the extremes
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_world/index.tsx:140-150
- **Scenario**: The axis ticks `[1, 10, 20, 30, 40, 50]` are positioned with `left: ${((v-1)/49)*100}%` and centered via `-translate-x-1/2`. At `v=1` (left: 0%) and `v=50` (left: 100%), half of the label text extends outside the bordered panel (`p-3` padding, no inner `overflow-hidden`/edge inset).
- **Root cause**: Tick positioning centers every label on its percentage point without insetting the first/last tick, unlike the slider `<input>` itself which naturally stays within its track.
- **Impact**: "1" and "50" visually crowd or overlap the panel's rounded border on narrow viewports, looking unpolished next to the otherwise-precise mono/tabular-nums styling used throughout this panel.
- **Fix sketch**: Clamp label position with `text-align`/`justify-content` at the two ends (e.g. `left-0 translate-x-0` for the first tick, `right-0 translate-x-0` for the last) instead of a uniform center-transform.

### 6. Enemy Density Heatmap legend uses raw hex instead of the shared token system
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_world/density/DensityLevelGroup.tsx:51,57,60
- **Scenario**: Every other color in this file (and its siblings) is drawn from `@/lib/chart-colors` tokens (`STATUS_ERROR`, `ACCENT_*`, `withOpacity`), but the heatmap's "Low" swatch and gradient anchor is a bare literal `'#1e3a5f'` with no named token.
- **Root cause**: One-off literal introduced instead of adding/reusing a token (e.g. a `SURFACE_DEEP_BLUE`/"heatmap low" constant) in `chart-colors`.
- **Impact**: This swatch won't track future theme/dark-light palette adjustments the way every other accent in the module does, and it's the only hardcoded color in an otherwise fully tokenized file — a quiet design-system leak.
- **Fix sketch**: Promote `#1e3a5f` to a named export in `chart-colors` (or reuse an existing surface token) so the heatmap stays in sync with future palette changes.

### 7. "Locked" legend swatch is visually inconsistent with "Completed"/"Active"
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx:46-53
- **Scenario**: The Completed and Active legend entries are colored circles with a `shadow-[0_0_5px_currentColor]` glow and a `hover:text-*` transition; the Locked entry is a plain `rounded` gray square (`bg-border`) with no glow and no distinct hover color.
- **Root cause**: The Locked swatch was written as a quick placeholder (square vs. circle, no glow) rather than following the same component pattern as the other two states.
- **Impact**: The legend — meant to be a simple 1:1 key for the map's dot shapes/colors — itself uses a different shape and treatment for one of its three entries, undermining the "read the legend, understand the map" contract at a glance.
- **Fix sketch**: Reuse the same circle + glow markup for Locked (using `STATUS_LOCKED`/`STATUS_LOCKED_STROKE`) so all three legend entries share one visual pattern.

### 8. Travel tab's two sub-sections start collapsed on first visit, unlike every other tab
- **Severity**: Medium
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_world/index.tsx:49,205-214
- **Scenario**: `openGroups` initializes to `new Set([0])`, pre-opening only the Map & Topology group (index 0). Playtime (1) and Density (2) groups are each the *sole* content of their tab, so collapsing them doesn't hide "everything" — but Travel (idx 3 & 4) are two separate collapsed groups stacked on one tab, so a first-time visitor to Travel sees two closed accordions and no content until clicking twice.
- **Root cause**: The initial-open logic only accounts for the default active tab (`'map'`), not the fact that some tabs (Travel) contain multiple independently-collapsed groups that all default closed.
- **Impact**: Users switching to the Travel tab land on an empty-looking panel (two collapsed headers) whereas every other tab shows its content immediately — an inconsistent first-impression across tabs of the same component.
- **Fix sketch**: Pre-open the group(s) belonging to whichever tab is active by default per-tab (or auto-expand a tab's groups the first time it's selected), so switching tabs never lands on an all-collapsed state.

### 9. Tiny playtime segments render clipped icon+label chips with no minimum-width guard
- **Severity**: Low
- **Category**: ui
- **File**: src/components/modules/core-engine/sub_world/playtime/PlaytimeBreakdownTable.tsx:42-56
- **Scenario**: Combat/Boss/Exploration sub-segments are sized at `width: (segmentSec/totalSec) * barPct` with no minimum; a zone with a very small boss/combat slice relative to its total (e.g. a couple of seconds versus several minutes of exploration) produces a sliver a few pixels wide that must still fit an icon + text label.
- **Root cause**: No minimum rendered width or a "hide label under N% " threshold — the layout assumes segments are always wide enough for their content.
- **Impact**: Small segments show visibly clipped/overlapping icon+text instead of either hiding the label or widening past its proportional share, breaking the otherwise clean bar/legend polish used elsewhere in this file.
- **Fix sketch**: Hide the inline icon+label (falling back to just the colored slice, explained by the legend) once a segment's rendered width drops below a fixed pixel/percentage threshold.
