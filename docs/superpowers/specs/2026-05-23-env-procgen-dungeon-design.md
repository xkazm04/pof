---
date: 2026-05-23
status: draft
sub_project: Environment — walkable procedural multi-room dungeon (improvements folder 05, session 3)
parent_initiative: PoF ARPG vertical slice — improvements synthesis
predecessor_docs:
  - docs/improvements/05-environment/game.md   # §3 procedural level via ARPGLevelGenerator
  - docs/improvements/05-environment/README.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-arena-polish.md
  - docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-lightmass-bake.md
---

# Environment — Walkable Procedural Multi-Room Dungeon

## Context

Folder-05 sessions 1 (arena polish) and 2 (Lightmass bake) are done. This
session does §3: drive the project's existing `ARPGLevelGenerator` to produce a
**walkable** connected multi-room dungeon in a NEW map, moving the environment
from "one arena" toward "a small dungeon."

### Current state (verified by reading the source)

- `Source/PoF/LevelDesign/ARPGLevelGenerator.{h,cpp}` — a real generator:
  `GenerateLevel()` (BlueprintCallable) places rooms by connecting open slots
  (weighted-random template pick, AABB overlap test), then spawns one
  `AARPGBlockoutRoom` per room. Logs `[LevelGenerator] … Generated N rooms`.
- `Source/PoF/World/ARPGBlockoutRoom.{h,cpp}` — `OnConstruction` builds a
  collidable floor (engine cube scaled flat, `BlockAll`) + 4 fully-sealed walls
  (`BlockAll`) when `bGenerateWalls` (default true). `RoomDimensions` default
  800×800×300.
- `Source/PoF/LevelDesign/ARPGRoomTemplate.{h}` — `UPrimaryDataAsset` with
  `RoomSize`, `ConnectionSlots` (`FRoomConnectionSlot`: LocalOffset, Direction
  N/S/E/W, ConnectionWidth), props/cover/weights.

### The three scaffolding gaps (this session eliminates them)

1. **Uniform size** — `SpawnBlockoutForRoom` (ARPGLevelGenerator.cpp ~L304)
   does NOT pass the template's `RoomSize` to the spawned room; every room
   renders at the BlockoutRoom default (800×800×300).
2. **Sealed walls** — `AARPGBlockoutRoom::UpdateWalls` builds 4 solid walls
   with no doorways; connected rooms can't be traversed.
3. **Inter-room gaps** — rooms are placed `CorridorLength` (200–600 uu) apart
   and no corridor geometry is spawned.

## Goals

1. A new map `/Game/Maps/ProcGenDungeon` whose rooms are procedurally
   generated (seeded, deterministic), sized per their templates, and
   **traversable** — the player can walk from the start room into connected
   rooms.
2. VerticalSlice + `VSFunctionalTest` untouched (no regression to sessions 1-2).
3. The generation is driven by a committed **idempotent placement script**
   (the durable source of truth, not the binary map).

## Non-goals

- Not replacing the VerticalSlice arena (that was the rejected option 3).
- No props, audio, textures/materials beyond greybox.
- **No separate corridor geometry** — walkability via adjacency (touching
  rooms + open shared walls), see the design.
- No procedural variation beyond the 3 authored templates + the seed.
- Not a navmesh-built connectivity test — walkability is proven by **driven
  player movement** (a functional test), matching `VSFunctionalTest`.

## Decision record (from brainstorming)

1. **Data-only topology demo PLUS option 2 (C++ gap fixes)** — the user folded
   the walkable-dungeon option into the package.
2. **Adjacency over corridors** — place connected rooms edge-to-edge
   (`RoomPadding=0`, `CorridorLength≈0`) and open the shared walls; two touching
   rooms minus the shared wall = one continuous walkable floor with a full-width
   archway. Avoids building corridor meshes (the hardest gap).
3. **New map**, **edit-time bake** (`GenerateLevel()` called from editor Python
   bakes the rooms into the saved map), **C++ recompile** accepted.
4. Sibling sessions are **stopped** for this session — the shared-tree
   collision/DLL-lock risk ([[ue-shared-concurrency]]) is removed.

## Design

### Part 1 — C++: eliminate gaps #1 and #2

**`AARPGBlockoutRoom` (`Source/PoF/World/ARPGBlockoutRoom.{h,cpp}`):**
- Add a stored open-sides set + a public initializer:
  ```cpp
  UFUNCTION(BlueprintCallable, Category = "Blockout")
  void InitRoom(FVector Dimensions, EBlockoutRoomPurpose Purpose,
                const TArray<ERoomConnectionDirection>& OpenSides);
  ```
  It sets `RoomDimensions`, `RoomPurpose`, stores `OpenSides`, then re-runs
  `UpdateFloorScale()` + `UpdateWalls()`.
- `UpdateWalls` **skips the wall on each open side**. Direction→wall index:
  North(+X)→0, South(−X)→1, East(+Y)→2, West(−Y)→3. (When a wall index is in
  the open set, don't create/keep it; destroy an existing one.)
- Include `LevelDesign/ARPGRoomTemplate.h` for `ERoomConnectionDirection`.

This fixes gap #1 (size now driven by the template) and gap #2 (connected
sides are open archways).

### Part 2 — C++: generator passes size + open directions; adjacency

**`AARPGLevelGenerator` (`.h`/`.cpp`):**
- `FPlacedRoom` gains `TArray<ERoomConnectionDirection> OpenDirections`.
- When a connection is made in `GenerateLevel()`, record the used slot's
  direction on BOTH rooms (existing room's used slot direction; new room's
  used slot direction).
- `SpawnBlockoutForRoom` calls
  `Blockout->InitRoom(Room.Template->RoomSize, <purpose>, Room.OpenDirections)`
  (purpose mapped from `RoomTemplate->RoomPurpose` name, default `SmallRoom`).
- Adjacency: the placement defaults change so connected rooms touch —
  `RoomPadding` default 0, and the generator placement uses a near-zero
  corridor length (configure via the data script: `MinCorridorLength` =
  `MaxCorridorLength` = a small value, e.g. 10 uu — negligible, bridged by the
  capsule; the overlap test passes since `Delta ≥ Combined`).

(Gap #3 eliminated by adjacency — no corridor meshes.)

### Part 3 — Data + map (Python, edit-time bake)

`Content/Python/build_procgen_dungeon.py` — one idempotent script:
1. Author 3 `UARPGRoomTemplate` assets under `/Game/Level/RoomTemplates/`
   (via `DataAssetFactory` with `data_asset_class = unreal.ARPGRoomTemplate`):
   - `RT_Hub` — 800³, 4 slots (N/S/E/W at the room edges, width 300).
   - `RT_Room` — 800³, 2 slots (N + S).
   - `RT_End` — 800³, 1 slot (S).
   Slots are `unreal.RoomConnectionSlot` structs (local_offset at the edge,
   direction, connection_width 300).
2. Create `/Game/Maps/ProcGenDungeon` (`LevelEditorSubsystem.new_level`);
   spawn Movable DirectionalLight + SkyLight (lit, no bake), a `PlayerStart`
   in the start room, set the level's GameMode to `BP_VSGameMode` (a
   controllable pawn for the walk test).
3. Spawn + configure an `AARPGLevelGenerator` (`set_editor_property` on its
   protected UPROPERTYs): `room_template_pool=[RT_Room]`,
   `start_room_template=RT_Hub`, `end_room_template=RT_End`,
   `target_room_count=6`, fixed `random_seed` (e.g. 1337),
   `room_padding=0`, `min/max_corridor_length=10`, `b_spawn_blockout_actors=True`.
4. Call `generator.call_method("GenerateLevel")` (edit-time bake).
5. Count `AARPGBlockoutRoom` actors → assert == 6; save the level.

Run via the full editor (`-ExecutePythonScript`, self-quit) — same harness as
`build_arena_ue.py`.

### Part 4 — Traversal functional test (C++)

`AProcGenWalkTest : AFunctionalTest` (`Source/PoF/Test/ProcGenWalkTest.{h,cpp}`,
placed in ProcGenDungeon) — modeled on `VSFunctionalTest`'s movement phase:
- On start, find the `AARPGLevelGenerator`, read room 0 (start) and a known
  connected room's world position + bounds.
- Possess the player pawn at room 0; apply movement input toward the connected
  room for a few seconds (phased Tick).
- Assert the pawn's final XY is inside the connected room's bounds (it walked
  through the open archway). One assertion: `#1 traversal: player reached the
  connected room`.

This is the walkability gate — if the wall were still sealed or a gap blocked
the path, the pawn wouldn't arrive.

### Part 5 — PoF app

- `src/lib/module-registry.ts` — level-design knowledge tip: the
  `ARPGLevelGenerator` workflow (author RoomTemplate assets → configure
  generator → `GenerateLevel`), and that the size/sealed-wall/gap gaps are now
  fixed in C++ (adjacency + open shared walls + size pass-through).
- `e2e/fixtures/gemini-prompts/procgen-check.txt` — "multiple distinct
  rectangular rooms connected by open passages (not sealed separate boxes)?".

## Verification (of this session)

Passes when: the project recompiles clean; `build_procgen_dungeon.py` bakes
6 rooms (Python count == 6 + the generator log); `AProcGenWalkTest` is **green**
(the player traverses from the start room into a connected room — proves the
gaps are eliminated); a top-down screenshot + Gemini confirm multiple rooms
connected by open passages; `VSFunctionalTest` still green (no regression).
PoF: the knowledge tip + the `procgen-check` fixture exist.

## Cross-cutting

- **Sibling sessions stopped** — safe to recompile (`Build.bat PoFEditor Win64
  Development -project=…`); confirm no live `UnrealEditor.exe` locks
  `Binaries/Win64/UnrealEditor-PoF.dll`, and verify the DLL mtime is newer than
  the source edits ([[ue-shared-concurrency]]).
- **Full editor for Python** ([[arena polish findings]]): the placement script
  runs via `-ExecutePythonScript`; it self-quits.
- Functional tests run headless via `UnrealEditor-Cmd … -ExecCmds="Automation
  RunTests <path>;Quit" -nullrhi -abslog="…"` (isolated log).
- Repos: C++ + the placement script + RoomTemplate/map assets → UE repo
  (`xkazm04/pof-exp`). Knowledge tip + Gemini fixture + spec/plan/findings →
  app repo (`xkazm04/pof`, local-only, do NOT push).

## Definition of done

1. C++: `AARPGBlockoutRoom::InitRoom` + `UpdateWalls` honors open sides;
   `AARPGLevelGenerator` records open directions + passes size/open-sides to
   spawned rooms + adjacency placement; `AProcGenWalkTest` added. Project
   recompiles clean (DLL mtime confirmed newer).
2. `build_procgen_dungeon.py` authors 3 RoomTemplates, builds ProcGenDungeon,
   bakes 6 rooms (count asserted), saves.
3. `AProcGenWalkTest` green (player traverses rooms).
4. Room count == 6 (Python + generator log); Gemini confirms connected rooms
   with open passages.
5. `VSFunctionalTest` still green.
6. PoF: knowledge tip + `procgen-check.txt` fixture.
7. Findings doc; committed (C++/scripts/assets → UE repo; docs/app → app repo).

**Success criterion:** PoF drives `ARPGLevelGenerator` to bake a seeded,
walkable, multi-room greybox dungeon into a new map — rooms sized per template,
connected by open archways, traversable (functional test proves it) — with the
existing slice unaffected.

## Risks & mitigations

- **C++ recompile (the heaviest part).** Compile errors → iterate; verify the
  DLL mtime is newer than the edits before trusting a run. Mitigation: small,
  self-contained changes; sibling sessions are stopped (no DLL lock / build-
  state confusion).
- **Walk test timing/tuning** (movement functional tests are fiddly — the HUD
  and Characters work showed this). Mitigation: model exactly on
  `VSFunctionalTest`'s working movement phase; generous settle; a structural
  fallback (assert rooms touch + connected-side walls open + connected graph)
  if driven movement proves too flaky.
- **Edit-time `GenerateLevel()` may not persist spawned actors** the way PIE
  does. Mitigation: count `AARPGBlockoutRoom` actors after the call and before
  save; if zero, fall back to `bGenerateOnBeginPlay` + a PIE/`-game` capture.
- **`DataAssetFactory` / struct-array authoring via Python** may need exact
  property names (`connection_slots`, `room_size`, `local_offset`,
  `connection_width`, `RoomConnectionDirection` enum). Mitigation: read back
  each authored asset's properties and log; guard with try/except like prior
  sessions' API-name discoveries.
- **Adjacency overlap-test boundary** — if rooms reject as overlapping, nudge
  `MinCorridorLength` up slightly; if they gap, nudge down. Verify by the walk
  test + screenshot.

## Next steps after this spec

1. Spec self-review (inline).
2. User reviews + approves.
3. `writing-plans` → implementation plan.
4. Execute: C++ (BlockoutRoom + generator + walk test) → recompile → placement
   script → bake → verify (count + walk test + Gemini) → findings.
