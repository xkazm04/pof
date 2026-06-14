# World, Quests & Procgen — zen-perf scan
> Context: Progression, World & Bestiary / World, Quests & Procgen
> Total: 5
> Severity: critical=0 high=2 medium=2 low=1

## 1. Slider ticks re-render the entire animated map + topology SVG subtree
- **Severity**: high
- **Lens**: performance
- **Category**: unnecessary re-renders / missing memo boundary
- **File**: src/components/modules/core-engine/sub_world/index.tsx:60-64, 173
- **Scenario**: User drags the "Player Level Filter" range slider (1→50). Each integer step sets `playerLevel`, re-running `ZoneMap` and every descendant.
- **Root cause**: `matchingZones` is `useMemo`'d on `playerLevel`, but `.filter()` returns a fresh array on every band change, and `matchingIds = useMemo(() => new Set(matchingZones.map(...)), [matchingZones])` therefore produces a **new Set reference whenever `matchingZones` changes**. That fresh `matchingIds` is threaded into `MapTopologyGroup` → `ZoneMapCanvas` and `TopologyGraph`, none of which are wrapped in `React.memo` (confirmed: zero `memo`/`React.memo` in the map/ and density/ folders). So the full `<svg>` with framer-motion `<motion.line>`/`<motion.circle>` nodes re-renders on every tick. The `matchSignature`/`RipplePulse` guard at line 67/167 only debounces the ripple effect — it does **not** prevent the child re-render.
- **Impact**: Dragging the slider re-mounts/recomputes the entire map canvas (12 nodes × edges, each a motion element) plus the topology graph and density bars dozens of times per drag — visible jank, dropped frames, wasted reconciliation while the user is just scrubbing levels.
- **Effort**: 3 · **Value**: 7
- **Fix sketch**: Wrap `ZoneMapCanvas`, `TopologyGraph`, and `MapTopologyGroup` in `React.memo`. Keep `matchingIds` referentially stable across ticks within the same band by memoizing on `matchSignature` instead of `matchingZones` (e.g. `useMemo(() => new Set(matchingZones.map(z => z.id)), [matchSignature])`). Then unchanged bands skip the whole SVG re-render.

## 2. Procgen quest generator rebuilds adjacency + does O(n²) array scans on scanned project data
- **Severity**: high
- **Lens**: both
- **Category**: O(n²) graph traversal / duplicated logic
- **File**: src/lib/quest-generator.ts:428-468 (`buildCombatSegments`), 471-503 (`findNearestSafeRoom`)
- **Scenario**: `generateQuests` runs on a scanned UE5 project's level-design doc. `rooms`/`connections` are arbitrary-sized (real projects can have hundreds of rooms). `findNearestSafeRoom` is called once **per dungeon segment** inside `generateClearQuests` (line 166).
- **Root cause**: Two issues compound. (a) Both helpers rebuild the **entire `adjacency` Map from scratch** on every invocation (lines 437-444 and 481-488) — identical code, so `findNearestSafeRoom` re-walks all connections for each segment. (b) The traversals do linear `rooms.find(r => r.id === id)` / `combatRooms.find(r => r.id === nId)` **inside the BFS/DFS loops** (lines 460, 494), turning each visited node into an O(rooms) scan → overall O(rooms × edges) per segment, O(segments × rooms × edges) for the whole clear-quest pass.
- **Impact**: On large scanned worlds, quest generation in the API route (`/api/quest-generation`) becomes quadratic-to-cubic in room count for what is intrinsically a linear graph walk — slow, blocking the request handler. Also a clear DRY/SRP smell: adjacency construction is copy-pasted in two helpers.
- **Effort**: 4 · **Value**: 6
- **Fix sketch**: Build `adjacency` and a `roomById = new Map(rooms.map(r => [r.id, r]))` **once** in `generateQuests` and pass them into the helpers. Replace the in-loop `.find()` calls with `roomById.get(id)`. This makes both traversals O(rooms + edges) and removes the duplicated adjacency builder (extract a single `buildAdjacency(connections)`).

## 3. `maxSec` recomputed inside the per-row render loop
- **Severity**: medium
- **Lens**: performance
- **Category**: invariant hoisting / missing memo
- **File**: src/components/modules/core-engine/sub_world/playtime/PlaytimeBreakdownTable.tsx:28
- **Scenario**: The breakdown table renders one row per zone in `ZONE_PLAYTIME`; this runs on every render of the playtime tab (and re-renders propagate from the parent slider per finding #1).
- **Root cause**: `const maxSec = Math.max(...ZONE_PLAYTIME.map(z => z.totalSec));` sits **inside** the `ZONE_PLAYTIME.map((zp) => {...})` callback (line 28), so the max over the whole array is recomputed once per row — O(n²) for an O(n) result — even though `ZONE_PLAYTIME` is a module-level constant that never changes.
- **Impact**: Quadratic work per render for a constant value. Small dataset today, but it is pure redundant computation and the exact kind of invariant that should be hoisted; it also re-runs on every parent re-render (see #1).
- **Effort**: 1 · **Value**: 4
- **Fix sketch**: Hoist to a module-level constant: `const MAX_ZONE_SEC = Math.max(...ZONE_PLAYTIME.map(z => z.totalSec));` (or a `useMemo` with `[]`), then reference it inside the loop.

## 4. MapCanvas resolves edge targets with O(n) `.find()` inside a nested map on every render
- **Severity**: medium
- **Lens**: performance
- **Category**: O(n²) lookup in render / missing index
- **File**: src/components/modules/core-engine/sub_world/map/MapCanvas.tsx:60-63
- **Scenario**: `ZoneMapCanvas` draws connection lines by iterating every zone and, for each connection id, calling `zones.find((z) => z.id === connId)` (line 62). Combined with #1, this re-runs on every slider tick.
- **Root cause**: No id→zone index. The connection pass is `zones.map(zone => zone.connections.map(connId => zones.find(...)))` → O(zones × connections × zones). `getZoneColor`/`getStrokeColor`/`isInRange` are also recreated every render and have no memoization. (`TopologyGraph.tsx:34-35` has the identical anti-pattern: `TOPOLOGY_NODES.find(...)` for both edge endpoints inside the edge map.)
- **Impact**: Quadratic edge resolution on each canvas render. Dataset is small (12 zones) so it is not yet a hot bottleneck, but it is gratuitous repeated linear scans that compound directly with the per-tick re-render of finding #1.
- **Effort**: 2 · **Value**: 4
- **Fix sketch**: Build `const byId = useMemo(() => new Map(zones.map(z => [z.id, z])), [zones])` once and use `byId.get(connId)`. Apply the same `Map` index in `TopologyGraph` for `TOPOLOGY_NODES` (it is a module constant, so the map can live at module scope).

## 5. `ensure*Table()` issues a CREATE TABLE DDL on every procgen/scatter read and write
- **Severity**: low
- **Lens**: both
- **Category**: repeated DDL on hot path / cheap missing abstraction
- **File**: src/lib/procgen-db.ts:5-14, 26, 38 · src/lib/scatter-db.ts:4-13, 25, 37
- **Scenario**: Every `recordProcgenRun` / `getLatestProcgenRun` / `recordScatterRun` / `getLatestScatterRun` (and the zone-pin CRUD) calls `ensure*Table()` first, which runs `getDb().exec('CREATE TABLE IF NOT EXISTS ...')`.
- **Root cause**: The `getDb()` connection is cached (a singleton — see src/lib/db.ts:14-15), so the table only ever needs creating once per process, yet the DDL `exec` is re-parsed and re-run on every single query. This mirrors a codebase-wide pattern, so severity is low, but here it is on the procgen/scatter read path that may be polled.
- **Impact**: Redundant DDL parse/execute on each call — wasted SQLite round-trips on what should be pure reads/writes. Minor, but free to remove.
- **Effort**: 2 · **Value**: 3
- **Fix sketch**: Guard with a module-level memo flag, e.g. `let procgenReady = false; function ensureProcgenTable() { if (procgenReady) return; getDb().exec(...); procgenReady = true; }` (one flag per table). Same for `scatter-db.ts` and the zone-pin table.
