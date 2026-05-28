# Procedural zone-graph generator with seed gallery

**Date:** 2026-05-28
**Backlog item:** `idea-54efcc33-procedural-zone-graph-generato`
**Status:** Design approved — ready for implementation plan

## Problem

`procgen-db.ts` only logs a `roomCount` + `seed` after the fact; there is no actual
zone-graph generator. The World module (`sub_world`) has a polished `ZoneMapCanvas` and
a connectivity/progression linter (`zone-analysis.ts`), but nothing generates candidate
worlds to feed them.

## Goal

A real zone-graph generator wired into the World module's **Map** tab: choose parameters
(zone count, branchiness, difficulty curve, topology archetype) and a seed → emit a
candidate set of zones → render in the existing `ZoneMapCanvas` → auto-validate every
candidate through `zone-analysis.ts` → reroll the seed → pin favorites (seed + params)
into a SQLite-backed seed gallery. A fast ideation loop whose output is already
progression-valid.

Non-goals (YAGNI): writing generated zones back into the canonical `ZONES` (pure
sandbox/preview); a 3D or tile-level generator; AI/CLI generation (this is deterministic
local generation).

## Decisions (from brainstorming)

- **Pin persistence:** extend `procgen-db.ts` with a `zone_graph_pins` SQLite table + a
  small API route (server-persisted, shareable).
- **UI placement:** embed the generator panel inside the **Map** tab via the *clean*
  `MapTopologyGroup.tsx`, so the foreign-modified `sub_world/index.tsx` is left untouched.

## Architecture

### 1. Pure generator — `src/lib/world/zone-graph-generator.ts` (new)

```ts
export type ZoneTopology = 'linear' | 'hub-and-spoke' | 'metroidvania';
export type DifficultyCurve = 'gentle' | 'linear' | 'steep';

export interface ZoneGraphParams {
  zoneCount: number;     // clamped 2..14
  branchiness: number;   // 0..1 — extra cross edges in metroidvania
  topology: ZoneTopology;
  difficulty: DifficultyCurve;
  maxLevel: number;      // top of the level ramp
  seed: number;
}

/** The minimal renderable+lintable zone (structurally a MapZone + level fields). */
export interface GeneratedZone {
  id: string;
  displayName: string;
  cx: number; cy: number;            // % positions for ZoneMapCanvas
  type: 'hub' | 'combat' | 'boss';
  status: 'active' | 'locked' | 'completed';
  connections: string[];
  levelMin: number; levelMax: number;
  levelRange: string;
}

export function generateZoneGraph(params: ZoneGraphParams): GeneratedZone[];
export function validateZoneGraph(zones: GeneratedZone[]): {
  perZone: { zoneId: string; findings: ZoneFinding[] }[];
  errors: number; warnings: number; ok: boolean;
};
```

- **Deterministic** via `createRNG(seed)` from `@/lib/seeded-rng` — no `Math.random`/
  `Date.now` inside generation, so identical params+seed → identical graph.
- **Roles:** index 0 = `hub` (`active`), last = `boss`, middle = `combat` (`locked`).
- **Difficulty ramp:** level ranges increase monotonically with depth. The slope follows
  the curve (`gentle` < `linear` < `steep`) but each zone's `levelMin` is kept within
  `LEVEL_JUMP_THRESHOLD` (3) of its predecessor's `levelMax`, so generated graphs do not
  trip the `level-spike` warning. `levelMin ≤ levelMax` always (no inversion).
- **Connections per topology:**
  - `linear`: `z_i → z_{i+1}` chain.
  - `hub-and-spoke`: hub → every spoke; the last spoke → boss; a return edge spoke→hub
    so spokes aren't unreachable.
  - `metroidvania`: a spanning chain (guarantees reachability) **plus** `round(branchiness
    × (zoneCount−2))` extra forward cross edges chosen by the seeded RNG.
- **Layout (`cx`,`cy` in %):** deterministic per topology (linear = evenly along x;
  hub-and-spoke = hub centred, spokes on a ring; metroidvania = seeded scatter on a grid),
  all within 8–92% so nodes stay on-canvas.
- **`validateZoneGraph`** maps each zone through `lintZone(zone, roster)` and aggregates.

### 2. Reusable canvas — `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx`

Export a minimal `MapZone` interface (`id, displayName, cx, cy, type, status, connections`)
and make the component generic: `ZoneMapCanvas<Z extends MapZone>(props: MapCanvasProps<Z>)`
with `zones: Z[]`, `selectedZone: Z`, `onSelectZone: (z: Z) => void`. `ZoneRecord` is a
structural superset, so the existing `MapTopologyGroup` call infers `Z = ZoneRecord`
unchanged; `GeneratedZone` also satisfies `MapZone`.

### 3. Persistence — `src/lib/procgen-db.ts` (extend) + new route

- New table:
  ```sql
  CREATE TABLE IF NOT EXISTS zone_graph_pins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seed INTEGER NOT NULL,
    params TEXT NOT NULL,        -- JSON ZoneGraphParams
    label TEXT NOT NULL DEFAULT '',
    zone_count INTEGER NOT NULL,
    topology TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
  ```
- Functions: `saveZonePin(input: { seed; params; label?; zoneCount; topology }): ZoneGraphPin`,
  `listZonePins(): ZoneGraphPin[]` (newest first), `deleteZonePin(id: number): void`.
- `ZoneGraphPin` type added to `src/types/procgen.ts`:
  `{ id, seed, params: ZoneGraphParams, label, zoneCount, topology, createdAt }`
  (`params` parsed from JSON on read).
- `src/app/api/procgen/zone-pins/route.ts`: `GET` → `apiSuccess(listZonePins())`;
  `POST` (body `{seed, params, label?}`) → `apiSuccess(saveZonePin(...))`;
  `DELETE?id=` → `apiSuccess({ deleted: id })`. Errors via `apiError`.

### 4. UI — `sub_world/map/ZoneGeneratorPanel.tsx` (new) + `MapTopologyGroup.tsx` (edit)

`ZoneGeneratorPanel` (self-contained, ≤200 LOC; split sub-panels if larger):
- Param controls: zoneCount slider (2–14), branchiness slider (0–1), topology select,
  difficulty select; seed shown read-only with a **Reroll** button.
- `const zones = useMemo(() => generateZoneGraph(params), [params])` — pure render.
- Reroll sets `params.seed = (Date.now() ^ Math.floor(Math.random()*1e9)) >>> 0` **in the
  click handler** (never in render).
- Renders `<ZoneMapCanvas zones={zones} selectedZone={…} onSelectZone={…} />` in a framed
  preview; a findings panel from `validateZoneGraph` (ok / N warnings / N errors, color via
  chart-colors `STATUS_*`).
- Seed gallery: `const { data: pins, mutate } = useCRUD<ZoneGraphPin[]>('/api/procgen/zone-pins', [])`.
  "Pin current" → `mutate('/api/procgen/zone-pins', { method:'POST', … })`; each pin chip →
  restore `params` (incl. seed); delete → `mutate('…?id='+id, { method:'DELETE' })`.

`MapTopologyGroup.tsx`: add one `<ZoneGeneratorPanel />` section (its own `BlueprintPanel`)
after the existing map content. Only this clean file is edited.

## File-by-file impact

| File | Change |
|------|--------|
| `src/lib/world/zone-graph-generator.ts` | **new** — generator + validator (pure) |
| `src/lib/procgen-db.ts` | **modify** — `zone_graph_pins` CRUD |
| `src/types/procgen.ts` | **modify** — `ZoneGraphPin` type |
| `src/app/api/procgen/zone-pins/route.ts` | **new** — GET/POST/DELETE |
| `src/components/modules/core-engine/sub_world/map/MapCanvas.tsx` | **modify** — generic over `MapZone` |
| `src/components/modules/core-engine/sub_world/map/ZoneGeneratorPanel.tsx` | **new** — generator UI |
| `src/components/modules/core-engine/sub_world/map/MapTopologyGroup.tsx` | **modify** — embed the panel |
| `src/__tests__/lib/zone-graph-generator.test.ts` | **new** — generator + validator |
| `src/__tests__/lib/procgen-db-zone-pins.test.ts` | **new** — pins CRUD (in-memory DB) |

## Test plan (TDD)

1. **`zone-graph-generator.test.ts`** (pure):
   - Determinism: same params (same seed) → deep-equal output; changing only the seed
     changes the graph.
   - `zoneCount` honored (clamped to 2..14).
   - Topology shapes: `linear` → each non-last zone connects to exactly the next;
     `hub-and-spoke` → zone 0 connects to every other; `metroidvania` with branchiness 0
     → a spanning chain, branchiness 1 → strictly more edges than branchiness 0.
   - Difficulty: ranges monotonic non-decreasing by depth, `levelMin ≤ levelMax` for all.
   - `validateZoneGraph(generateZoneGraph(...)).errors === 0` across all three topologies
     and several seeds (auto-valid output).
2. **`procgen-db-zone-pins.test.ts`** (in-memory DB mock like the existing procgen-db test):
   `listZonePins()` empty → `[]`; `saveZonePin` then `listZonePins` returns it newest-first
   with `params` parsed; `deleteZonePin` removes it.

Run `npm run validate` before completion — expect pre-existing foreign failures in the
shared tree; my files must be type/lint/test-clean.

## Risks

- **`ZoneRecord.name` is a constrained union** → generated zones use the structural
  `MapZone`/`GeneratedZone` types + the generic canvas, avoiding `as ZoneName` casts.
- **Shared tree:** all target files except `sub_world/index.tsx` (deliberately avoided) are
  clean. `procgen-db.ts`, `MapCanvas.tsx`, `MapTopologyGroup.tsx` verified clean before
  starting.
- **React purity:** generation is in `useMemo`; the only entropy (reroll seed) is created
  in an event handler — respects the `react-hooks/purity` rule.
