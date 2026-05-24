# Environment Test Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock in the arena's floor collision, wall bounds, and lighting/PP setup with three headless C++ functional tests, plus guard the FBX-scale knowledge tip + the §4 dispatch surface with two PoF vitests.

**Architecture:** Three `AFunctionalTest`/`AARPGFunctionalTestBase` subclasses in `Source/PoF/Test/Environment/`, placed as actors in `VerticalSlice.umap` (how the runner discovers them) via an idempotent Python placement; run via `Automation RunTests Project.Functional Tests.Maps.VerticalSlice`. Two vitests read `SUB_MODULES` / `TaskFactory`.

**Tech Stack:** UE 5.7 C++ (`AFunctionalTest`), editor Python (placement), vitest, `Build.bat`.

**Spec:** `docs/superpowers/specs/2026-05-24-env-test-hardening-design.md`

---

## Established facts (verified)

- `AFunctionalTest`s are discovered by being **placed as actors in the map**
  (`VSFunctionalTest`/`VSHUDFunctionalTest` in VerticalSlice.umap;
  `ProcGenWalkTest` in ProcGenDungeon.umap). → place the 3 new tests via Python.
- `AARPGFunctionalTestBase`: `Phases` (TArray<FName>), `RunPhase(idx,name,dt)`
  → `EARPGPhaseResult` (Running/Advance/Fail), `OnTestStarted()`,
  `GetPlayerCharacter()`, `GetPhaseTime()`, `LogWarningHandling = OutputIgnored`
  default. `AVSFunctionalTest : AFunctionalTest` shows the `AddMovementInput`
  movement pattern + `LogWarningHandling`.
- Arena (`build_arena.py`): floor top z=0; walls at ±1000 uu (Wall_E at +X
  +1000). Player start (-300,0,120). Scatter props are no-collision.
- `module-registry.ts` exports `SUB_MODULES: SubModuleDefinition[]` (each has
  `id`, `knowledgeTips: {title, content, source}[]`). The level-design module's
  tips include the `import_uniform_scale=1.0` guidance.
- `cli-task.ts` exports `TaskFactory` with `procgenDungeon` + `scatterBiome`.
- Conventions: UE repo pushable, app repo local-only; **stage by name**; **never
  broad-kill processes** (no `/IM`); pre-existing `leonardo.ts:208` typecheck
  error is unrelated (filter it). Headless UE exits 3 on shutdown (judge by log).

---

## File Structure

- Create (UE): `Source/PoF/Test/Environment/VSArenaCollisionTest.{h,cpp}`,
  `VSArenaBoundsTest.{h,cpp}`, `VSArenaSetupTest.{h,cpp}`.
- Create (UE): `Content/Python/place_arena_tests.py`.
- Create (app): `src/__tests__/registry/level-design-knowledge.test.ts`,
  `src/__tests__/lib/cli-task-leveldesign-surface.test.ts`.

---

## Task 1: C++ — the three arena test classes (edits only; compile in Task 2)

**Files:** the 6 C++ files above.

- [ ] **Step 1: `VSArenaCollisionTest.h`**
```cpp
#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSArenaCollisionTest.generated.h"

/** Drops physics probes onto the arena floor; asserts they rest (collision holds). */
UCLASS()
class POF_API AVSArenaCollisionTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSArenaCollisionTest();

	virtual void StartTest() override;
	virtual void Tick(float DeltaSeconds) override;

private:
	float Elapsed = 0.f;
	bool bAsserted = false;
	TArray<TWeakObjectPtr<AActor>> Probes;
};
```

- [ ] **Step 2: `VSArenaCollisionTest.cpp`**
```cpp
#include "Test/Environment/VSArenaCollisionTest.h"
#include "Engine/StaticMeshActor.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/StaticMesh.h"

AVSArenaCollisionTest::AVSArenaCollisionTest()
{
	PrimaryActorTick.bCanEverTick = true;
	TimeLimit = 15.f;
	LogWarningHandling = EFunctionalTestLogHandling::OutputIgnored;
}

void AVSArenaCollisionTest::StartTest()
{
	Super::StartTest();

	UStaticMesh* Sphere = LoadObject<UStaticMesh>(nullptr, TEXT("/Engine/BasicShapes/Sphere.Sphere"));
	if (!Sphere)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("Sphere mesh missing"));
		return;
	}

	const TArray<FVector> Spots = {
		FVector(0.f, 0.f, 300.f),
		FVector(600.f, 600.f, 300.f),
		FVector(-600.f, 600.f, 300.f),
		FVector(600.f, -600.f, 300.f),
		FVector(-600.f, -600.f, 300.f),
	};

	for (const FVector& Spot : Spots)
	{
		AStaticMeshActor* Probe = GetWorld()->SpawnActor<AStaticMeshActor>(
			AStaticMeshActor::StaticClass(), Spot, FRotator::ZeroRotator);
		if (!Probe) continue;
		UStaticMeshComponent* SMC = Probe->GetStaticMeshComponent();
		SMC->SetMobility(EComponentMobility::Movable);
		SMC->SetStaticMesh(Sphere);
		SMC->SetWorldScale3D(FVector(0.5f));
		SMC->SetCollisionProfileName(TEXT("BlockAll"));
		SMC->SetSimulatePhysics(true);
		Probes.Add(Probe);
	}

	if (Probes.Num() == 0)
	{
		FinishTest(EFunctionalTestResult::Failed, TEXT("No physics probes spawned"));
	}
}

void AVSArenaCollisionTest::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);
	if (!IsRunning() || bAsserted) return;

	Elapsed += DeltaSeconds;
	if (Elapsed < 2.5f) return; // let physics settle
	bAsserted = true;

	int32 Rested = 0;
	for (const TWeakObjectPtr<AActor>& P : Probes)
	{
		if (!P.IsValid()) continue;
		const float Z = P->GetActorLocation().Z;
		if (Z > 0.f) ++Rested;
	}
	AssertTrue(Rested == Probes.Num(),
		FString::Printf(TEXT("#1 collision: all %d probes rested on the arena floor (Z>0); %d rested"),
			Probes.Num(), Rested));
	FinishTest(EFunctionalTestResult::Default, TEXT("arena floor collision holds"));
}
```

- [ ] **Step 3: `VSArenaBoundsTest.h`**
```cpp
#pragma once

#include "CoreMinimal.h"
#include "Test/ARPGFunctionalTestBase.h"
#include "VSArenaBoundsTest.generated.h"

/** Drives the player into a wall; asserts the wall blocks it inside the arena. */
UCLASS()
class POF_API AVSArenaBoundsTest : public AARPGFunctionalTestBase
{
	GENERATED_BODY()

public:
	AVSArenaBoundsTest();

protected:
	virtual void OnTestStarted() override;
	virtual EARPGPhaseResult RunPhase(int32 PhaseIndex, FName PhaseName, float DeltaSeconds) override;

private:
	FVector StartLoc = FVector::ZeroVector;
};
```

- [ ] **Step 4: `VSArenaBoundsTest.cpp`**
```cpp
#include "Test/Environment/VSArenaBoundsTest.h"
#include "Player/ARPGPlayerCharacter.h"

AVSArenaBoundsTest::AVSArenaBoundsTest()
{
	Phases = { TEXT("WalkIntoWall") };
	TimeLimit = 20.f;
}

void AVSArenaBoundsTest::OnTestStarted()
{
	if (AARPGPlayerCharacter* P = GetPlayerCharacter())
	{
		StartLoc = P->GetActorLocation();
	}
}

EARPGPhaseResult AVSArenaBoundsTest::RunPhase(int32 /*PhaseIndex*/, FName /*PhaseName*/, float /*DeltaSeconds*/)
{
	AARPGPlayerCharacter* P = GetPlayerCharacter();
	if (!P)
	{
		AssertTrue(false, TEXT("#1 bounds: no player character"));
		return EARPGPhaseResult::Fail;
	}

	// Drive toward the +X wall (Wall_E at ~+1000 uu).
	P->AddMovementInput(FVector::ForwardVector, 1.f);

	if (GetPhaseTime() >= 4.f)
	{
		const FVector Loc = P->GetActorLocation();
		AssertTrue(Loc.X > StartLoc.X + 50.f,
			FString::Printf(TEXT("#1 bounds: player moved toward the +X wall (X %.1f -> %.1f)"), StartLoc.X, Loc.X));
		AssertTrue(Loc.X < 1000.f,
			FString::Printf(TEXT("#1 bounds: wall blocked the player inside the arena (X=%.1f, wall ~1000)"), Loc.X));
		return EARPGPhaseResult::Advance;
	}
	return EARPGPhaseResult::Running;
}
```

- [ ] **Step 5: `VSArenaSetupTest.h`**
```cpp
#pragma once

#include "CoreMinimal.h"
#include "FunctionalTest.h"
#include "VSArenaSetupTest.generated.h"

/** Asserts the arena's lighting + post-process actors are present (headless setup invariant). */
UCLASS()
class POF_API AVSArenaSetupTest : public AFunctionalTest
{
	GENERATED_BODY()

public:
	AVSArenaSetupTest();

	virtual void StartTest() override;
};
```

- [ ] **Step 6: `VSArenaSetupTest.cpp`**
```cpp
#include "Test/Environment/VSArenaSetupTest.h"
#include "Engine/DirectionalLight.h"
#include "Engine/SkyLight.h"
#include "Engine/PostProcessVolume.h"
#include "EngineUtils.h"

AVSArenaSetupTest::AVSArenaSetupTest()
{
	TimeLimit = 10.f;
	LogWarningHandling = EFunctionalTestLogHandling::OutputIgnored;
}

void AVSArenaSetupTest::StartTest()
{
	Super::StartTest();

	int32 DirLights = 0, SkyLights = 0, PPVs = 0;
	for (TActorIterator<ADirectionalLight> It(GetWorld()); It; ++It) ++DirLights;
	for (TActorIterator<ASkyLight> It(GetWorld()); It; ++It) ++SkyLights;
	for (TActorIterator<APostProcessVolume> It(GetWorld()); It; ++It) ++PPVs;

	AssertTrue(DirLights >= 1, FString::Printf(TEXT("#1 setup: DirectionalLight present (%d)"), DirLights));
	AssertTrue(SkyLights >= 1, FString::Printf(TEXT("#2 setup: SkyLight present (%d)"), SkyLights));
	AssertTrue(PPVs >= 1, FString::Printf(TEXT("#3 setup: PostProcessVolume present (%d)"), PPVs));

	FinishTest(EFunctionalTestResult::Default, TEXT("arena lighting/PP configured"));
}
```

(No commit yet — Task 2 compiles, then commits.)

---

## Task 2: Compile + verify the DLL + commit C++

- [ ] **Step 1: Ensure no live editor locks the DLL**

`Get-Process UnrealEditor* -ErrorAction SilentlyContinue | Select Id,ProcessName` → expect empty. (Do NOT kill any — if one is running, wait / tell the user.)

- [ ] **Step 2: Record DLL mtime, then compile**
```
ls -la "/c/Users/kazda/Documents/Unreal Projects/PoF/Binaries/Win64/UnrealEditor-PoF.dll"
```
Then (PowerShell — spaced path needs `&`):
```
& "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -Project="C:\Users\kazda\Documents\Unreal Projects\PoF\PoF.uproject" -WaitMutex
```
Expect `Result: Succeeded` + the 3 new `.cpp` in the compile list. Fix any compile errors (likely a missing include) and re-run.

- [ ] **Step 3: Confirm the DLL is newer** — `ls -la …/UnrealEditor-PoF.dll` mtime is NOW (newer than the edits). If "Target is up to date" with an old DLL, nothing compiled — investigate.

- [ ] **Step 4: Commit (UE repo)**
```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Source/PoF/Test/Environment/VSArenaCollisionTest.h Source/PoF/Test/Environment/VSArenaCollisionTest.cpp Source/PoF/Test/Environment/VSArenaBoundsTest.h Source/PoF/Test/Environment/VSArenaBoundsTest.cpp Source/PoF/Test/Environment/VSArenaSetupTest.h Source/PoF/Test/Environment/VSArenaSetupTest.cpp
git commit -m "test(env): arena collision/bounds/setup functional tests

AVSArenaCollisionTest (physics probes rest on the floor), AVSArenaBoundsTest
(player blocked by walls inside the arena), AVSArenaSetupTest (DirectionalLight
+ SkyLight + PostProcessVolume present). Guards the re-UV/re-export/scatter
changes + lighting config against regression.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Place the tests in VerticalSlice + run

- [ ] **Step 1: Write `Content/Python/place_arena_tests.py`**
```python
"""Idempotently place the 3 arena functional-test actors into VerticalSlice."""
import unreal

les = unreal.get_editor_subsystem(unreal.LevelEditorSubsystem)
les.load_level("/Game/Maps/VerticalSlice")
aes = unreal.get_editor_subsystem(unreal.EditorActorSubsystem)

specs = [
    (unreal.VSArenaCollisionTest, "VSArenaCollisionTest"),
    (unreal.VSArenaBoundsTest, "VSArenaBoundsTest"),
    (unreal.VSArenaSetupTest, "VSArenaSetupTest"),
]
classes = tuple(c for c, _ in specs)
for a in aes.get_all_level_actors():
    if isinstance(a, classes):
        aes.destroy_actor(a)
for cls, label in specs:
    t = aes.spawn_actor_from_class(cls, unreal.Vector(0.0, 0.0, 400.0))
    t.set_actor_label(label)
    unreal.log("[place_arena_tests] placed " + label)

les.save_current_level()
unreal.log("[place_arena_tests] done")

if __name__ == "__main__":
    try:
        if unreal.is_editor():
            unreal.SystemLibrary.quit_editor()
    except Exception:
        pass
```

- [ ] **Step 2: Run the placement (full editor)**
```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" -ExecutePythonScript="C:/Users/kazda/Documents/Unreal Projects/PoF/Content/Python/place_arena_tests.py" -unattended -nopause -nosplash >/dev/null 2>&1; echo "exit=$?"
grep -E "place_arena_tests\]" "/c/Users/kazda/Documents/Unreal Projects/PoF/Saved/Logs/PoF.log" | tail -5
```
Expect `placed VSArenaCollisionTest/BoundsTest/SetupTest` + `done`. (If `unreal.VSArenaCollisionTest` is unknown, the C++ didn't compile in — recheck Task 2.)

- [ ] **Step 3: Run ALL VerticalSlice functional tests (new 3 + regression)**
```bash
cd "/c/Users/kazda/Documents/Unreal Projects/PoF" && rm -f /c/Users/kazda/kiro/pof/_arena.log; "/c/Program Files/Epic Games/UE_5.7/Engine/Binaries/Win64/UnrealEditor-Cmd.exe" "C:/Users/kazda/Documents/Unreal Projects/PoF/PoF.uproject" "/Game/Maps/VerticalSlice" -ExecCmds="Automation RunTests Project.Functional Tests.Maps.VerticalSlice;Quit" -unattended -nopause -nullrhi -abslog="C:/Users/kazda/kiro/pof/_arena.log" >/dev/null 2>&1; echo "exit=$?"
grep -E "Test Completed|Assertion (passed|failed)|collision|bounds|setup|TEST COMPLETE" "/c/Users/kazda/kiro/pof/_arena.log" | tail -30
```
Expect each of `VSArenaCollisionTest`, `VSArenaBoundsTest`, `VSArenaSetupTest`, `VSFunctionalTest`, `VSHUDFunctionalTest` → `Result={Success}`, and `**** TEST COMPLETE. EXIT CODE: 0 ****`.
- If a new test fails: inspect its assertion. Collision: if probes show `Z<=0`, bump settle to 4 s or check probe collision profile. Bounds: confirm the +X wall is at +1000 (read `build_arena.py`); if the player escaped, the assertion correctly caught a missing wall. Don't declare success on a failing test.
- `rm -f /c/Users/kazda/kiro/pof/_arena.log` after.

- [ ] **Step 4: Commit (UE repo) — script + the umap (placement)**
```bash
cd "C:/Users/kazda/Documents/Unreal Projects/PoF"
git add Content/Python/place_arena_tests.py Content/Maps/VerticalSlice.umap
git commit -m "test(env): place arena functional tests in VerticalSlice

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```
(If `git status` shows the umap unchanged — a sibling already committed it — skip that path.)

---

## Task 4: PoF guard vitests

**Files:**
- Create: `src/__tests__/registry/level-design-knowledge.test.ts`
- Create: `src/__tests__/lib/cli-task-leveldesign-surface.test.ts`

- [ ] **Step 1: Write the knowledge-tip test**
```typescript
import { describe, it, expect } from 'vitest';
import { SUB_MODULES } from '@/lib/module-registry';

describe('level-design knowledge tips', () => {
  it('keep the FBX-scale gotcha (import_uniform_scale=1.0)', () => {
    const mod = SUB_MODULES.find((m) => m.id === 'level-design');
    expect(mod).toBeDefined();
    const hasFbxScaleTip = (mod!.knowledgeTips ?? []).some((t) =>
      t.content.includes('import_uniform_scale=1.0'),
    );
    expect(hasFbxScaleTip).toBe(true);
  });
});
```

- [ ] **Step 2: Write the dispatch-surface test**
```typescript
import { describe, it, expect } from 'vitest';
import { TaskFactory } from '@/lib/cli-task';

describe('level-design UE dispatch surface', () => {
  it('exposes procgenDungeon producing a procgen-dungeon task', () => {
    expect(typeof TaskFactory.procgenDungeon).toBe('function');
    const t = TaskFactory.procgenDungeon('level-design', { roomCount: 6, seed: 1 }, 'http://x', 'L');
    expect(t.type).toBe('procgen-dungeon');
  });

  it('exposes scatterBiome producing a biome-scatter task', () => {
    expect(typeof TaskFactory.scatterBiome).toBe('function');
    const t = TaskFactory.scatterBiome('level-design', { density: 1, seed: 1 }, 'http://x', 'L');
    expect(t.type).toBe('biome-scatter');
  });
});
```

- [ ] **Step 3: Run both + typecheck**
```
npx vitest run src/__tests__/registry/level-design-knowledge.test.ts src/__tests__/lib/cli-task-leveldesign-surface.test.ts
```
Expect 3 passed. Then `npm run typecheck 2>&1 | grep -v "leonardo.ts" | grep "error TS" || echo OK` → `OK`.
(If `mod.knowledgeTips` is typed optional / the `SubModuleDefinition` shape differs, adjust the access — the test must compile.)

- [ ] **Step 4: Commit (app repo, by name)**
```bash
cd "C:/Users/kazda/kiro/pof"
git add src/__tests__/registry/level-design-knowledge.test.ts src/__tests__/lib/cli-task-leveldesign-surface.test.ts
git commit -m "test(level-design): guard the FBX-scale tip + the UE dispatch surface

vitest asserts the level-design knowledgeTips keep import_uniform_scale=1.0 and
that TaskFactory.procgenDungeon / scatterBiome produce the right task types.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Verify + findings

- [ ] **Step 1: Full suite** — `cd "C:/Users/kazda/kiro/pof" && npm run test 2>&1 | tail -5` → all pass (incl. the 2 new files).

- [ ] **Step 2: Confirm the C++ test results** (from Task 3 Step 3): the 3 new tests + VSFunctionalTest + VSHUDFunctionalTest all `Result={Success}`.

- [ ] **Step 3: Write findings** — `docs/features/arpg-vertical-slice/scenario-runs/2026-05-24-env-test-hardening.md`: the 3 C++ tests + placement, each test's result, the 2 vitests, the full-suite/regression status. Note what was reframed (lighting-present → setup-present) + deferred (level-gen smoke = AProcGenWalkTest).

- [ ] **Step 4: Commit (app repo, local)**
```bash
cd "C:/Users/kazda/kiro/pof"
git add docs/features/arpg-vertical-slice/scenario-runs/2026-05-24-env-test-hardening.md docs/superpowers/plans/2026-05-24-env-test-hardening.md
git commit -m "docs(env): test-hardening findings (folder-05 tests.md)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Final validation

- [ ] **Confirm DoD:** (1) the 3 C++ tests compile + are placed in VerticalSlice + each `Result={Success}`; (2) VSFunctionalTest still green; (3) the 2 vitests + full suite green + typecheck/lint clean; (4) findings committed. **If any new test fails (e.g. probes fall through / player escapes), report it as a real finding — don't declare success.**

---

## Self-review notes (addressed during writing)

- **Spec coverage:** Part 1 (3 C++ tests)→Task 1; placement+run→Task 3 (the spec's open "placement mechanism" → resolved: actors in the umap via Python, confirmed by VSFunctionalTest being in VerticalSlice.umap); Part 2 (2 vitests)→Task 4; verification→Tasks 3+5. DoD→Final validation.
- **Type/name consistency:** test class names `AVSArenaCollisionTest`/`AVSArenaBoundsTest`/`AVSArenaSetupTest` consistent across .h/.cpp/placement (`unreal.VSArenaCollisionTest` = the A-stripped Python name)/run filters; `SUB_MODULES` + `knowledgeTips.content` match the registry export; `TaskFactory.procgenDungeon`/`scatterBiome` match cli-task.
- **No placeholders:** full code in every code step.
- **Process-kill safety:** Task 2 only *lists* editors (no kill); Task 3 runs the headless `-Cmd` runner (no window to kill). No `/IM`.
- **Recompile** (heaviest) gated by DLL-mtime check; shared-tree-safe (commit narrowly; umap is best-effort with the placement script as the durable artifact).
- **Bounds math:** +X wall at +1000 uu, player starts X=-300 → `X>start+50 && X<1000` correctly means "moved toward the wall but blocked inside."
