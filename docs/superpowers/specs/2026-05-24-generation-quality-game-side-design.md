# Generation-Quality (§01) Game-Side — Design Spec

**Date:** 2026-05-24
**Source requirements:** `docs/improvements/01-generation-quality/game.md` (§1–6) and
`docs/improvements/01-generation-quality/tests.md` (game-side tests, e2e harness, gemini plumbing).
**Companion plan:** `docs/superpowers/plans/2026-05-24-generation-quality-game-side.md`

> **Scope split.** The app-side of §01 (Wiring Requirements injection, gotchas, Pass 0,
> wiring-asset metadata + matrix UI, LRU cap guard) was closed on 2026-05-24 in the **app repo**
> (`docs/superpowers/plans/2026-05-23-generation-quality-closure.md`, executed). This spec covers
> the **game-side** complement, which lives in the **separate UE5 repo** at
> `C:\Users\kazda\Documents\Unreal Projects\PoF` (remote `github.com/xkazm04/pof-exp`, branch `main`).
> Per the §01 README, the game-side outputs are *conventions/scaffolding that make the next
> generation pass produce wired-out-of-the-box code* — not new gameplay.

---

## Why this spec looks different from game.md

`game.md` was written as if none of its conventions existed. A read-only ground-truth pass over the
UE repo on 2026-05-24 (the very discipline §01 preaches) found that **the per-system sub-projects
(folders 02–08) already built most of it.** Re-specifying it from scratch would re-create working
code. So this spec records the **verified current state** of each item and targets only the **delta**.

### Ground-truth table (verified 2026-05-24, paths relative to UE project root)

| game.md item | Status | Evidence (file · symbol) |
|---|---|---|
| §1 DefaultAbilities pattern | **Partial** — abilities done, not generalised | `Source/PoF/Character/ARPGCharacterBase.h` `TArray<TSubclassOf<UGameplayAbility>> DefaultAbilities`; `.cpp` `PossessedBy()` grants each via `GiveAbility` under `HasAuthority()` |
| §2 ARPGCodeWidgetBase | **Done** (base) — one consumer not migrated | `Source/PoF/UI/ARPGCodeWidgetBase.h/.cpp` — `UCLASS(Abstract)`, overrides `RebuildWidget()`, virtual `BuildTree()`, helper toolbox (`MakeBarStyle`, `CreateStyledProgressBar`, `CreateStyledTextBlock`, `AnchorTopLeft/TopCentre/BottomCentre`, `CreateImage`), `DefaultHUDZOrder`. `Source/PoF/UI/VSHUDWidget.h` already extends it. **Not migrated:** `Source/PoF/UI/BossHealthBarWidget.h/.cpp` still builds in `NativeConstruct()` via its own `BuildWidget()`. |
| §3 empty-shell delete/tag | **Partial** — commandlet produces real data, no marker | `Source/PoFEditor/AnimAssetCommandlet.h/.cpp` (run `-run=AnimAsset`) authors `BS_Locomotion`, `AM_MeleeCombo` (3 sections), `AM_Dodge_*`, `CT_XPRequirements`. No `EmptyShell`/`AssetUserData` marker; no PoF-scan detector. |
| §4 lifecycle log header | **Partial** — categories exist, no lifecycle macro | `Source/PoF/Debug/ARPGLogCategories.h/.cpp` declares 10 categories (`LogARPGCombat`…`LogARPGNetwork`). No `LogARPGLifecycle`; `GA_MeleeAttack` still logs via `LogTemp` with a `[GA_MeleeAttack]` text prefix. |
| §5 WITH_EDITOR audit | **Largely addressed** — needs a documented sweep | `Plugins/PillarsOfFortuneBridge/.../Private/PofTestRunner.cpp` `FEditorDelegates::PostPIEStarted` is already `#if WITH_EDITOR`-guarded. `.uplugin` has Runtime + `EditorNoCommandlet` modules; runtime `Build.cs` only adds `UnrealEd` under `bBuildEditor`. No recorded audit of the *rest* of the runtime module. |
| §6 ARPG.SelfCheck.* | **Done** under a different name — Loot missing | `Source/PoF/Debug/ARPGVerifyCommands.cpp` registers `ARPG.Verify.Characters/HUD/Combat/Slice/SliceCI` via `FAutoConsoleCommandWithWorld` (shipping-safe). **Missing:** `ARPG.Verify.Loot` (the death-chain → `ARPGWorldItem` drop check `game.md` §6 explicitly names). |

| tests.md game-side item | Status | Evidence |
|---|---|---|
| #1 CodeWidget pattern test | **Likely covered** — confirm | `Source/PoF/Test/HUD/AVSHUDFunctionalTest.cpp` has a `HUDStructure` phase asserting the VSHUDWidget Slate tree. Confirm it asserts the expected child widgets; add a `BossHealthBarWidget` case once §2 migration lands. |
| #2 DefaultAbilities smoke test | **Partial** — generalise | `Source/PoF/Test/ARPGFunctionalTestBase.h` (`RunPhase`/`ApplyDamage`/`GetHealth`/`WaitForCondition`); `ARPG.Verify.Combat` already checks an ability grants+activates+damages. No standalone "every `DefaultAbilities` entry is granted" assertion. |
| #3 iterate SelfCheck commands | **Missing** | No test iterates the `ARPG.Verify.*` set and fails on any FAIL (`ARPG.Verify.Slice` aggregates structure+damage but not the whole registry). |
| e2e `HARNESS_MODE=wiring-smoke` (live) | **Stand-in exists** | App repo `src/__tests__/registry/wiring-smoke.test.ts` (added 2026-05-24) is the deterministic realization. A *live* Playwright mode does not exist. |
| gemini-recognize plumbing | **Spec-only** | `gemini-recognize.mjs` is **absent** from the app repo — there is nothing to plumb against. Deliverable is a written spec for when/if the CLI is added. |

---

## Per-item design (the delta)

### §1 — Generalise DefaultAbilities into a defaults provider

**Decision:** add an **`IARPGDefaultsProvider`** UINTERFACE (not a component) implemented by
`ARPGCharacterBase`. `PossessedBy` already iterates `DefaultAbilities`; extend the contract so a
feature is wired by *adding an array entry*, never by editing `PossessedBy`. The interface exposes
the defaults `PossessedBy` should apply:

- `GetDefaultAbilities() const → const TArray<TSubclassOf<UGameplayAbility>>&`
- `GetDefaultEffects() const → const TArray<TSubclassOf<UGameplayEffect>>&` (new array; startup GEs)
- `GetDefaultInputContexts() const → const TArray<FARPGDefaultInputContext>&` (IMC + priority; consumed where the player adds IMCs)

`PossessedBy` calls `IARPGDefaultsProvider::Execute_*` on `this` when implemented, applying abilities
(existing loop), then granting each default effect, then leaving IMC application to the existing input
setup (which reads `GetDefaultInputContexts`). Rationale: an interface keeps the data on the character
(where designers already set `DefaultAbilities` in the BP defaults) and avoids a second component to
keep in sync. A component is the fallback only if multiple unrelated actor classes need the same
defaults — not the case today (only `ARPGCharacterBase` and subclasses).

**Out of scope:** changing how abilities are *activated* (input bindings, GAS) — only how defaults are
*declared + applied on possession*.

### §2 — Migrate the last widget onto ARPGCodeWidgetBase

The base and its toolbox already encode both traps (`RebuildWidget` timing; the invisible-empty-
ProgressBar `MakeBarStyle` fix). The only delta is **`BossHealthBarWidget`**, which predates the base
and still builds in `NativeConstruct()`. Reparent it to `UARPGCodeWidgetBase`, move its
`BuildWidget()` body into an override of `BuildTree()`, replace its hand-rolled progress bar with
`CreateStyledProgressBar`, and delete the `NativeConstruct` build call. This removes the last copy of
the `NativeConstruct`-build anti-pattern so future "give me a HUD/overlay" generation has exactly one
example to copy.

### §3 — Make empty shells self-describing

The commandlet now writes *real* data (montage sections, blendspace samples), so the "asset lies"
problem is reduced. The residual gap is detectability. **Decision:** add an `EmptyShell` marker via
`UAssetUserData` so PoF's scan can flag a shell, AND make the commandlet **fail loudly** rather than
silently emit a degenerate asset:

- New minimal `UARPGAssetShellMarker : public UAssetUserData` in the editor module with a
  `bool bEmptyShell` + `FString Reason`. The commandlet attaches it (set `false` on success).
- The commandlet asserts each produced asset has its expected data (e.g. montage has ≥1 section, a
  notify track if required); on failure it logs an error and does **not** save the asset.
- A read-side helper the PoF scan can call (`IsEmptyShell(UObject*)`) reads the marker.

(If the executing engineer judges the `AssetUserData` plumbing disproportionate, the documented
fallback is delete-on-empty only — the commandlet errors and skips, leaving no asset. Pick one;
do not leave a silent empty asset.)

### §4 — A lifecycle log category + macro

Add `LogARPGLifecycle` to `ARPGLogCategories.h/.cpp` and a header
`Source/PoF/Debug/ARPGLifecycleLog.h` with:

```cpp
#define ARPG_LIFECYCLE_LOG(Verbosity, Format, ...) \
    UE_LOG(LogARPGLifecycle, Verbosity, TEXT("[%s] " Format), *FString(__FUNCTION__), ##__VA_ARGS__)
```

so a `BeginPlay`/`PossessedBy`/`Bind*` marker is one call that records the function name and routes to
a greppable category (`LogARPGLifecycle`). Migrate the existing `[GA_MeleeAttack]` and `[VSHUD]`-style
`LogTemp` markers to it. Then "why didn't this run" diagnosis is `grep LogARPGLifecycle` in the live
log. Do **not** mass-convert every log — only lifecycle markers (object came alive / was possessed /
bound a delegate).

### §5 — A recorded WITH_EDITOR audit of the bridge runtime module

This is an **audit + documentation** task, not a refactor (the known offender is already guarded).
Enumerate every editor-only API the runtime module (`PillarsOfFortuneBridge`, not `…Editor`) touches —
`FEditorDelegates`, `GEditor`, `FAssetRegistryModule` editor-only paths, `UnrealEd` types, `WITH_EDITOR`
-only members — and for each either confirm an existing guard, add `#if WITH_EDITOR`, or move it to the
`PillarsOfFortuneBridgeEditor` module. Record the findings in
`Plugins/PillarsOfFortuneBridge/WITH_EDITOR-audit.md`. The pass succeeds if a **Shipping** build of the
runtime module compiles with no editor-only symbol.

### §6 — Add `ARPG.Verify.Loot`

The only missing self-check `game.md` §6 names. Register `ARPG.Verify.Loot` in
`ARPGVerifyCommands.cpp` alongside the others (`FAutoConsoleCommandWithWorld`, shipping-safe):
spawn/find an `AARPGEnemyCharacter`, drive its death (the loot component binds `OnEnemyDeath`
*specifically* on the enemy — not a test dummy — per §01 README), and assert an `ARPGWorldItem`
appears in the world within a short window. Log `ARPG.Verify.Loot: PASS/FAIL` + reason. Add it to the
`ARPG.Verify.Slice` aggregate.

---

## Tests (the delta)

- **CodeWidget pattern test (#1):** confirm `AVSHUDFunctionalTest`'s `HUDStructure` phase asserts the
  expected Slate children; after §2, add a phase/test that constructs the migrated
  `BossHealthBarWidget`, adds it to the viewport, and asserts its tree (catches a `NativeConstruct`
  regression). Reuse `AARPGFunctionalTestBase`.
- **DefaultAbilities smoke test (#2):** an `AARPGFunctionalTestBase` subclass that spawns
  `ARPGCharacterBase`, possesses it, and asserts the ASC has a granted spec for **each**
  `GetDefaultAbilities()` entry (generalises `ARPG.Verify.Combat`'s single-ability assertion).
- **SelfCheck registry iteration (#3):** a functional test (or a `ARPG.Verify.All` command) that runs
  every registered `ARPG.Verify.*` and fails if any logs FAIL. Implement by keeping the verify lambdas
  in a small registry the new command iterates, so adding a future `ARPG.Verify.X` auto-joins.

### App-repo test items (these live in *this* repo, not the UE repo)

- **Live `HARNESS_MODE=wiring-smoke`:** the deterministic vitest stand-in already detects prompt-builder
  regressions without Claude/UE/dev-server. The *live* Playwright mode (one real dispatch per module,
  assert a discoverable `Wiring Requirements` block in the dispatch output JSON) is specced here as the
  e2e counterpart, registered in `e2e/helpers/harness-mode.ts`. It is **opt-in** (requires a running
  dev server + the CLI) and is not part of `npm run validate`.
- **gemini-recognize plumbing:** specced only. When `gemini-recognize.mjs` is (re)added to the repo, a
  Playwright e2e runs it against a committed `e2e/fixtures/<ref>.png` and snapshots the response shape,
  guarding the visual gate the HUD/Characters/PS-3 sub-projects depended on. No code until the CLI
  exists.

---

## What this work is *not*

- Not new gameplay (combat/character/HUD behaviour belong to folders 02–08).
- Not a rewrite of working code — every task starts by re-verifying current state and **skips if
  already satisfied** (the tree is shared and changes under concurrent sessions).
- Not a place to author binary content (WBP/AnimBP/BT/.umap) — those remain editor/commandlet work.

## Constraints for the executing session

- **Separate UE repo**, shared multi-session tree: re-read before edit, `git add` only your files,
  run editor/tests with `-abslog=<unique>.log` (the shared `PoF.log` is clobbered by concurrent
  sessions). Commit narrowly; pushes to `pof-exp` are allowed.
- **Cannot be compiled from the PoF app session** — a UE-capable session with the engine must build
  and run the functional tests (`-ExecCmds="ARPG.Verify.SliceCI"`, the `AFunctionalTest` runner).
- UE5.7 routes FBX import through Interchange; prefer `UnrealEditor.exe -ExecutePythonScript=` over
  `-run=pythonscript` for any asset step (a known §01 gotcha).
