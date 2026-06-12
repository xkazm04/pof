# World, Quests & Procgen — Bug + UI scan (2026-06-12)

> Total: 10 findings (5 bug, 5 ui)

## Bug findings (new since 2026-06-09)

*Regression check: commits 6f9fa4d (deterministic fetch-quest rooms, `quest-generator.ts:192-193`) and 596d964 ("Tell me more" info node, `quest-generator.ts:367-414`) were verified — the info node is pushed with fully-wired accept/decline choices and the index-modulo room pick is correct; no regressions introduced. Prior finding #2 (module-global `nextId` race) is still open but known, so not re-reported.*

## 1. Boss zone diamonds are drawn in pixel space while every other map element uses percentages
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx:132`
- **Scenario**: Open World → Map (or the Procedural Zone Generator preview, which renders boss zones in every generated graph). For any zone with `type: 'boss'` (Ruined Keep at cx 85/cy 50, Malachor V at 85/35), the diamond `<polygon>` is built from raw values: `points={`${zone.cx},${zone.cy - 12} …`}`. SVG `points` cannot take percentage units, so the diamond renders at user-space pixel (85, 38) — the top-left corner — while the same zone's connection lines, pulsing ring, hover ring, selection dot and label all render at `85%`/`50%` of the canvas via percent-string `cx`/`cy` attributes.
- **Root cause**: The component mixes two coordinate systems: percent-string attributes (supported on `circle`/`rect`/`line`/`text`) and the polygon `points` attribute (user units only, and the svg has no `viewBox`, so user units = px). The assumption "all shapes share the percentage space" fails exactly for the boss shape.
- **Impact**: Wrong visual output for the most important map nodes — boss diamonds appear detached in the top-left, overlapping other zones, with their orphaned labels/edges at the true location. Affects both the hand-authored world map and 100% of procgen previews containing a boss zone.
- **Fix sketch**: Give the svg `viewBox="0 0 100 100" preserveAspectRatio="none"` and use unitless coordinates everywhere (add `vector-effect="non-scaling-stroke"` and fixed-size shapes via `transform`), or replace the polygon with a `<rect>` rotated 45° positioned with percent `x`/`y` like the hub square. Add a story/test that renders a boss zone and asserts its shape and label share a midpoint.

## 2. Level Range Flow axis frozen at MAX_LEVEL=7 while zones now reach level 50 — six zones render empty or clipped bars
- **Severity**: High
- **Lens**: bug
- **Category**: edge-case
- **File**: `src/components/modules/core-engine/sub_world/density/DensityLevelGroup.tsx:78`
- **Scenario**: Open World → Density. `LEVEL_RANGE_BARS` derives from all 12 `ZONES`, but `leftPct = ((bar.min - 0.5) / MAX_LEVEL) * 100` uses `MAX_LEVEL = 7` (`_shared/data.ts:207`). Nar Shaddaa (8-18) gets left=107%, Kashyyyk (15-25) 207%, Korriban (22-35) 307%, Malachor V (30-50) 421% — all fully clipped by the `overflow-hidden` track, so their rows show blank bars. Tatooine (1-10) renders a 143%-wide bar whose "Lv1-10" label sits past the visible edge. The axis ticks only show 1-7, and the player-level indicator clamps to 7 while the slider goes to 50.
- **Root cause**: `MAX_LEVEL` was sized for the original 6-zone world; the KOTOR zones were appended to `ZONES` (data.ts comment even notes other hand-indexed structures were left untouched) without re-deriving the axis scale, breaking the implicit invariant "every zone's levelMax fits the axis".
- **Impact**: Wrong results — half the Level Range Flow rows show no level range at all, and a designer reading the chart concludes those zones have no/zero level data. The Lv-50 indicator silently lies (pegged at level 7's position with a "Player Lvl 50" label).
- **Fix sketch**: Derive the scale from data: `const axisMax = Math.max(...LEVEL_RANGE_BARS.map(b => b.max))` (or recompute `MAX_LEVEL` in data.ts from `ZONES`), and generate axis ticks from that value. Keep the indicator clamp but clamp against the derived max.

## 3. Moving the player-level slider during a zone generation run re-keys the CLI hook and silently drops the completion refresh
- **Severity**: Medium
- **Lens**: bug
- **Category**: race-condition
- **File**: `src/components/modules/core-engine/sub_world/index.tsx:75`
- **Scenario**: User clicks (Re)generate for the primary zone (say z1, CLI session `gen-zone-z1` starts running), then drags the Player Level slider from 1 to 4. `primaryZoneId = matchingZones[0]?.id` flips to z3, so `useGeneration(primaryEntry!)` is now called with a different entity and `useModuleCLI`'s `sessionKey` becomes `gen-zone-z3`. The hook's `isRunning` selector (keyed to the *current* sessionKey, `useModuleCLI.ts:56-61`) flips true→false, which the completion effect (`useModuleCLI.ts:82-114`) misreads as "run finished": it records a `recordSessionOutcome` with `success:false` for a task that is still running, and fires `onComplete` early (a no-op refetch). When the z1 run actually completes, the hook is watching z3's key — no transition is observed and the real `/api/catalog` lifecycle refetch never fires.
- **Root cause**: The generation hook is keyed to a *derived, moving* selection ("first zone matching the slider"), while `useModuleCLI`'s running→stopped detection assumes the sessionKey is stable for the lifetime of a run. A sessionKey swap is indistinguishable from a completion.
- **Impact**: Silent failure — the lifecycle cell stays stale (server persisted the transition, UI never refetches until reload); `busy` turns off mid-run so the user can fire overlapping generations; analytics gets a bogus "failed" record for an in-flight task.
- **Fix sketch**: Pin the entity for the duration of a run (e.g. store `runningEntityId` in state when `generate()` is called and feed that to `useGeneration` until completion), or in `useModuleCLI` track the sessionKey that was running in `prevRunningRef` and skip the completion branch when `opts.sessionKey` changed rather than the session itself stopping.

## 4. Zone pins persist unvalidated `params` — one malformed POST creates a poison pin that crashes the generator panel on every restore
- **Severity**: Medium
- **Lens**: bug
- **Category**: state-corruption
- **File**: `src/lib/procgen-db.ts:71`
- **Scenario**: `POST /api/procgen/zone-pins` (route.ts:17) validates only `typeof seed === 'number' && !!params` — any truthy `params` (a string, `{}`, an object missing `branchiness`) is `JSON.stringify`-ed into the `zone_graph_pins` table. The pin then appears in the Seed gallery; clicking it runs `restorePin(pin) → setParams(pin.params)` (`ZoneGeneratorPanel.tsx:40`), and the next render throws — `params.branchiness.toFixed(2)` (line 57) on undefined, or `generateZoneGraph` returning nothing so `selected.id` dereferences undefined — crashing the World map section. The pin is persistent, so the crash recurs on every restore until the row is deleted by hand.
- **Root cause**: Trust boundary checks the container's truthiness, not its shape — the exact class of bug the 2026-06-09 audit's `asZone` fix (#3) closed elsewhere. The DB layer types the column as `ZoneGraphParams` purely by cast on read (`rowToPin`, procgen-db.ts:63).
- **Impact**: A single bad API call (script, retry corruption, future client drift) plants a persistent landmine; UI crash loop of the procgen panel, no recovery path in the UI besides deleting the pin via API.
- **Fix sketch**: Validate at the boundary with zod in the route: `zoneCount` int 2-14, `branchiness` 0-1, `topology`/`difficulty` enums, `seed`/`maxLevel` finite numbers; reject otherwise. Defensively, have `restorePin` merge `pin.params` over the current params with the same schema check and ignore invalid pins.

## 5. Requesting a nonexistent levelDocId silently generates fallback quests instead of erroring
- **Severity**: Low
- **Lens**: bug
- **Category**: silent-failure
- **File**: `src/app/api/quest-generation/route.ts:73`
- **Scenario**: Client POSTs `{ levelDocId: 42 }` after the doc was deleted (or with a stale id from the GET dropdown cache). `getDoc(42)` returns `null` (`level-design-db.ts:70-76`), `levelDoc` stays null, and `generateQuests(classes, null)` returns the actor-only bounty quests with `levelDocId: null` and HTTP 200.
- **Root cause**: The "doc not found" case is indistinguishable from "no doc requested" — both fall through to the null branch; the explicit request for a specific document is not treated as a precondition.
- **Impact**: Success theater — the user asked for quests for a specific level and gets a structurally different result (no rooms, no traversal/fetch/interaction quests) with no indication anything went wrong; downstream diffing against a previous generation for that doc silently compares apples to oranges.
- **Fix sketch**: `if (body.levelDocId) { levelDoc = getDoc(body.levelDocId); if (!levelDoc) return apiError(`Level doc ${body.levelDocId} not found`, 404); }`. Keep the first-available fallback only for the unspecified case.

## UI findings

## 6. Topology graph nodes overflow the hard-coded 460×300 canvas and their tooltips detach
- **Severity**: High
- **Lens**: ui
- **Category**: visual-consistency
- **File**: `src/components/modules/core-engine/sub_world/map/TopologyGraph.tsx:31`
- **Scenario**: The svg is fixed at `width={460} height={300} viewBox="0 0 460 300"` with `overflow-visible`, but `TOPOLOGY_NODES` (from `ZONES[].topoX/topoY`) include Kashyyyk at x=500, Korriban at x=700 and Malachor V at x=850 — they render outside the canvas, spilling past the rounded `bg-surface-deep/30` backdrop (or clipped by ancestors). Hovering Korriban shows a tooltip clamped to `Math.min(rawX, 460 - tooltipW - 4)` (line 103) — it appears ~320px to the left of the node, floating over unrelated nodes.
- **Root cause**: Canvas dimensions and tooltip clamping were sized for the original 6-zone layout; the KOTOR zones were appended with coordinates beyond the fixed bounds and no bounds derivation exists.
- **Impact**: The graph looks broken (nodes outside the panel chrome, edges running off the backdrop) and tooltips actively mislead — a designer reads the wrong level range next to the wrong node.
- **Fix sketch**: Derive bounds from data: `const w = Math.max(...nodes.map(n => n.x)) + pad`, same for height; use those for `viewBox` and the tooltip clamp, and render the svg with `className="w-full h-auto max-w-full"` so it scales responsively instead of overflowing on narrow screens.

## 7. World map and topology graph are mouse-only; the player-level slider has no accessible name
- **Severity**: High
- **Lens**: ui
- **Category**: a11y
- **File**: `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx:96`
- **Scenario**: Zone nodes are clickable `<g onClick>` elements with `cursor-pointer` but no `tabIndex`, `role`, or key handler — keyboard users cannot select a zone, and screen readers announce nothing (the Region Details panel is unreachable for them). Same pattern in `TopologyGraph.tsx:69-75`, where level-range tooltips exist only on `onMouseEnter`. The Player Level slider (`index.tsx:129`) is a bare `<input type="range">` whose visible "Player Level Filter" text is not programmatically associated — SRs announce "slider, 7" with no name.
- **Root cause**: Interactive SVG built with click/hover handlers only; no focusable affordance or aria layer, and the slider label is a sibling `<span>` rather than a `<label>`/`aria-label`.
- **Impact**: Core navigation of the World tab (zone selection drives the details panel and the catalog lifecycle row) is unusable without a mouse — a WCAG 2.1.1/4.1.2 failure, inconsistent with `HeatmapGrid` in the same module which already does `tabIndex`/`role="gridcell"`/`aria-label` properly.
- **Fix sketch**: On each node `<g>`: `role="button" tabIndex={0} aria-label={`${zone.displayName}, ${zone.status}`} aria-pressed={isSelected}` plus `onKeyDown` Enter/Space → `onSelectZone`; show topo tooltips on focus as well as hover. Give the slider `aria-label="Player level filter"` and `aria-valuetext={`Level ${playerLevel}`}`.

## 8. Enemy Density Heatmap renders the five KOTOR zones as confident all-zero rows
- **Severity**: Medium
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_world/density/DensityLevelGroup.tsx:37`
- **Scenario**: `ENEMY_DENSITY_CONFIG.rows` is `ZONES.map(z => z.name)` (12 rows) but cells exist only for rows 0-5 and 11 (`_shared/data.ts:225-239`). `HeatmapGrid` fills missing cells with `value 0` (`_shared.tsx:788`), so Tatooine through Malachor V appear as five uniform "0%" low-color rows in the middle of the grid — and their tooltips assert "Tatooine × NW: 0%".
- **Root cause**: Hand-indexed cell data wasn't extended when zones were appended (the data file's own comment acknowledges the rows are hand-indexed), and the grid has no "no data" rendering distinct from zero.
- **Impact**: Missing data masquerades as measured data — a designer scanning density sees five "empty" zones and may plan encounters off a lie; it also visually contradicts the Playtime table, which gives those same zones nonzero estimates.
- **Fix sketch**: Either filter heatmap rows to zones that have cells (`rows: ZONES.filter(z => hasCells(z))`), or teach `HeatmapGrid` a `cell === undefined → "—" / hatched cell with "no data" tooltip` state. Prefer the latter — it fixes the class, not the instance.

## 9. Range-filter logic and the labelled-bar row are copy-pasted across three panels
- **Severity**: Medium
- **Lens**: ui
- **Category**: component-extraction
- **File**: `src/components/modules/core-engine/sub_world/density/DensityLevelGroup.tsx:25`
- **Scenario**: `const hasFilter = matchingIds !== undefined && matchingIds.size > 0; const isInRange = (id) => !hasFilter || matchingIds!.has(id)` plus the 200ms opacity-fade treatment is duplicated verbatim in `MapCanvas.tsx:28-29`, `TopologyGraph.tsx:24-25` and `DensityLevelGroup.tsx:25-26`. Separately, the "w-28 truncated right-aligned label + h-6 `bg-surface-deep` track + animated bar + right-aligned mono value" row is built twice with diverging details (`DensityLevelGroup.tsx:82-107` vs `PlaytimeBreakdownTable.tsx:31-62` — different dim opacities: 0.3 vs 0.4, different transition handling).
- **Root cause**: Each panel grew its own copy as the level-filter feature was threaded through; no shared `useRangeFilter(matchingIds)` helper or `ZoneBarRow` primitive exists.
- **Impact**: The filter's dim/glow affordance already drifts between panels (0.3 vs 0.4 dim, glow on some, not others), so the same slider action reads differently per tab; every future filter tweak must be applied in three places.
- **Fix sketch**: Extract `useRangeFilter(matchingIds): { hasFilter, isInRange }` into `sub_world/_shared`, and a `ZoneBarRow({ label, value, dimmed, children })` presentational component used by both the level-range and playtime tables with one canonical dim opacity/transition.

## 10. Region Details uses AnimatePresence mode="sync", causing a stacked layout jump on every zone switch
- **Severity**: Low
- **Lens**: ui
- **Category**: polish
- **File**: `src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx:104`
- **Scenario**: Clicking a different zone on the map keys a new `motion.div` while the old one plays its 0.2s exit — with `mode="sync"` both panels exist in normal flow simultaneously, so the right-hand column momentarily doubles in height, content below jumps down then snaps back up.
- **Root cause**: `mode="sync"` keeps exiting children in the layout; this crossfade pattern needs `mode="wait"` or `mode="popLayout"` (which removes the exiting element from flow), as used elsewhere in this module (`index.tsx` uses `popLayout` for the zone chips).
- **Impact**: Visible jank on the primary interaction of the Map tab (zone selection), undermining an otherwise polished animated panel.
- **Fix sketch**: Change to `<AnimatePresence mode="popLayout">` (keeps the crossfade without flow displacement), or `mode="wait"` for a sequential fade. One-line change; verify with rapid zone clicking.
