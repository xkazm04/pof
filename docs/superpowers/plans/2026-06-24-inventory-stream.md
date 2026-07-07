# Inventory Stream Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. This is Stream 4 of `docs/parallel-development-plan.md`.

**Goal:** A chest holding a health potion — loot it, the potion enters the player's inventory, an inventory UI shows it, and using it heals the player 50→100 — all proven by a headless ground-truth observation + a read frame of the inventory UI (the project law: no "done" without a frame/observation).

**Architecture:** Assemble + verify, not build-from-scratch. The UE5.8 project already has `UARPGInventoryComponent` (full add/use/equip, attached to every character by Phase 0), `AARPGLootChest` (open → roll loot table → spawn `AARPGWorldItem`s), `AARPGWorldItem::TryPickup` (full inventory `AddItem` path, gated behind `bSliceMode=false`), `GE_Heal` (+25), and inventory UMG C++ classes. The work is: author the potion + a +50 heal GE + a loot table, flip chest loot to inventory routing, build a lit `Test_Inventory` map, add a self-contained C++ inventory HUD widget that renders reliably headless, and extend the runtime `ScenarioController` to set start-health, loot the chest, use the potion, observe inventory contents + health, and capture a UI frame (screenshot-with-UI, not the 3D scene-capture path).

**Tech Stack:** UE 5.8 C++ (GAS, UMG/Slate, Actor components), UnrealEditor headless Python (`-run=pythonscript`), the project's runtime `UScenarioController` observation harness, bundled-dotnet UBT build.

## Global Constraints

- **Worktree:** all UE changes happen in `C:\Users\kazda\Documents\Unreal Projects\PoF-inventory` on branch `feature/inventory` (off `main` @ `3ffd972`). Never touch the sibling `…\PoF` checkout.
- **Ownership (don't edit other streams' zones):** this stream owns `Source/PoF/Inventory/*`, `Source/PoF/UI/*`, `Source/PoF/Loot/*` (the loot/chest flow), `Content/Inventory/`, `Content/UI/Inventory/`, and the map `Content/Maps/Test_Inventory.umap`. `Source/PoF/Testing/ScenarioController.*` is a shared harness — edits there must be **additive** (new event names + new observation fields only; never change existing behavior).
- **Do NOT edit `ARPGCharacterBase`** — Phase 0 already attached `UARPGInventoryComponent`. Use it; don't re-add it.
- **Verification law:** every task ends with a build-green gate and/or a ground-truth gate (a harness observation or a read frame). No task is "done" on a symbolic check alone.
- **Build recipe:** `cmd /c '"C:\Program Files\Epic Games\UE_5.8\Engine\Build\BatchFiles\Build.bat" PoFEditor Win64 Development -project="C:\Users\kazda\Documents\Unreal Projects\PoF-inventory\PoF.uproject" -waitmutex'` (run via PowerShell tool through `cmd /c`; Git Bash mangles the spaced engine path). Incremental rebuilds ≈ 1–2 min.
- **Headless Python recipe:** `UnrealEditor-Cmd.exe "<uproject>" -run=pythonscript -script="<py>" -unattended -nopause -nosplash -NoLiveCoding` (exits cleanly).
- **Headless scenario/capture recipe:** `UnrealEditor-Cmd.exe "<uproject>" /Game/Maps/Test_Inventory -game -PoFScenario="<json>" -RenderOffScreen -benchmark -fps=60 -unattended -nopause -nosplash -NoLiveCoding` (MSYS_NO_PATHCONV=1 from Git Bash; quote the `-PoFScenario` path; inbox JSON via fwd-slashes, no BOM).
- **Capture needs a LIT map** (memory `project-llm-ue-interface`): movable lights are enough for the scene; `Test_Inventory` is a copy of the lit `Arena_Ancient`/`VerticalSlice`.
- **App↔UE catalog lockstep:** the app's seeded `item-7` is "Minor Health Potion" (memory `project-pipeline-data-contract`). Match the UE potion's display name/type to it; do not invent a divergent name.

---

### Task 1: +50 heal GameplayEffect (`UGE_HealthPotion`)

**Why:** `GE_Heal` heals +25; the acceptance is 50→100 (+50). `UseItem` applies `OnUseEffect` at level 1.0 with no SetByCaller, so a fixed-magnitude GE is the clean path. Additive new class — no edit to shared `GE_Heal`.

**Files:**
- Read first: `Source/PoF/AbilitySystem/Effects/GE_Heal.h` + `GE_Heal.cpp` (model the new GE on it — same IncomingHeal meta-attribute modifier, magnitude 50).
- Create: `Source/PoF/AbilitySystem/Effects/GE_HealthPotion.h`
- Create: `Source/PoF/AbilitySystem/Effects/GE_HealthPotion.cpp`

**Interfaces:**
- Produces: `class UGE_HealthPotion : public UGameplayEffect` — an instant GE that adds +50 to the `IncomingHeal` meta attribute (whatever attribute/modifier `GE_Heal`'s ctor uses; copy its construction verbatim and change the magnitude constant to `50.f`). Referenced later by `DA_HealthPotion.OnUseEffect` (Task 3) and asserted by Task 8's automation test.

- [ ] **Step 1:** Read `GE_Heal.cpp` to learn the exact ctor (the meta attribute it modifies, e.g. `UARPGAttributeSet::GetIncomingHealAttribute()`, `EGameplayEffectDurationType::Instant`, `FGameplayModifierInfo` with `FScalableFloat(25.f)`).
- [ ] **Step 2:** Write `GE_HealthPotion.h` (mirror `GE_Heal.h`, doc comment "+50 HP", class `UGE_HealthPotion`).
- [ ] **Step 3:** Write `GE_HealthPotion.cpp` — identical to `GE_Heal.cpp`'s ctor but magnitude `50.f`.
- [ ] **Step 4:** Build (recipe above). Gate: `Result: Succeeded`.
- [ ] **Step 5:** Commit in the worktree: `feat(inventory): GE_HealthPotion (+50 instant heal)`.

---

### Task 2: Route chest loot into the inventory (un-gate the existing pickup path)

**Why:** `AARPGWorldItem::TryPickup` already implements the full `Inventory->AddItem(...)` path (ARPGWorldItem.cpp:196-257) + auto-pickup-on-overlap (:282-295), but every world item defaults to `bSliceMode=true` (VFX + destroy, no inventory). Chest-spawned potions must route to inventory.

**Files:**
- Modify: `Source/PoF/Loot/ARPGWorldItem.h` — change `InitFromItemInstance` signature to `void InitFromItemInstance(UARPGItemInstance* InInstance, bool bRouteToInventory = false);` (default keeps existing callers' slice behavior).
- Modify: `Source/PoF/Loot/ARPGWorldItem.cpp` — in `InitFromItemInstance`, after binding the instance, add `bSliceMode = !bRouteToInventory;`.
- Modify: `Source/PoF/Loot/ARPGLootChest.cpp` — in `SpawnLoot()`, change the `WorldItem->InitFromItemInstance(AllItems[i])` call to `WorldItem->InitFromItemInstance(AllItems[i], /*bRouteToInventory=*/true);`. Also set the spawned item's `AutoPickupMaxRarity` high enough that the potion (Common) auto-picks up — Common already qualifies, so no change needed; verify.

**Interfaces:**
- Consumes: nothing new.
- Produces: chest-spawned `AARPGWorldItem`s with `bSliceMode=false` → overlap by a character with a `UARPGInventoryComponent` calls `AddItem` (the potion enters inventory). Task 6 observes the result.

- [ ] **Step 1:** Read `ARPGLootChest.cpp` `SpawnLoot()` fully (confirm the `InitFromItemInstance` call site + scatter radius; note `ItemScatterRadius=150`, `AutoPickupDelay=0.5`, `PickupRadius=100`).
- [ ] **Step 2:** Edit the header signature + cpp body (`bSliceMode = !bRouteToInventory;`) + the chest call site.
- [ ] **Step 3:** Build. Gate: `Result: Succeeded`.
- [ ] **Step 4:** Commit: `feat(inventory): chest loot routes to the looter's inventory (bSliceMode off)`.

> Note: deterministic auto-pickup in headless depends on the potion landing within `PickupRadius` of the player and `AutoPickupDelay` elapsing. Task 5 places the chest adjacent to the PlayerStart and Task 7 tunes scatter/timing against real observations.

---

### Task 3: Author the health-potion item + loot table (headless Python)

**Why:** No consumable item exists yet (only `DA_IronLongsword`). Need `DA_HealthPotion` (Consumable, `OnUseEffect=GE_HealthPotion`, a `WorldMesh`) and a loot table that drops it 100%.

**Files:**
- Create: `Content/Python/inventory_stream/author_potion.py` — creates/saves a `UARPGItemDefinition` at `/Game/Inventory/DA_HealthPotion` with: `DisplayName="Minor Health Potion"` (matches app `item-7`), `Description`, `Type=EARPGItemType::Consumable`, `Rarity=Common`, `MaxStackSize=10`, `BaseValue`, `Weight=0.5`, `ItemTags` += `Item.Consumable.Potion`, `OnUseEffect = UGE_HealthPotion` class, `WorldMesh = /Engine/BasicShapes/Cube` (placeholder; a sphere/cylinder is fine — visible mesh so the world item shows). Use `unreal.AssetToolsHelpers.get_asset_tools().create_asset(...)` + `EditorAssetLibrary.save_asset`. Resolve the GE class via `unreal.load_class(None, '/Script/PoF.GE_HealthPotion')`.
- Create: `Content/Python/inventory_stream/author_loot.py` — creates/saves a `UARPGLootTable` (read `Source/PoF/Loot/ARPGLootTable.h` for the exact row/entry struct + how entries reference an item definition; many loot tables hold an array of `{Definition, Weight, DropChance}` or `{ItemDef, MinCount, MaxCount}`) at `/Game/Inventory/LT_ChestPotion` with one entry: `DA_HealthPotion`, drop chance 100%, count 1.

**Interfaces:**
- Consumes: `UGE_HealthPotion` (Task 1).
- Produces: assets `/Game/Inventory/DA_HealthPotion` and `/Game/Inventory/LT_ChestPotion`. Task 5 assigns `LT_ChestPotion` to the chest; Task 8 loads `DA_HealthPotion`.

- [ ] **Step 1:** Read `Source/PoF/Loot/ARPGLootTable.h` to learn the loot-table entry schema (field names, whether it's a UDataAsset or DataTable-backed, and the `RollLoot` contract).
- [ ] **Step 2:** Write `author_potion.py`. Run it via the headless Python recipe.
- [ ] **Step 3:** Gate: log shows the asset saved; verify with a one-liner Python (`EditorAssetLibrary.does_asset_exist('/Game/Inventory/DA_HealthPotion')` → True) and that its `Type`==Consumable and `OnUseEffect` is non-null.
- [ ] **Step 4:** Write `author_loot.py`. Run it. Gate: `LT_ChestPotion` exists and references `DA_HealthPotion`.
- [ ] **Step 5:** Commit (assets + scripts): `feat(inventory): author Minor Health Potion + chest loot table`.

---

### Task 4: Self-contained inventory HUD widget (`UInventoryHudWidget`)

**Why:** The UI frame is mandatory and must render in headless `-RenderOffScreen`. The existing `InventoryScreenWidget` needs a WBP with `BindWidget` sub-widgets (painful to author headless and fragile to capture). A fully code-built `UUserWidget` (no `BindWidget`, no asset) renders deterministically and reads the inventory directly.

**Files:**
- Create: `Source/PoF/UI/InventoryHudWidget.h`
- Create: `Source/PoF/UI/InventoryHudWidget.cpp`

**Interfaces:**
- Produces: `class UInventoryHudWidget : public UUserWidget` with `UFUNCTION(BlueprintCallable) void BuildFromInventory(UARPGInventoryComponent* Inventory);` — in C++ it programmatically constructs (via `WidgetTree->ConstructWidget`) a centered `UBorder` (semi-opaque dark background, e.g. `FLinearColor(0,0,0,0.8)`) containing a titled `UVerticalBox` listing one row per occupied inventory slot: item display name + " x" + stack count (a `UTextBlock`; include the icon via `UImage` if the soft texture loads, else text-only). Empty inventory → a "(empty)" row. Rebuilds on call. Used by `ScenarioController` (Task 5) which creates it, calls `BuildFromInventory(player inventory)`, and `AddToViewport()`.

- [ ] **Step 1:** Write `InventoryHudWidget.h` (the class + `BuildFromInventory` + a `TObjectPtr<UVerticalBox> ListBox` cached member). Includes: `Blueprint/UserWidget.h`.
- [ ] **Step 2:** Write `InventoryHudWidget.cpp`: in `BuildFromInventory`, clear/rebuild the tree — `WidgetTree->ConstructWidget<UBorder>`, set as root via `WidgetTree->RootWidget`; nest a `UVerticalBox`; for each `Inventory->GetAllItems()` add a `UTextBlock` with `FText::Format("{0}  x{1}", DisplayName, StackCount)`, font size ~28, white. Guard nulls. (UMG widget-tree-in-C++ pattern; reference any existing code-built widget in `Source/PoF/UI/` or the `ARPGHUDWidgetTest`.)
- [ ] **Step 3:** Build. Gate: `Result: Succeeded`.
- [ ] **Step 4:** Commit: `feat(inventory): code-built InventoryHudWidget (headless-renderable)`.

---

### Task 5: Extend `ScenarioController` — start-health, loot, use, inventory observation, UI capture (additive)

**Why:** The harness reads combat/anim only. Add (additively) the verbs + observations the inventory proof needs. Read `Source/PoF/Testing/ScenarioController.h` + `.cpp` first (config parse block, `ApplyInputs`/event dispatch, `DoSample` observation writer, and the frame-capture code).

**Files:**
- Modify: `Source/PoF/Testing/ScenarioController.h` — add config fields `float StartHealth = -1.f;` (−1 = unchanged), `bool bShowInventoryUI = false;`; declare helpers `void HandleLootChest();`, `void HandleUseItem();`, `void EnsureInventoryUI();`. Forward-declare `UInventoryHudWidget`, `UARPGInventoryComponent`, `AARPGLootChest`.
- Modify: `Source/PoF/Testing/ScenarioController.cpp`:
  - In config parsing: read `start_health`, `show_inventory_ui` from the scenario JSON.
  - At settle (when inputs begin): if `StartHealth >= 0`, set the player's `Health` attribute to `StartHealth` via `ASC->SetNumericAttributeBase(UARPGAttributeSet::GetHealthAttribute(), StartHealth)` (match how the controller already reads Health).
  - New gameplay events in the event dispatch (alongside `activate_ability`): `event=="loot_chest"` → `HandleLootChest()` (find nearest `AARPGLootChest`, `TryOpen(Player)`); `event=="use_item"` → `HandleUseItem()` (`Player->InventoryComponent->UseFirstConsumable()` or `UseItem(firstConsumableSlot)`).
  - `EnsureInventoryUI()`: if `bShowInventoryUI`, `CreateWidget<UInventoryHudWidget>(PlayerController)`, `BuildFromInventory(player inventory)`, `AddToViewport()`; call it (and rebuild) right before the UI capture sample so it reflects post-loot contents.
  - In `DoSample`: add observation fields — `inventory_count` (`Inventory->GetItemCount()`), `has_potion` (`Inventory->HasItem(DA_HealthPotion)` — load the def by path, or check by name/tag), and `inventory` (array of `{name, count}` from `GetAllItems()`).
  - UI capture: add a path that, when `bShowInventoryUI`, captures the **viewport with UI** (not the 3D SceneCapture2D). Use `FScreenshotRequest::RequestScreenshot(Filename, /*bShowUI=*/true, /*bAddUniqueSuffix=*/false)` (or `GScreenshotConfig`/`HighResShot` console command) and flush a frame so the PNG includes the UMG overlay. Write it as a distinctly-named frame (e.g. `ui_frame.png`) so Task 7 reads it.

**Interfaces:**
- Consumes: `UInventoryHudWidget::BuildFromInventory` (Task 4); `UARPGInventoryComponent::{UseFirstConsumable,GetItemCount,HasItem,GetAllItems}`; `AARPGLootChest::TryOpen`.
- Produces: scenario JSON keys `start_health`, `show_inventory_ui`, events `loot_chest`/`use_item`; observations `inventory_count`/`has_potion`/`inventory`; frame `ui_frame.png`. Task 7 drives + reads these.

- [ ] **Step 1:** Read `ScenarioController.h`/`.cpp` (config parse, event dispatch, `DoSample`, capture). Identify the exact attribute accessor + player-ref + capture function in use.
- [ ] **Step 2:** Add header fields/decls.
- [ ] **Step 3:** Implement config parsing + start-health set + `HandleLootChest` + `HandleUseItem` + `EnsureInventoryUI` + new observations + UI screenshot path. Keep every change additive (existing scenarios behave identically when the new keys are absent / default).
- [ ] **Step 4:** Build. Gate: `Result: Succeeded`.
- [ ] **Step 5:** Commit: `feat(harness): inventory scenario verbs + observations + UI-frame capture (additive)`.

---

### Task 6: Build the lit `Test_Inventory` map (headless Python)

**Files:**
- Create: `Content/Python/inventory_stream/build_test_inventory_map.py` — duplicate the lit `Content/Maps/Arena_Ancient.umap` (or `VerticalSlice`) to `/Game/Maps/Test_Inventory`; ensure a `PlayerStart` exists; spawn an `AARPGLootChest` ~200u in front of the PlayerStart with `LootTable=/Game/Inventory/LT_ChestPotion`, `NumRolls=1`, and a small `ItemScatterRadius` (e.g. 60) so the potion lands within the player's pickup radius; confirm the default pawn is the GAS player (`BP_VSPlayer`/`BP_JediPlayer`) so it carries `UARPGInventoryComponent`; `save_current_level()`.

**Interfaces:**
- Consumes: `LT_ChestPotion` (Task 3), `AARPGLootChest`.
- Produces: `/Game/Maps/Test_Inventory` with player + a potion-loaded chest. Task 7 runs scenarios on it.

- [ ] **Step 1:** Confirm `Arena_Ancient`/`VerticalSlice` GameMode default pawn carries the inventory component (it does — Phase 0 put it on `ARPGCharacterBase`).
- [ ] **Step 2:** Write + run the map builder. Gate: `Test_Inventory` exists; opening it headless spawns a player + one chest (log).
- [ ] **Step 3:** Commit (map + script): `feat(inventory): Test_Inventory map — player + potion chest`.

---

### Task 7: End-to-end headless proof (the acceptance gate)

**Why:** The hard acceptance: loot → inventory contains potion → use → Health 50→100 → a read frame of the inventory UI.

**Files:**
- Create: `shots/inventory/inv-loot-heal.json` (in the worktree) — scenario: `map=/Game/Maps/Test_Inventory`, `start_health=50`, `show_inventory_ui=true`, `total_seconds≈4`, `num_samples≈8`, timeline events: `loot_chest`@0.6s, (player auto-picks up the scattered potion over the next ~0.6s), `use_item`@2.5s. (If auto-pickup proves unreliable, add a short forward `Move` input toward the chest, or shrink scatter/raise pickup radius.)

**Interfaces:**
- Consumes: everything above.
- Produces: `observations.json` + frames (incl. `ui_frame.png`) under the worktree's `Saved/`.

- [ ] **Step 1:** Write `inv-loot-heal.json`. Run the headless scenario/capture recipe on `Test_Inventory`.
- [ ] **Step 2:** Read `observations.json`. Gate A (loot): a sample after `loot_chest` has `has_potion=true` / `inventory_count>=1`. Gate B (heal): `health≈50` before `use_item`, `health≈100` after.
- [ ] **Step 3:** `Read` `ui_frame.png`. Gate C (UI frame, mandatory): the frame shows the inventory panel listing "Minor Health Potion". Describe what's actually visible — no claiming success without seeing it.
- [ ] **Step 4:** If any gate fails, iterate (timing/positioning/capture) against the observations — do not adjust the assertions to pass. Re-run until all three gates pass on real output.
- [ ] **Step 5:** Commit the scenario + a short `shots/inventory/RESULT.md` noting the observed numbers + frame description: `test(inventory): e2e loot→heal proof (health 50→100, UI frame read)`.

---

### Task 8: Durable automation test (regression gate)

**Why:** Stream rule — every step is tested. A C++ automation test locks the loot→use→heal contract so it can't silently regress (complements the harness proof).

**Files:**
- Create: `Source/PoF/Test/Inventory/VSInventoryPotionTest.cpp` — mirror the Phase-C tick-gated pattern from `Source/PoF/Test/Items/VSItemsDefinitionsTest.cpp`. In `StartTest`: spawn an `AARPGCharacterBase` (or use the player), set Health=50; load `DA_HealthPotion`; `Inventory->AddItem(DA_HealthPotion, 1)`. On first tick ≥0.2s: assert `Inventory->HasItem(DA_HealthPotion)`; call `Inventory->UseItem(slot)`; assert Health == 100 (±1) and the potion stack decremented. `FinishTest(Passed/Failed, reason)`.
- Create: `Content/Maps/VSInvPotion.umap` (or reuse a minimal test map) if the automation harness needs a map.

**Interfaces:**
- Consumes: `DA_HealthPotion`, `UGE_HealthPotion`, `UARPGInventoryComponent`.
- Produces: automation test `FVSInventoryPotionTest` runnable via `Automation RunTests` / the project's `VS*Test` mechanism.

- [ ] **Step 1:** Read `VSItemsDefinitionsTest.cpp` for the exact base class + tick-gate pattern.
- [ ] **Step 2:** Write `VSInventoryPotionTest.cpp`.
- [ ] **Step 3:** Build. Gate: `Result: Succeeded`.
- [ ] **Step 4:** Run it headless (`UnrealEditor-Cmd … -ExecCmds="Automation RunTests VSInventoryPotion;Quit" -unattended -nullrhi -abslog=…`). Gate: abslog shows the test `Result={Success}` (judge by marker, not exit code).
- [ ] **Step 5:** Commit: `test(inventory): VSInventoryPotionTest locks loot→use→heal`.

---

### Task 9: Integrate-readiness + handoff

- [ ] **Step 1:** Confirm the worktree builds clean (`Result: Succeeded`) and the Task 7 gates + Task 8 test are green.
- [ ] **Step 2:** Update memory `project-pipeline-data-contract`/a new `project-inventory-stream` note with what was built + the harness verbs added + any gotchas (e.g. UMG headless capture mechanism).
- [ ] **Step 3:** Per `docs/parallel-development-plan.md`, the integrator merges `feature/inventory` to `main` when the private-map capture passes. Summarize the deliverables + the read-frame/observation evidence for the merge. (Do not self-merge unless asked.)

## Self-Review

- **Spec coverage:** chest (Task 5/6) · health potion item (Task 3) · GAS heal effect (Task 1) · loot flow into `UInventoryComponent` (Task 2) · inventory UI display (Task 4/5) · use → Health 50→100 (Task 5/7) · headless observation proof (Task 7) · UI frame (Task 4/5/7) · test (Task 8). All Stream-4 deliverables mapped.
- **Type consistency:** `UGE_HealthPotion` (T1) → `DA_HealthPotion.OnUseEffect` (T3) → `UseItem` (T5/T7/T8). `InitFromItemInstance(InInstance, bRouteToInventory)` (T2) used by chest (T2). `UInventoryHudWidget::BuildFromInventory` (T4) called by `ScenarioController::EnsureInventoryUI` (T5). `start_health`/`show_inventory_ui`/`loot_chest`/`use_item`/`has_potion`/`inventory_count` consistent across T5↔T7.
- **Risks called out:** deterministic auto-pickup timing (T2 note, T7 step 4 iteration); UMG-in-headless capture (T4 self-contained widget + T5 screenshot-with-UI path); loot-table schema unknown until T3 step 1 reads the header; exact GAS attribute accessor unknown until T5 step 1 reads the controller.
