# Combat Map — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `combat-map` (existing) · **Description:** Tactical encounter arena with rules and spawn logic.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Arena Slice** → the real seeded entity **"Ravaged Courtyard"** (`combat-map` id `arena-ravaged-courtyard`): a mid-zone two-wave skirmish in the proven 20 m `build_arena.py` arena — Kath Hounds then Mandalorians, four corner-pillar cover points, a fire-floor hazard; win by clearing both waves, lose on death.

**Status (this session):** The UE runtime is far richer than expected — the *entire* tactical-arena stack already exists and is gated. So the honest end-to-end here was **design the missing data layer + reuse the existing UE asset/gate**, not build new C++. 10/15 steps reuse-or-produced, 2 partial, 3 gaps. The big finding: the `combat-map` catalog had an **identity split** (registered as "tactical arenas" but seeded only with weapon combos) — the Arena Slice is the bridge that finally connects the catalog to `AARPGEncounterArena` & friends. Honest dispositions below.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief & Objectives  
  _agent: Designer · **produced**: "Ravaged Courtyard" — a scorched Sith-temple courtyard, mid-zone skirmish. Objective: survive two escalating waves using pillar cover while a fire-floor denies the centre. Theme + objectives live on `ArenaSliceSpec` (`src/lib/catalog/arena-slice.ts`)._
- [x] 2. Tactical Grid / Layout Logic  
  _agent: Designer · **reuse** `AARPGEncounterArena` (`FArenaTacticalPoint`, `EArenaTier`, extent + elevation thresholds, `ScanArena`/`FindFlankingPosition`) + **produced** `ArenaSliceSpec` { extentCm 1000, elevated/highGround thresholds, tacticalPoints } mapped 1:1 to the UE struct._
- [x] 3. Cover & LoS Rules  
  _agent: Designer · **reuse** `AARPGCoverPoint` (`ECoverType`, `ProvidesCoverFrom`, peek positions, claim/release) + **produced** `ArenaSliceSpec.cover` (4 pillars at ±850 cm, matching `build_arena.py`'s corner pillars)._
- [x] 4. Spawn & Wave Logic  
  _agent: Designer · **reuse** `ASpawnVolume` (`FSpawnWaveConfig`, kill-gated advancement, `MaxConcurrentEnemies`, difficulty scaling) + `AARPGEncounterVolume` (`EEncounterPosition` arc) + **produced** `ArenaSliceSpec.waves` with **cross-catalog `bestiary` links** (`kath-hound`, `mandalorian-warrior`)._
- [~] 5. Win/Loss Condition Rules  
  _agent: Designer · **produced** `winCondition`/`lossCondition` + validator coherence (e.g. `survive-duration` requires `survivalSeconds`; `defeat-boss` requires `position:boss`). ⚠️ **partial**: `ASpawnVolume` exposes `OnAllWavesComplete`/`OnWaveStarted` delegates but there is **no first-class win/loss rule-evaluator** actor — the spec encodes intent; runtime evaluation is a gap._
- [x] 6. Encounter Balancing  
  _agent: Balancer · **reuse** `ASpawnVolume` difficulty knobs (base level / scale-per-level / max-multiplier) + the `EEncounterPosition` arc + **produced** those fields on the spec + the **vitest balance gate** (`validateArenaSlice` invariants). 🔗 bestiary danger-rank could feed auto-budgeting._
- [x] 7. Environmental Hazards Logic  
  _agent: Designer · **reuse** `AARPGEnvironmentalHazard` (`EHazardType`, periodic/one-shot/cycle, GE damage via SetByCaller, `bAIAvoidance` NavModifier, zone-difficulty scaling) + **produced** `ArenaSliceSpec.hazards` (fire-floor, 15/tick @ 1 s)._
- [x] 8. Terrain Mesh & Props  
  _agent: 3DGen · **reuse** the proven `Content/ArenaBuild/build_arena.py` (Blender → `Arena.fbx`: 20 m floor + 5 m walls + 4 corner pillars, world-aligned UVs) + `ARPGEnvironmentalProp`. Not re-authored this session — the mesh exists._
- [x] 9. Material Pass  
  _agent: VFX/Material · **reuse** the arena materials authored by `build_arena.py` (`M_Floor`/`M_Wall`/`M_Pillar`) + `Content/Python/retexture_arena_ue.py`. 🔗 the `materials` catalog (a concurrent "Weathered Stone" row is the natural surface for these)._
- [x] 10. Lighting Pass  
  _agent: Packager · **reuse**: gated directly by `VSArenaSetupTest` (asserts DirectionalLight + SkyLight + PostProcessVolume present). Movable lights for headless cooks (Lightmass skipped)._
- [ ] 11. Ambient VFX  
  _agent: VFX · ⚠️ **GAP** + 🔗: no Niagara authoring pipeline (the same gap the Fireball row logged). The hazard has a `HazardVFXSystem` slot; 🔗 bind to the `vfx` presentation catalog once authored._
- [ ] 12. Ambient SFX & Music Cue  
  _agent: Audio · ⚠️ **GAP** + 🔗: `import_audio_set` + the `audio`/`ambient`/`music` catalogs exist, but no soundscape authored. The hazard exposes `HazardSound`/`WarningSound` slots (unbound)._
- [ ] 13. Camera Behavior  
  _agent: VFX · ⚠️ **GAP**: no camera-feedback/shake system in PoF (the same gap the Fireball row logged)._
- [x] 14. Playtest Balance Gate  
  _agent: QA · **produced** (app layer): the `validateArenaSlice` vitest gate — UE-invariant clamps + win/loss coherence + **cross-catalog integrity** (every wave archetype must resolve to a seeded bestiary entity). ⚠️ a bot-driven *runtime* playtest is a gap (see register)._
- [x] 15. UE Level Packaging  
  _agent: Packager · **reuse**: the placed arena map + the **three committed arena functional tests** (`VSArenaSetupTest` / `VSArenaBoundsTest` / `VSArenaCollisionTest`) ARE the packaged, gated UE asset. Bound the Arena Slice `verify` to `VSArenaSetupTest` via `COMBAT_MAP_RECIPE` (the same gate `zone-map` reuses). ⚠️ the spec→placement bridge (`build_arena_slice.py`) + a data-driven *rules* test are gaps._

## PoF integration
- **Catalog:** `combat-map` (already registered). Added a real entity **`arena-ravaged-courtyard`** alongside the legacy combo entries (the catalog now holds both shapes).
- **Data schema:** `ArenaSliceSpec` (`src/lib/catalog/arena-slice.ts`) — every field maps 1:1 to a UE struct/enum (`FArenaTacticalPoint`/`EArenaTier`, `ECoverType`, `FSpawnWaveConfig`, `EHazardType`, `EEncounterPosition`). Discriminated from `ComboSequence` by `kind:'arena-slice'`; persisted via the catalog `data` field.
- **Code touched (app, verified `npx vitest`/`eslint`/`tsc` clean on these files):** `arena-slice.ts` (new schema+validator+seed), `types.ts` (`ArenaSliceEntry`), `seed-combat-map.ts` (`arenaSliceToEntry`/`seedArenaSliceEntries`), `sections.ts` (compose both seeds), `recipe.ts` (`COMBAT_MAP_RECIPE` now branches arena↔combo), `CombatMapDetailFacet.tsx` (renders arena waves/cover/win-loss), + `arena-slice.test.ts` (the design/balance gate, 14 cases).
- **Test gate:** the structural UE arena asset **exists and its gate passes** (the three committed arena tests — reused). The app design/balance gate **passes** this session. The data-driven *encounter-rules* gate is the documented blocker (below).
- **Reuse:** `AARPGEncounterArena` · `ASpawnVolume` · `AARPGEncounterVolume` · `AARPGCoverPoint` · `AARPGEnvironmentalHazard` · `build_arena.py`/`retexture_arena_ue.py`/`place_arena_tests.py` · `VSArena{Setup,Bounds,Collision}Test`.
- **Gaps:** spec→placement Python bridge, win/loss rule evaluator, Niagara VFX, soundscape, camera feedback, bot playtest, data-driven rules test.

## Cross-catalog dependencies
- **`bestiary` → kath-hound, mandalorian-warrior** (the wave spawns; wired as real `links` with role `spawn`, asserted to resolve).
- **`materials`** (arena floor/wall/pillar surfaces — a concurrent "Weathered Stone" row fits).
- **`vfx` / `ambient` / `music`** (hazard + arena ambience — shared presentation catalogs).
- **`zone-map`** (an Arena Slice is the encounter that an `AARPGEncounterVolume` hosts inside a zone — `EEncounterPosition` is the shared seam).

## Session Findings
### Cross-catalog opportunities
- **The `combat-map` catalog had an identity split** — registered/described as "tactical encounter arenas" but seeded only with weapon combos (`ComboSequence`). The Arena Slice is the bridge: one catalog, two `data` shapes (`kind:'arena-slice'` vs combo). Other "existing" catalogs may have similar legacy-seed vs intended-meaning drift worth auditing.
- **An Arena Slice is the unit a `zone-map` encounter hosts.** `AARPGEncounterVolume` already extends `ASpawnVolume` with `EEncounterPosition`; a zone's encounter groups *are* arena slices placed at arc positions. The two catalogs should share the wave/position vocabulary — a zone row can compose arena-slice rows.
- **Bestiary danger-rank → encounter auto-budgeting.** Waves already cross-link to bestiary archetypes; the bestiary carries danger ranks. A future balancer could solve wave counts for a target difficulty (the loot Goal-Seek analogue, for encounters).
- **Hazards are a `status-effects`/GAS consumer too.** `AARPGEnvironmentalHazard` applies a `UGameplayEffect` — a fire-floor's GE is the same artifact as a `status-effects` "Burning" / the Fireball DoT. One GE seeds hazard + status + ability.

### Gaps / blockers for future sessions
- **No spec→placement bridge.** The data-driven Arena Slice can't yet *place* itself: there's no `build_arena_slice.py` that reads the spec and spawns `AARPGEncounterArena` + cover + an `ASpawnVolume` (waves from `FSpawnWaveConfig`) + hazards into the arena map. Highest-value next step — it makes the whole catalog→UE arena loop real. (Pattern exists: extend `build_arena.py`/`place_arena_tests.py`.)
- **No win/loss rule evaluator.** `ASpawnVolume` fires `OnAllWavesComplete`/`OnWaveStarted` but nothing evaluates a `WinCondition`/`LossCondition` and ends the encounter. The spec encodes the rules; runtime needs a small encounter-state actor/component.
- **No data-driven encounter-rules test.** The reused arena tests gate geometry/lighting/collision, not *rules* (wave count, archetypes, win-on-clear). A `VSArenaSliceRulesTest` (build an `ASpawnVolume` from the spec, assert wave config + completion) would gate runtime behaviour — the encounter analogue of Fireball's missing "apply-GE-to-dummy-ASC" harness. (Several `ASpawnVolume` fields are `protected`; the test needs reflection or a friend/test accessor.)
- **No Niagara VFX, no soundscape, no camera-feedback systems** — the same shared-infra gaps every presentation-bearing catalog hits (logged by the Fireball row). Hazard/arena slots exist but are unbound.
- **Shared-tree concurrency observed.** A concurrent CLI was editing the same app repo this session (materials/character catalog rows landed in `recipe.ts`/`types.ts`/`sections.ts`); `npm run typecheck` shows a **foreign** failure in `visual-gen/asset-viewer/AssetInspector.tsx` (not mine — my files are `tsc`/`eslint` clean). Stage narrowly; don't fix foreign breakage.
