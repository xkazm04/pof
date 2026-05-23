# 09 · Core Engine Generator — UE generation recipes

What PoF generates into the UE project (`github.com/xkazm04/pof-exp`) per module,
and the binary-content boundary per asset type. Each catalog entity is built by a
**GenerationRecipe** — a deterministic pipeline whose steps map 1:1 to the asset
lifecycle in [`README.md`](README.md). The pattern is exactly the one the
character CLI executed this session (and the vertical-slice initiative before it).

## The shared recipe pattern (every entity)

```
scaffold-cpp   →  author-python    →  wire             →  verify
(C++ class +      (BP CDO config /    (CDO + PLACED-       (Automation
 build PoFEditor)  data asset /        INSTANCE writes +    RunTests →
                   material / .umap     grants/links)        Result={Success})
                   via full editor)
```

Hard rules, encoded in every recipe so they are not re-discovered:

- **C++ is built with the editor closed.** New `UCLASS`es need a full rebuild;
  Live Coding can't register them. The build is **monolithic** (one module) —
  in the multi-CLI shared tree it compiles every CLI's in-flight files; commit
  only your own files by exact path.
- **Python authoring uses the full editor** (`UnrealEditor.exe …
  -run=pythonscript` / `-ExecutePythonScript`), and writes a **sidecar log** —
  judge success by log content, not the (benign exit-3) process code.
- **Set class-pointer / object props on the PLACED INSTANCE, not just the CDO.**
  The CDO write persists to the `.uasset`, but within a Python session the spawn
  template can be stale and bake the native default into the `.umap`, silently
  overriding the CDO at runtime. (This cost a test run this session — the enemy
  was possessed by the wrong AI controller.) Recipes set instance overrides +
  read back to verify.
- **`verified` requires a green functional test.** File-existence and
  "compiles" are gameable; an `AFunctionalTest` driving the real GAS/widget/level
  path is the only trustworthy gate. Visual catalogs add the screenshot+Gemini
  gate (folder 08).
- **Gray-box first.** Ship the gameplay-correct gray-box (empty montage +
  fallback, primitive mesh, flat material), mark the art as a later lifecycle
  refinement — never block `verified` on art.

## Per-module recipes

### Spellbook — `AbilityEntry` (Round-1 reference; pure-code, no wall)

- **scaffold-cpp:** `UGameplayAbility` subclass (e.g. `UGA_Fireball`) +, if new,
  a `UGameplayEffect` (`GE_*`) and gameplay-tag registration. Default the
  `DamageEffect`/cost in C++ so the raw class is grantable without a config-BP
  (the `GA_EnemyMeleeAttack` pattern). Apply the **gray-box fallback** for
  montage-gated abilities (`bUsingFallbackWindow`) so damage lands with an empty
  montage.
- **author-python:** optional `BP_GA_*` config asset (only if a designer needs
  per-instance tuning); else skip.
- **wire:** grant via the owner's `DefaultAbilities`/`GrantedAbilities`;
  register the activation tag.
- **verify:** `AVS*AbilityTest` — activate by tag, assert the effect (target
  Health/attribute changes). Mirrors `AVSEnemyAttackTest`.
- **boundary:** fully text/Python authorable. No wall.

### Bestiary — `EnemyEntry` (composes Ability + Loot)

- **scaffold-cpp:** reuse `AARPGEnemyCharacter` + `ARPGSimpleAIController`
  (shipped) ; new behaviour only if an archetype needs it.
- **author-python:** `BP_*Enemy` — set archetype, mesh/material (gray-box or
  mannequin), `AIControllerClass`, `GrantedAbilities` (linked Spellbook entries),
  loot-table link (linked Loot entry), health-bar widget class.
- **wire:** `AutoPossessAI`, `AIControllerClass` **on the placed instance** in
  any test/encounter map; grant abilities on possession.
- **verify:** `AVSBestiary_*Test` — spawn, assert it chases + attacks (player
  takes damage) and drops loot on death.
- **boundary:** Python-authorable CDO/instance; **Behaviour Trees are the wall**
  — the shipped pure-C++ controller sidesteps it (no BT asset needed).

### Items — `ItemEntry` (pure data assets)

- **scaffold-cpp:** `UARPGItemDefinition` (`UPrimaryDataAsset`) class + affix
  types (one-time; the class already exists).
- **author-python:** one **data-asset instance** per item (stats, slot, rarity,
  affixes, icon ref). Bulk-friendly — hundreds of rows from the catalog.
- **wire:** register in the item registry / asset manager scan path.
- **verify:** `AVSItems_DefinitionsTest` — load all definitions, assert required
  fields non-empty, slots valid, icons resolve.
- **boundary:** fully Python-authorable. Icons via Leonardo (download-then-delete
  per the Leonardo-cleanup rule) → imported as textures.

### Loot Tables — `LootTableEntry` (pure data assets; links Items)

- **scaffold-cpp:** `UARPGLootTable` class (exists).
- **author-python:** data-asset instances — weighted entries referencing Item
  entries, rarity-bonus multipliers, roll counts.
- **wire:** assign the table to Bestiary entries / chest actors.
- **verify:** `AVSLoot_TableTest` — roll N times headless, assert the empirical
  drop distribution matches the configured weights within tolerance.
- **boundary:** fully Python-authorable.

### Combat Map — `CombatInteraction` (mostly relationships + tuning)

- **scaffold-cpp:** damage-execution / hit-react classes (largely exist).
- **author-python:** damage `DataTable` rows; hit-react montage **shells**.
- **wire:** connect Spellbook abilities → reactions → damage types; tuning.
- **verify:** `AVSCombat_DamageMatrixTest` — for each interaction, apply the
  ability and assert the expected damage/reaction on the target.
- **boundary:** montage **notify graphs** are the wall → use the gray-box
  fallback + a test-only damage notify (folder 08 §5) until real montages land.

### Screen Flow — `ScreenEntry` (pure-C++ widgets; no WBP wall)

- **scaffold-cpp:** pure-C++ `UUserWidget` subclasses (folder 04's
  `UARPGCodeWidgetBase`; build the tree in `RebuildWidget`, **not**
  `NativeConstruct` — the timing trap) + a screen-flow state machine
  (push/pop/replace).
- **author-python:** set `HUDClass`/widget classes on the GameMode/PlayerController
  CDO + instances; no `.wbp` needed.
- **wire:** register screens in the flow state machine; bind GAS attributes.
- **verify:** `AVSScreen_*Test` + screenshot+Gemini — assert the widget mounts,
  binds, and transitions; the bar moves on attribute change (the HUD CLI path).
- **boundary:** WBP assets are the wall → pure-C++ widgets sidestep it entirely.

### Zone Map — `ZoneEntry` (level building; links Bestiary)

- **scaffold-cpp:** any zone-logic actors (portals, hazards, encounter triggers).
- **author-python:** **build the `.umap`** (`LevelEditorSubsystem.new_level` +
  `EditorActorSubsystem.spawn_actor_from_class` + `save_current_level` — the
  `build_vertical_slice.py` pattern): floor/geometry, lights, player start,
  spawn points placing Bestiary entries, portals, a `NavMeshBoundsVolume` when
  enemies must path (the chase upgrade noted in the character roadmap).
- **wire:** set the level's GameMode; link portals between zones; place encounter
  spawners referencing Bestiary entries.
- **verify:** `AVSZone_*Test` placed in the map — assert player spawns, nav
  exists, an encounter triggers; screenshot+Gemini for layout.
- **boundary:** `.umap` is Python-buildable; complex Blueprint event graphs on
  placed actors are the wall (prefer C++ actor logic).

### State Graph — `AnimationEntry` (the widest wall — sequence last)

- **scaffold-cpp:** `UARPGAnimInstance` + anim-notify classes (exist).
- **author-python:** Mixamo FBX **import + retarget** (the `mixamo_*.py`
  pipeline); **montage shells**; locomotion blendspace data via the editor
  commandlet.
- **wire:** assign the AnimBP class + montages on the character mesh component
  (CDO + instance).
- **verify:** `AVSAnim_LocomotionTest` — possess, drive movement, assert the
  AnimInstance state/locomotion values update; screenshot for pose.
- **boundary:** **AnimBP graphs and montage notify graphs are the wall** — the
  state machine and notify wiring are authored manually. The catalog's detail
  drawer surfaces an explicit **manual-step checklist** for these; the recipe
  generates everything around them and stops cleanly at the wall.

## Binary-content boundary — consolidated

| Asset type | Generatable? | How |
|---|---|---|
| Gameplay classes (GA/GE/AttributeSet/AIController/widget/data-asset classes/tests) | ✅ C++ | scaffold-cpp + build |
| Blueprint **CDO/config**, **placed actors + instance overrides** | ✅ Python | author-python + wire (set on instance!) |
| **Data assets** (ItemDefinition, LootTable, DataTables) | ✅ Python | author-python (bulk) |
| **Materials / material instances** | ✅ Python | `MaterialEditingLibrary` (mind the `Constant3Vector` empty-output-pin gotcha) |
| **Levels (`.umap`)** + placement + nav volumes | ✅ Python | `LevelEditorSubsystem` + `EditorActorSubsystem` |
| **Montage shells** (no notifies) | ✅ Python/commandlet | author-python; gray-box fallback covers the empty window |
| Pure-C++ UMG widgets | ✅ C++ | scaffold-cpp (`RebuildWidget`, not `NativeConstruct`) |
| Textures / icons | ✅ external | Leonardo/PolyHaven → import (download-then-delete) |
| **AnimBP graphs**, **Behaviour Trees**, **montage notify graphs**, complex **BP event graphs** | ❌ the wall | manual step, surfaced in the detail drawer; recipes route around it (pure-C++ controller, gray-box fallback, test-only notify) |

The takeaway from shipping the slice: **most "assets" are Python-authorable**;
the wall is specifically the node-graph editors. Recipes generate up to the wall,
verify with a functional test, and flag the manual remainder — never silently
skip it, never fake `verified`.
