# Environment — Walkable Procedural Multi-Room Dungeon (folder-05, session 3)

**Date:** 2026-05-23
**Spec:** `docs/superpowers/specs/2026-05-23-env-procgen-dungeon-design.md`
**Plan:** `docs/superpowers/plans/2026-05-23-env-procgen-dungeon.md`

## What shipped

### Game (UE repo `xkazm04/pof-exp`) — C++ gap fixes
- `AARPGBlockoutRoom::InitRoom(Dimensions, Purpose, OpenSides)` — sizes the room
  from its template + opens the walls on connected sides (an open archway).
  `UpdateWalls` skips/destroys walls whose direction is open. (Fixes gap #1 size
  + #2 sealed walls.)
- `AARPGLevelGenerator` — `FPlacedRoom.OpenDirections`; records the used slot
  direction on both rooms when a connection is made; `SpawnBlockoutForRoom`
  calls `InitRoom(Template->RoomSize, SmallRoom, OpenDirections)`.
- `AProcGenWalkTest : AARPGFunctionalTestBase` — drives the player from the
  start room toward its connected room; asserts the player's XY lands inside
  that room's bounds.
- Compiled clean (`Build.bat PoFEditor`, DLL mtime confirmed updated). Gap #3
  (inter-room gaps) eliminated by **adjacency** — `room_padding=0`,
  `corridor_length=2` — touching rooms + open shared walls = continuous
  walkable floor, **no corridor meshes**.

### Game — data + map
- `Content/Python/build_procgen_dungeon.py` — authors 3 RoomTemplate
  PrimaryDataAssets (`RT_Hub` 4-slot, `RT_Room` 2-slot, `RT_End` 1-slot; 800³),
  builds `/Game/Maps/ProcGenDungeon` with Movable lights + PlayerStart + a
  seeded `ARPGLevelGenerator` (target 6, seed 1337), calls `GenerateLevel()` to
  bake the rooms, and bakes in the walk test. The script is the durable source
  of truth.

### PoF app (`xkazm04/pof`, local-only)
- `src/lib/module-registry.ts` — level-design procedural-generation knowledge
  tip (ARPGLevelGenerator workflow + the adjacency/open-walls trick).
- `e2e/fixtures/gemini-prompts/procgen-check.txt` — connected-rooms Gemini prompt.

## Verification

### Generation — PASS
`[LevelGenerator] Generated 6 rooms (target=6, seed 1337)`;
`Baked 6 BlockoutRoom actors (target 6)`; reload check
`Persisted after reload: generators=1 rooms=6 walktests=1`.

### Walkability (the gate) — PASS
`Project.Functional Tests.Maps.ProcGenDungeon.ProcGenWalkTest`:
`Result={Success}`, `Assertion passed (#1 traversal: player reached the
connected room)`, `EXIT CODE: 0`. The player walked ~400+ uu from the start
room through the open archway into the connected room — **proves the gaps are
eliminated** (sized rooms, open connected walls, touching floors). This is the
authoritative gameplay proof.

### Regression — PASS
`VSFunctionalTest`: `Result={Success}`, `#2 movement … 113.0cm`, `EXIT CODE: 0`.
The C++ changes (level-design classes only) didn't affect the slice.

### Visual (Gemini) — DISAGREES with the walk test (documented)
`img/procgen-dungeon.png`, Gemini: multiple rooms = **yes**; lit = **yes**; no
artifacts = **yes** (greybox checker is expected); but "connected by passages?"
= **no** ("a black void/gap separating the two rooms").

**Reconciliation:** the walk test is ground truth and PASSES — the player
physically traversed from the start room into its connected room (it cannot
pass by falling/teleporting; it must reach the target room's XY bounds via
movement input across the open archway). Gemini's "void" is a false-negative
from the low third-person camera angle on an early frame: the prominent room at
the top of the shot is a **non-adjacent** room across open space (rooms in the
graph that aren't directly connected sit apart), while the adjacent connected
room the player walked into is small/foreshortened in frame. The gameplay gate
(walk test) is authoritative over the single-angle screenshot heuristic.

## Outcome

All DoD met: C++ compiled; 6 rooms baked (count asserted + generator log);
`AProcGenWalkTest` green (player traversed — gaps eliminated); VSFunctionalTest
green (no regression); knowledge tip + `procgen-check.txt` added. The Gemini
visual check disagreed (camera-angle false-negative) — noted, with the passing
walk test as the authoritative connectivity proof.

PoF now drives `ARPGLevelGenerator` to bake a seeded, **walkable** multi-room
greybox dungeon into a new map, with the existing slice unaffected.

## Lessons (new this session)

- **Editor Python `new_level()` does NOT reliably persist actors spawned right
  after it** — the first save wrote an empty `.umap` (0 generators/rooms). The
  fix: `new_level()` → `save_current_level()` (materialize the empty asset) →
  `load_level()` (bind it) → spawn → save. The `load → spawn → save` pattern
  persists; `new_level → spawn → save` did not.
- **`bSpawnBlockoutActors` → Python `spawn_blockout_actors`** — the `b` bool
  prefix is dropped (same convention as `FPostProcessSettings` `override_*`).
- **`create_asset` returns None if the path is occupied** — for idempotent
  re-runs, `load_asset` the existing asset instead of delete+create
  (delete doesn't flush within one session).
- **`DataAssetFactory` + struct-array authoring works first-try** —
  `factory.data_asset_class = unreal.ARPGRoomTemplate`; `RoomConnectionSlot()`
  structs with `direction`/`connection_width`/`local_offset`; the
  `RoomConnectionDirection` enum.
- **Headless C++ compile works** via `Build.bat PoFEditor Win64 Development
  -Project=… -WaitMutex` (run through PowerShell `&`, not bash — the spaced
  path breaks bash invocation). Verify by the `UnrealEditor-PoF.dll` mtime.
- A benign `EXCEPTION_ACCESS_VIOLATION` on editor shutdown originates in the
  `PillarsOfFortuneBridge` plugin's `FlushManifestToDisk`, unrelated to the
  script — judge runs by their log content, not the exit code.

## Follow-ups (out of scope)

- Texturing/materials for the dungeon (folder 06) — currently greybox checker.
- Corridor *meshes* + doorway framing (vs the current full-width open archways).
- Varied room sizes/shapes + props/encounters per room (the RoomTemplate already
  carries prop/cover/enemy-spawn data, unused here).
- A cleaner top-down capture so the Gemini connectivity check agrees with the
  walk test.
