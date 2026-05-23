# Walkable Procedural Multi-Room Dungeon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drive `ARPGLevelGenerator` to bake a seeded, walkable multi-room greybox dungeon into a new map `/Game/Maps/ProcGenDungeon`, eliminating the size/sealed-wall/gap scaffolding gaps in C++, with the existing VerticalSlice untouched.

**Architecture:** C++ fixes the gaps — `AARPGBlockoutRoom::InitRoom` sizes the room + opens walls on connected sides; `AARPGLevelGenerator` records each room's connected directions and passes size + open-sides to spawned rooms; **adjacency** (padding 0, corridor ≈2 uu) makes touching rooms with open shared walls form a continuous walkable floor (no corridor meshes). A Python placement script authors RoomTemplate assets, builds the map, and calls `GenerateLevel()` to bake the rooms at edit-time. An `AProcGenWalkTest` functional test drives the player from the start room into a connected room to prove walkability.

**Tech Stack:** UE 5.7 C++ (`AFunctionalTest`/`AARPGFunctionalTestBase`, `unreal` editor Python), `Build.bat`, the `e2e/helpers` verification primitives, TypeScript (PoF app, vitest).

**Spec:** `docs/superpowers/specs/2026-05-23-env-procgen-dungeon-design.md`

---

## Environment constants

```
UE_ROOT  = "C:\Program Files\Epic Games\UE_5.7\Engine"
UE_CMD   = "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
UE_EDIT  = "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe"
BUILD    = "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat"
UPROJECT = "C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject"
DLL      = "C:\Users\kazda\Documents\Unreal Projects\PoF\Binaries\Win64\UnrealEditor-PoF.dll"
SHOTS    = "C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Screenshots\WindowsEditor"
GEMINI   = "C:\Users\kazda\kiro\personas\.claude\skills\leonardo\tools\gemini-recognize.mjs"
PERSONAS = "C:\Users\kazda\kiro\personas"
```

**Established facts (verified):**
- Project `GlobalDefaultGameMode = /Game/VerticalSlice/BP_VSGameMode.BP_VSGameMode_C` — **any** map uses it, spawning a controllable `AARPGPlayerCharacter`. ProcGenDungeon needs **no** GameMode override.
- `PoF.Build.cs` already depends on `FunctionalTesting`, `NavigationSystem`, `AIModule` — **no Build.cs change**.
- `AARPGFunctionalTestBase::StartTest` requires only the Player (not an Enemy) — safe to extend for the no-enemy proc map.
- Lessons carried: full editor (`-ExecutePythonScript`) for level Python; headless UE exits non-zero on shutdown (judge by log); `-abslog` for functional tests; PowerShell `Start-Process` ExecCmds quoting (one verbatim arg string); Gemini key from `personas/.env`.
- **Sibling sessions are stopped** — safe to recompile; still commit narrowly. App repo (`xkazm04/pof`) local-only; UE repo (`xkazm04/pof-exp`) pushable.

---

## File Structure

**UE project (`C:\Users\kazda\Documents\Unreal Projects\PoF`):**
- Modify: `Source/PoF/World/ARPGBlockoutRoom.h` / `.cpp` — `InitRoom(dims, purpose, openSides)` + `UpdateWalls` skips open sides.
- Modify: `Source/PoF/LevelDesign/ARPGLevelGenerator.h` / `.cpp` — `FPlacedRoom.OpenDirections`; record on connect; `SpawnBlockoutForRoom` calls `InitRoom`.
- Create: `Source/PoF/Test/Environment/ProcGenWalkTest.h` / `.cpp` — traversal functional test.
- Create: `Content/Python/build_procgen_dungeon.py` — RoomTemplates + map + bake (the durable placement script).

**PoF app (`C:\Users\kazda\kiro\pof`):**
- Modify: `src/lib/module-registry.ts` — level-design procedural-generation knowledge tip.
- Create: `e2e/fixtures/gemini-prompts/procgen-check.txt` — Gemini prompt.

**Docs (PoF app):**
- Create: `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-dungeon.md` — findings.

---

## Task 1: PoF — knowledge tip + Gemini fixture

**Files:**
- Modify: `src/lib/module-registry.ts` (level-design `knowledgeTips`)
- Create: `e2e/fixtures/gemini-prompts/procgen-check.txt`

- [ ] **Step 1: Add the procedural-generation knowledge tip**

In `src/lib/module-registry.ts`, the `level-design` module's `knowledgeTips` array ends with the lighting tip from session 2. Find that last tip line (it begins `{ title: 'UE5 lighting: Movable`) and add a new entry immediately after it (before the closing `],`):

```typescript
      { title: 'Procedural levels: ARPGLevelGenerator + RoomTemplate data assets', content: 'The project has a working ARPGLevelGenerator (graph room placement, weighted templates, AABB overlap, seeded). Drive it: author UARPGRoomTemplate PrimaryDataAssets (RoomSize, ConnectionSlots with N/S/E/W direction + edge offset), set the generator pool/start/end + target count + seed, call GenerateLevel() (BlueprintCallable — works from editor Python to bake rooms into a saved map). For a WALKABLE dungeon: place connected rooms adjacent (RoomPadding=0, tiny CorridorLength) and open the shared walls (AARPGBlockoutRoom::InitRoom sets dimensions + which sides are open archways) — touching rooms minus the shared wall = one continuous floor, no corridor meshes needed.', source: 'best-practice' },
```

- [ ] **Step 2: Create the Gemini fixture**

Create `e2e/fixtures/gemini-prompts/procgen-check.txt`:

```
Look at this top-down game screenshot of a greybox level. Answer each question explicitly with yes/no. (1) Are there multiple distinct rectangular rooms (boxes/floors), not just one? (2) Do the rooms appear connected to each other by open passages / shared openings, or are they completely separate sealed boxes with no way between them? (3) Is the scene lit (you can see the room shapes), or is it black/unlit? (4) Any obvious rendering artifacts: missing textures (magenta/checkerboard), or floating geometry?
```

- [ ] **Step 3: Typecheck + lint**

Run: `cd "C:/Users/kazda/kiro/pof" && npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → expect `OK`.
Run: `npx eslint src/lib/module-registry.ts` → expect `0 errors`.

- [ ] **Step 4: Commit (PoF app — local only)**

```bash
cd "C:/Users/kazda/kiro/pof"
git add src/lib/module-registry.ts e2e/fixtures/gemini-prompts/procgen-check.txt
git commit -m "feat(level-design): procedural-generation knowledge tip + procgen Gemini fixture

ARPGLevelGenerator + RoomTemplate workflow and the adjacency/open-walls trick
for a walkable dungeon; a Gemini prompt to verify connected (not sealed) rooms.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: C++ — InitRoom, generator open-directions, walk test (edits only; compile in Task 3)

These three changes are interdependent (generator calls `InitRoom`; the walk test reads the generator) and must compile together — so edit all three here, compile + commit in Task 3.

**Files:**
- Modify: `Source/PoF/World/ARPGBlockoutRoom.h` / `.cpp`
- Modify: `Source/PoF/LevelDesign/ARPGLevelGenerator.h` / `.cpp`
- Create: `Source/PoF/Test/Environment/ProcGenWalkTest.h` / `.cpp`

- [ ] **Step 1: `ARPGBlockoutRoom.h` — include, InitRoom decl, OpenSides member**

Add the include after the existing includes (after `#include "ARPGBlockoutRoom.generated.h"` is wrong — generated.h must be last; put it before):

Find:
```cpp
#include "GameFramework/Actor.h"
#include "ARPGBlockoutRoom.generated.h"
```
Replace with:
```cpp
#include "GameFramework/Actor.h"
#include "LevelDesign/ARPGRoomTemplate.h"
#include "ARPGBlockoutRoom.generated.h"
```

Find the public section's last method (`GetRoomWorldBounds`):
```cpp
	UFUNCTION(BlueprintPure, Category = "Blockout")
	FBox GetRoomWorldBounds() const;
```
Add after it:
```cpp
	UFUNCTION(BlueprintPure, Category = "Blockout")
	FBox GetRoomWorldBounds() const;

	/** Set size + purpose + which sides are open archways (called by the generator), then rebuild. */
	UFUNCTION(BlueprintCallable, Category = "Blockout")
	void InitRoom(FVector Dimensions, EBlockoutRoomPurpose Purpose,
		const TArray<ERoomConnectionDirection>& InOpenSides);
```

Find the private members at the end:
```cpp
	/** Dynamically created wall meshes. Order: +X, -X, +Y, -Y */
	UPROPERTY()
	TArray<TObjectPtr<UStaticMeshComponent>> WallMeshes;
```
Add after it:
```cpp
	/** Sides with an open archway (no wall) — set by InitRoom from the generator. */
	UPROPERTY()
	TArray<ERoomConnectionDirection> OpenSides;
```

- [ ] **Step 2: `ARPGBlockoutRoom.cpp` — InitRoom + open-side-aware UpdateWalls**

Add the `InitRoom` implementation after `GetRoomWorldBounds` (end of file, before the final brace is not needed — append after the `FBox ...GetRoomWorldBounds` function):

```cpp
void AARPGBlockoutRoom::InitRoom(FVector Dimensions, EBlockoutRoomPurpose Purpose,
	const TArray<ERoomConnectionDirection>& InOpenSides)
{
	RoomDimensions = Dimensions;
	RoomPurpose = Purpose;
	OpenSides = InOpenSides;
	UpdateFloorScale();
	UpdateWalls();
	if (BoundsIndicator)
	{
		BoundsIndicator->ShapeColor = GetPurposeColor();
	}
}
```

Replace the entire existing `UpdateWalls()` body with an open-side-aware version (skips + destroys walls on open sides; same geometry math otherwise):

```cpp
void AARPGBlockoutRoom::UpdateWalls()
{
	if (!bGenerateWalls)
	{
		for (UStaticMeshComponent* Wall : WallMeshes)
		{
			if (Wall) Wall->DestroyComponent();
		}
		WallMeshes.Empty();
		return;
	}

	UStaticMesh* CubeMesh = FloorMesh ? FloorMesh->GetStaticMesh() : nullptr;
	if (!CubeMesh) return;

	while (WallMeshes.Num() < 4)
	{
		WallMeshes.Add(nullptr);
	}

	const float HalfX = RoomDimensions.X * 0.5f;
	const float HalfY = RoomDimensions.Y * 0.5f;
	const float HalfZ = RoomDimensions.Z * 0.5f;
	const float HalfThick = WallThickness * 0.5f;

	struct FWallDef { ERoomConnectionDirection Dir; int32 Index; FVector Loc; FVector Scale; };
	const FWallDef Defs[4] = {
		// +X = North
		{ ERoomConnectionDirection::North, 0, FVector(HalfX + HalfThick, 0.f, HalfZ),
		  FVector(WallThickness / 100.f, RoomDimensions.Y / 100.f, RoomDimensions.Z / 100.f) },
		// -X = South
		{ ERoomConnectionDirection::South, 1, FVector(-HalfX - HalfThick, 0.f, HalfZ),
		  FVector(WallThickness / 100.f, RoomDimensions.Y / 100.f, RoomDimensions.Z / 100.f) },
		// +Y = East
		{ ERoomConnectionDirection::East, 2, FVector(0.f, HalfY + HalfThick, HalfZ),
		  FVector((RoomDimensions.X + WallThickness * 2.f) / 100.f, WallThickness / 100.f, RoomDimensions.Z / 100.f) },
		// -Y = West
		{ ERoomConnectionDirection::West, 3, FVector(0.f, -HalfY - HalfThick, HalfZ),
		  FVector((RoomDimensions.X + WallThickness * 2.f) / 100.f, WallThickness / 100.f, RoomDimensions.Z / 100.f) },
	};

	for (const FWallDef& D : Defs)
	{
		if (OpenSides.Contains(D.Dir))
		{
			if (WallMeshes[D.Index])
			{
				WallMeshes[D.Index]->DestroyComponent();
				WallMeshes[D.Index] = nullptr;
			}
		}
		else
		{
			CreateOrUpdateWall(D.Index, D.Loc, D.Scale);
		}
	}
}
```

- [ ] **Step 3: `ARPGLevelGenerator.h` — OpenDirections on FPlacedRoom**

Find in `FPlacedRoom`:
```cpp
	/** Indices of connected rooms. */
	UPROPERTY(BlueprintReadOnly, Category = "Generation")
	TArray<int32> ConnectedRoomIndices;
```
Add after it:
```cpp
	/** Directions whose wall is an open archway to a connected room. */
	UPROPERTY(BlueprintReadOnly, Category = "Generation")
	TArray<ERoomConnectionDirection> OpenDirections;
```

- [ ] **Step 4: `ARPGLevelGenerator.cpp` — record open directions + call InitRoom**

In `GenerateLevel()`, find the placement block where connections are recorded:
```cpp
		NewRoom.ConnectedRoomIndices.Add(ExistingRoomIdx);

		const int32 NewRoomIdx = PlacedRooms.Num();

		// Update existing room connections
		PlacedRooms[ExistingRoomIdx].ConnectedRoomIndices.Add(NewRoomIdx);
```
Replace with (records the used slot direction on both rooms):
```cpp
		NewRoom.ConnectedRoomIndices.Add(ExistingRoomIdx);
		// The new room's used slot faces NeededDir (opposite the existing slot).
		NewRoom.OpenDirections.AddUnique(NewTemplate->ConnectionSlots[CompatibleSlotIdx].Direction);

		const int32 NewRoomIdx = PlacedRooms.Num();

		// Update existing room connections
		PlacedRooms[ExistingRoomIdx].ConnectedRoomIndices.Add(NewRoomIdx);
		PlacedRooms[ExistingRoomIdx].OpenDirections.AddUnique(ExistingSlot.Direction);
```

In `SpawnBlockoutForRoom`, find:
```cpp
#if WITH_EDITOR
	Blockout->SetActorLabel(FString::Printf(TEXT("Room_%d_%s"), Room.RoomIndex, *Room.Template->TemplateID.ToString()));
#endif

	return Blockout;
```
Replace with (size + open-sides now driven from the template/graph):
```cpp
#if WITH_EDITOR
	Blockout->SetActorLabel(FString::Printf(TEXT("Room_%d_%s"), Room.RoomIndex, *Room.Template->TemplateID.ToString()));
#endif

	Blockout->InitRoom(Room.Template->RoomSize, EBlockoutRoomPurpose::SmallRoom, Room.OpenDirections);

	return Blockout;
```

(`ARPGLevelGenerator.cpp` already includes `World/ARPGBlockoutRoom.h` and `LevelDesign/ARPGRoomTemplate.h`, so `EBlockoutRoomPurpose` and `ERoomConnectionDirection` resolve.)

- [ ] **Step 5: Create `Source/PoF/Test/Environment/ProcGenWalkTest.h`**

```cpp
#pragma once

#include "CoreMinimal.h"
#include "Test/ARPGFunctionalTestBase.h"
#include "ProcGenWalkTest.generated.h"

/** Proves the generated dungeon is walkable: the player walks from the start room into a connected room. */
UCLASS()
class POF_API AProcGenWalkTest : public AARPGFunctionalTestBase
{
	GENERATED_BODY()

public:
	AProcGenWalkTest();

protected:
	virtual void OnTestStarted() override;
	virtual EARPGPhaseResult RunPhase(int32 PhaseIndex, FName PhaseName, float DeltaSeconds) override;

private:
	FVector TargetCenter = FVector::ZeroVector;
	FVector2D TargetHalfXY = FVector2D::ZeroVector;
	bool bResolved = false;
};
```

- [ ] **Step 6: Create `Source/PoF/Test/Environment/ProcGenWalkTest.cpp`**

```cpp
#include "Test/Environment/ProcGenWalkTest.h"
#include "LevelDesign/ARPGLevelGenerator.h"
#include "LevelDesign/ARPGRoomTemplate.h"
#include "Player/ARPGPlayerCharacter.h"
#include "EngineUtils.h"

AProcGenWalkTest::AProcGenWalkTest()
{
	Phases = { TEXT("WalkToConnectedRoom") };
	TimeLimit = 20.f;
}

void AProcGenWalkTest::OnTestStarted()
{
	AARPGLevelGenerator* Gen = nullptr;
	for (TActorIterator<AARPGLevelGenerator> It(GetWorld()); It; ++It) { Gen = *It; break; }
	if (!Gen)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("No ARPGLevelGenerator in the level"));
		return;
	}

	const TArray<FPlacedRoom>& Rooms = Gen->GetPlacedRooms();
	if (Rooms.Num() < 2)
	{
		FinishTest(EFunctionalTestResult::Failed,
			FString::Printf(TEXT("Need >= 2 placed rooms, found %d"), Rooms.Num()));
		return;
	}

	const FPlacedRoom& Start = Rooms[0];
	if (Start.ConnectedRoomIndices.Num() == 0)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Start room has no connections"));
		return;
	}

	const int32 TargetIdx = Start.ConnectedRoomIndices[0];
	if (!Rooms.IsValidIndex(TargetIdx) || !Rooms[TargetIdx].Template)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Connected room invalid"));
		return;
	}

	const FPlacedRoom& Target = Rooms[TargetIdx];
	TargetCenter = Target.WorldPosition;
	TargetHalfXY = FVector2D(Target.Template->RoomSize.X * 0.5f, Target.Template->RoomSize.Y * 0.5f);
	bResolved = true;
}

EARPGPhaseResult AProcGenWalkTest::RunPhase(int32 /*PhaseIndex*/, FName /*PhaseName*/, float /*DeltaSeconds*/)
{
	if (!bResolved)
	{
		// OnTestStarted already called FinishTest(Failed) — just stop driving.
		return EARPGPhaseResult::Running;
	}

	AARPGPlayerCharacter* P = GetPlayerCharacter();
	if (!P)
	{
		AssertTrue(false, TEXT("#1 traversal: no player character"));
		return EARPGPhaseResult::Fail;
	}

	const FVector Loc = P->GetActorLocation();
	const FVector Dir = (TargetCenter - Loc).GetSafeNormal2D();
	P->AddMovementInput(Dir, 1.f);

	const bool bArrived =
		FMath::Abs(Loc.X - TargetCenter.X) < TargetHalfXY.X &&
		FMath::Abs(Loc.Y - TargetCenter.Y) < TargetHalfXY.Y;

	if (bArrived)
	{
		AssertTrue(true, TEXT("#1 traversal: player reached the connected room"));
		return EARPGPhaseResult::Advance;
	}

	if (GetPhaseTime() >= 10.f)
	{
		const float Dist = FVector::Dist2D(Loc, TargetCenter);
		AssertTrue(false,
			FString::Printf(TEXT("#1 traversal: player did not reach the connected room (dist %.0f)"), Dist));
		return EARPGPhaseResult::Fail;
	}

	return EARPGPhaseResult::Running;
}
```

(No commit here — Task 3 compiles then commits all C++.)

---

## Task 3: Compile + verify the DLL + commit C++

**Files:** none (build only).

- [ ] **Step 1: Ensure no live editor locks the DLL**

Run (PowerShell): `Get-Process UnrealEditor* -ErrorAction SilentlyContinue | Select Id,ProcessName`
Expected: empty. If any are running, they'd lock `UnrealEditor-PoF.dll` and the link would fail — close them first (sibling sessions are stopped, so expect none).

- [ ] **Step 2: Record the DLL mtime, then compile**

```bash
ls -la "/c/Users/kazda/Documents/Unreal Projects/PoF/Binaries/Win64/UnrealEditor-PoF.dll"   # note the time
"/c/Program Files/Epic Games/UE_5.7/Engine/Build/BatchFiles/Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex 2>&1 | tail -40
```
Expected: ends with `Build succeeded` (or `***** ... 0 error(s)`). If there are compile errors, read them, fix the Task 2 code, re-run. Common pitfalls: missing include, `ERoomConnectionDirection` not found (confirm the `ARPGRoomTemplate.h` include in `ARPGBlockoutRoom.h`).

- [ ] **Step 3: Confirm the DLL is newer (the C++ actually built into the binary)**

Run: `ls -la "/c/Users/kazda/Documents/Unreal Projects/PoF/Binaries/Win64/UnrealEditor-PoF.dll"`
Expected: mtime is NOW (newer than the Step 2 note / your edits). A "Target is up to date" with an old DLL means nothing compiled — investigate before proceeding.

- [ ] **Step 4: Commit the C++ (UE repo)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Source/PoF/World/ARPGBlockoutRoom.h Source/PoF/World/ARPGBlockoutRoom.cpp Source/PoF/LevelDesign/ARPGLevelGenerator.h Source/PoF/LevelDesign/ARPGLevelGenerator.cpp Source/PoF/Test/Environment/ProcGenWalkTest.h Source/PoF/Test/Environment/ProcGenWalkTest.cpp
git commit -m "feat(leveldesign): walkable procedural dungeon (open walls + sized rooms + walk test)

ARPGBlockoutRoom::InitRoom sizes the room + opens walls on connected sides;
ARPGLevelGenerator records each room's connected directions and passes
RoomSize + open-sides to spawned rooms. Adjacent touching rooms minus the
shared wall = continuous walkable floor (no corridor meshes). AProcGenWalkTest
drives the player from the start room into a connected room as the gate.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Build the dungeon — placement script + bake

**Files:**
- Create: `Content/Python/build_procgen_dungeon.py`

- [ ] **Step 1: Write the placement script**

Create `C:\Users\kazda\Documents\Unreal Projects\PoF\Content\Python\build_procgen_dungeon.py`:

```python
"""
build_procgen_dungeon.py
========================
Authors 3 RoomTemplate data assets + a new /Game/Maps/ProcGenDungeon level with a
seeded ARPGLevelGenerator, then calls GenerateLevel() to BAKE a walkable
multi-room greybox dungeon into the saved map (edit-time generation).

Run via the FULL editor (Interchange-free, but level Python needs Slate):
    UnrealEditor.exe <uproject> -ExecutePythonScript="<abs path>" -unattended -nopause -nosplash
"""
import unreal

ROOM_TEMPLATES_DIR = "/Game/Level/RoomTemplates"
LEVEL_PATH = "/Game/Maps/ProcGenDungeon"
TARGET_ROOMS = 6
SEED = 1337
ROOM = 800.0

asset_tools = unreal.AssetToolsHelpers.get_asset_tools()
asset_lib = unreal.EditorAssetLibrary
D = unreal.RoomConnectionDirection


def _log(m):
    unreal.log("[build_procgen] " + m)


def _offset(direction, half):
    if direction == D.NORTH:
        return unreal.Vector(half, 0.0, 0.0)
    if direction == D.SOUTH:
        return unreal.Vector(-half, 0.0, 0.0)
    if direction == D.EAST:
        return unreal.Vector(0.0, half, 0.0)
    return unreal.Vector(0.0, -half, 0.0)  # WEST


def _slot(direction):
    s = unreal.RoomConnectionSlot()
    s.set_editor_property("direction", direction)
    s.set_editor_property("connection_width", 300.0)
    s.set_editor_property("local_offset", _offset(direction, ROOM * 0.5))
    return s


def make_template(name, directions):
    path = "%s/%s" % (ROOM_TEMPLATES_DIR, name)
    if asset_lib.does_asset_exist(path):
        asset_lib.delete_asset(path)
    factory = unreal.DataAssetFactory()
    factory.set_editor_property("data_asset_class", unreal.ARPGRoomTemplate)
    tmpl = asset_tools.create_asset(name, ROOM_TEMPLATES_DIR, unreal.ARPGRoomTemplate, factory)
    if tmpl is None:
        raise RuntimeError("failed to create template " + path)
    tmpl.set_editor_property("template_id", unreal.Name(name))
    tmpl.set_editor_property("room_size", unreal.Vector(ROOM, ROOM, 300.0))
    tmpl.set_editor_property("connection_slots", [_slot(d) for d in directions])
    tmpl.set_editor_property("selection_weight", 1.0)
    asset_lib.save_asset(path)
    # Read-back canary (API names): confirm the slots persisted.
    n = len(tmpl.get_editor_property("connection_slots"))
    _log("Template %s: %d slots (expected %d)" % (name, n, len(directions)))
    return tmpl


def main():
    _log("=== ProcGen dungeon build START ===")
    rt_hub = make_template("RT_Hub", [D.NORTH, D.SOUTH, D.EAST, D.WEST])
    rt_room = make_template("RT_Room", [D.NORTH, D.SOUTH])
    rt_end = make_template("RT_End", [D.SOUTH])

    les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
    les.new_level(LEVEL_PATH)
    _log("Created level: " + LEVEL_PATH)

    aes = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

    dl = aes.spawn_actor_from_class(unreal.DirectionalLight,
                                    unreal.Vector(0.0, 0.0, 1000.0),
                                    unreal.Rotator(0.0, -50.0, -35.0))
    for c in dl.get_components_by_class(unreal.DirectionalLightComponent):
        c.set_mobility(unreal.ComponentMobility.MOVABLE)
        c.set_editor_property("intensity", 6.0)

    sl = aes.spawn_actor_from_class(unreal.SkyLight, unreal.Vector(0.0, 0.0, 1000.0))
    for c in sl.get_components_by_class(unreal.SkyLightComponent):
        c.set_mobility(unreal.ComponentMobility.MOVABLE)
        c.set_editor_property("intensity", 3.0)
        try:
            c.set_editor_property("real_time_capture", True)
        except Exception:
            pass

    # Player spawns here via the project GlobalDefaultGameMode (BP_VSGameMode).
    aes.spawn_actor_from_class(unreal.PlayerStart, unreal.Vector(0.0, 0.0, 120.0))

    gen = aes.spawn_actor_from_class(unreal.ARPGLevelGenerator, unreal.Vector(0.0, 0.0, 0.0))
    gen.set_editor_property("room_template_pool", [rt_room])
    gen.set_editor_property("start_room_template", rt_hub)
    gen.set_editor_property("end_room_template", rt_end)
    gen.set_editor_property("target_room_count", TARGET_ROOMS)
    gen.set_editor_property("random_seed", SEED)
    gen.set_editor_property("room_padding", 0.0)
    gen.set_editor_property("min_corridor_length", 2.0)
    gen.set_editor_property("max_corridor_length", 2.0)
    gen.set_editor_property("b_spawn_blockout_actors", True)

    # Edit-time bake: spawns AARPGBlockoutRoom actors into the level.
    gen.generate_level()

    rooms = [a for a in aes.get_all_level_actors()
             if isinstance(a, unreal.ARPGBlockoutRoom)]
    _log("Baked %d BlockoutRoom actors (target %d)" % (len(rooms), TARGET_ROOMS))
    if len(rooms) != TARGET_ROOMS:
        unreal.log_warning("[build_procgen] room count %d != target %d "
                           "(seed/connectivity may need tuning)" % (len(rooms), TARGET_ROOMS))

    les.save_current_level()
    _log("Saved level: " + LEVEL_PATH)
    _log("=== ProcGen dungeon build COMPLETE ===")


if __name__ == "__main__":
    main()
    try:
        if unreal.is_editor():
            unreal.SystemLibrary.quit_editor()
    except Exception:
        pass
```

- [ ] **Step 2: Run it (full editor)**

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" -ExecutePythonScript="C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/build_procgen_dungeon.py" -unattended -nopause -nosplash >/dev/null 2>&1; echo "exit=$?"
LOG="/c/Users/kazda/Documents/Unreal Projects/PoF/Saved/Logs/PoF.log"; grep -E "build_procgen\]|LevelGenerator\]" "$LOG" | grep -E "Template RT_|Baked|Generated|Saved level|COMPLETE" | tail -15
```

Expected: `Template RT_Hub: 4 slots`, `RT_Room: 2`, `RT_End: 1`; `[LevelGenerator] … Generated 6 rooms`; `Baked 6 BlockoutRoom actors (target 6)`; `Saved level`; `COMPLETE`.
- If the room count < 6, the seeded layout dead-ended — try another `SEED` value or raise `target_room_count` headroom; re-run.
- If `DataAssetFactory` / a `set_editor_property` name raised (no `Template …` lines), fix the property name (read-back canary will show) and re-run. (Sibling-clobbered log: check `PoF_2.log` / newest `PoF*.log`.)

- [ ] **Step 3: Commit the placement script + assets (UE repo)**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/build_procgen_dungeon.py Content/Maps/ProcGenDungeon.umap Content/Level/RoomTemplates
git status --short | head
git commit -m "feat(procgen): ProcGenDungeon placement script + baked 6-room dungeon

build_procgen_dungeon.py authors 3 RoomTemplate assets + a seeded
ARPGLevelGenerator and bakes a walkable 6-room greybox dungeon into
/Game/Maps/ProcGenDungeon. The script is the durable source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verify — walk test, screenshot, regression, findings

**Files:** findings doc at the end.

- [ ] **Step 1: Place the walk test in ProcGenDungeon**

The `AProcGenWalkTest` actor must be IN the map for `Automation RunTests` to find it. Add it via a one-off command appended to the level (simplest: extend the placement script OR a tiny Python). Run this Python inline via the full editor:

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && cat > /tmp/place_walktest.py <<'PYEOF'
import unreal
les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
les.load_level("/Game/Maps/ProcGenDungeon")
aes = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)
for a in aes.get_all_level_actors():
    if isinstance(a, unreal.ProcGenWalkTest):
        aes.destroy_actor(a)
t = aes.spawn_actor_from_class(unreal.ProcGenWalkTest, unreal.Vector(0,0,300))
t.set_actor_label("ProcGenWalkTest")
les.save_current_level()
unreal.log("[place_walktest] spawned AProcGenWalkTest")
try:
    if unreal.is_editor(): unreal.SystemLibrary.quit_editor()
except Exception: pass
PYEOF
"/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" -ExecutePythonScript="/tmp/place_walktest.py" -unattended -nopause -nosplash >/dev/null 2>&1; echo "exit=$?"
grep "place_walktest" "/c/Users/kazda/Documents/Unreal Projects/PoF/Saved/Logs/PoF.log" | tail -2
```
Expected: `[place_walktest] spawned AProcGenWalkTest`. (`unreal.ProcGenWalkTest` resolves because the class compiled in Task 3.)

- [ ] **Step 2: Run the walk test (the walkability gate)**

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && rm -f /c/Users/kazda/kiro/pof/_walk.log; "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" "/Game/Maps/ProcGenDungeon" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.ProcGenDungeon;Quit" -unattended -nopause -nullrhi -abslog="C:/Users/kazda/kiro/pof/_walk.log" >/dev/null 2>&1; echo "exit=$?"
grep -E "Assertion passed|Assertion failed|Result=\{|TEST COMPLETE" "/c/Users/kazda/kiro/pof/_walk.log" | tail -8
```

Expected: `Result={Success}`, `Assertion passed (#1 traversal: player reached the connected room)`, `EXIT CODE: 0`.
- **If the player fails to traverse** (#1 fails): the gap-elimination didn't work — check the connecting walls actually opened (the `OpenDirections` recording + `UpdateWalls` skip) and the rooms touch (corridor 2 / padding 0). Per the spec fallback, if driven movement is too flaky, switch the assertion to structural (assert the target room's `BlockoutActor` wall count < 4 and the graph is connected) — but first confirm the walls/adjacency are correct.
- (If `Automation RunTests` can't find the test by that filter, the auto-discovered name is `Project.Functional Tests.Maps.ProcGenDungeon.ProcGenWalkTest` — use the actor label; adjust the filter.)

- [ ] **Step 3: Top-down screenshot**

```powershell
$shots = "C:\Users\kazda\Documents\Unreal Projects\PoF\Saved\Screenshots\WindowsEditor"
$b = (Get-ChildItem $shots -Filter *.png | Sort LastWriteTime -Desc | Select -First 1).Name
# Elevated PlayerStart already at z=120; for a wide view, launch and shoot.
$argline = '"C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" /Game/Maps/ProcGenDungeon -game -windowed -ResX=1280 -ResY=720 -NoLoadingScreen -ExecCmds="HighResShot 1280x720"'
$p = Start-Process -FilePath "C:\Program Files\Epic Games\UE_5.7\Engine\Binaries\Win64\UnrealEditor.exe" -ArgumentList $argline -PassThru
Start-Sleep -Seconds 55
try { & taskkill /PID $p.Id /T /F 2>&1 | Out-Null } catch {}
Start-Sleep -Seconds 3
$a = (Get-ChildItem $shots -Filter *.png | Sort LastWriteTime -Desc | Select -First 1)
if ($a.Name -ne $b) { "SHOT_OK: $($a.FullName)" } else { "NO SHOT" }
```
View the PNG (Read tool). It shows the dungeon from the player's spawn; multiple greybox rooms should be visible. Copy to `docs/features/arpg-vertical-slice/scenario-runs/img/procgen-dungeon.png` (app repo).

- [ ] **Step 4: Gemini check**

```bash
cd "/c/Users/kazda/kiro/personas" && export GEMINI_API_KEY=$(grep -E "^GEMINI_API_KEY=" .env | head -1 | cut -d= -f2- | tr -d '"'"'"'\r'); P=$(cat "/c/Users/kazda/kiro/pof/e2e/fixtures/gemini-prompts/procgen-check.txt"); node "/c/Users/kazda/kiro/personas/.claude/skills/leonardo/tools/gemini-recognize.mjs" --input "<png path>" --prompt "$P" 2>&1 | tail -16
```
Expected: yes to multiple rooms + connected by passages + lit + no artifacts. (Supporting evidence; the walk test is the gate.)

- [ ] **Step 5: Regression — VerticalSlice functional test still green**

```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && rm -f /c/Users/kazda/kiro/pof/_vs.log; "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" "/Game/Maps/VerticalSlice" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice.VSFunctionalTest;Quit" -unattended -nopause -nullrhi -abslog="C:/Users/kazda/kiro/pof/_vs.log" >/dev/null 2>&1; echo "exit=$?"
grep -E "Result=\{|#2 movement|TEST COMPLETE" "/c/Users/kazda/kiro/pof/_vs.log" | tail -4; rm -f /c/Users/kazda/kiro/pof/_walk.log /c/Users/kazda/kiro/pof/_vs.log
```
Expected: `Result={Success}`, `#2 movement … PASS`, `EXIT CODE: 0` (no regression from the C++ changes, which only touch level-design classes).

- [ ] **Step 6: Write the findings doc**

Create `docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-dungeon.md`: the C++ gap fixes (InitRoom/open walls, generator open-dirs/size pass-through, adjacency); the placement script + baked 6-room count; the walk-test result (paste the `#1 traversal` line); the Gemini verdict; VSFunctionalTest still green; the screenshot. Note any seed tuning + new UE-Python API names learned (DataAssetFactory, RoomConnectionSlot, generate_level()).

- [ ] **Step 7: Commit UE assets (umap/walktest placement) + app docs**

```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Maps/ProcGenDungeon.umap
git commit -m "chore(procgen): place AProcGenWalkTest in ProcGenDungeon (walkability verified)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```
```bash
cd "C:/Users/kazda/kiro/pof"
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-23-env-procgen-dungeon.md docs/features/arpg-vertical-slice/scenario-runs/img/procgen-dungeon.png docs/superpowers/plans/2026-05-23-env-procgen-dungeon.md
git commit -m "docs(env): walkable procedural dungeon findings (folder-05 session 3)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final validation

- [ ] **Step 1: PoF-app tests**

Run: `cd "C:/Users/kazda/kiro/pof" && npm run test` → all pass (no new tests; confirms no regression).

- [ ] **Step 2: Confirm the definition of done**

(1) C++ compiled (DLL mtime confirmed); (2) `build_procgen_dungeon.py` baked 6 rooms (count asserted + generator log); (3) `AProcGenWalkTest` green (player traversed); (4) Gemini confirms connected rooms; (5) VSFunctionalTest still green; (6) knowledge tip + `procgen-check.txt` added; (7) findings committed. Any unchecked: return to its task. **If the walk test fails (player can't traverse), the gaps are NOT eliminated — report it rather than declaring success.**

---

## Self-review notes (addressed during writing)

- **Spec coverage:** Part 1 (BlockoutRoom InitRoom + open walls) → Task 2 Steps 1-2; Part 2 (generator open-dirs + size + adjacency) → Task 2 Steps 3-4 + the script's `room_padding`/`corridor` config (Task 4); Part 3 (data + map + bake) → Task 4; Part 4 (walk test) → Task 2 Steps 5-6 + Task 5 Step 2; Part 5 (PoF app) → Task 1. Recompile → Task 3. DoD → Final validation.
- **No-Build.cs:** confirmed `FunctionalTesting`/`NavigationSystem`/`AIModule` already present.
- **No GameMode override:** confirmed `GlobalDefaultGameMode=BP_VSGameMode` applies to ProcGenDungeon.
- **Type/name consistency:** `InitRoom(FVector, EBlockoutRoomPurpose, const TArray<ERoomConnectionDirection>&)` declared (Task 2.1), defined (2.2), called (2.4); `OpenSides`/`OpenDirections` consistent; `AProcGenWalkTest` extends `AARPGFunctionalTestBase`, uses `Phases`/`RunPhase`/`OnTestStarted`/`GetPlayerCharacter`/`GetPhaseTime` exactly as the base defines them.
- **API-name risk** (DataAssetFactory, `RoomConnectionSlot`/`RoomConnectionDirection`, `connection_slots`/`room_size`/`local_offset`, `generate_level()`) guarded with a read-back canary + log, per prior sessions' discoveries.
- **Walk-test fallback** (structural) documented in Task 5 Step 2 if driven movement is flaky.
- **Edit-time bake persistence** of `PlacedRooms` (non-transient UPROPERTY) is what the walk test reads — noted; if zero rooms bake, the count check in Task 4 Step 2 catches it.
