# PoF Catalog Pipeline Program

The plan to take every catalog entity from **idea → UE asset → live test**. Source of truth: `game_catalog_pipelines.xlsx` (parsed into [`_sheet.json`](_sheet.json); regenerate the per-row briefs with `node docs/catalog/_generate.mjs`).

## Vision

One year out, the whole catalog asset pipeline is automated — design through 2D/3D, audio/VFX, UI, and into a playable, test-gated UE build. This tree is how we get there: every catalog entity is a row with an explicit pipeline, and each row is buildable by a single focused session.

## The execution contract (one CLI, one entity, end-to-end)

Each catalog row is owned by **one Claude Code CLI**, at highest effort:

1. **Design well.** Read this index + the row's `plan.md`. Design the entity's schema and rules before producing assets.
2. **Make one asset start → end.** Drive the row's **one named target asset** through *every* pipeline step (idea → real UE asset → passing test gate), reusing existing PoF capabilities wherever they exist and producing real artifacts. Where a capability is missing, build a minimal real version or record a gap — do not fake a step.
3. **Document for future sessions.** Fill the row's `## Session Findings` with **cross-catalog opportunities** discovered and **gaps/blockers**, and append one-liners to the two living logs at the bottom of this index so knowledge compounds across sessions.

A session is "complete" when the target asset exists in the UE project, its **test gate** passes (or the gate's blocker is documented), and the findings are recorded.

## Common pipeline shape

Most rows follow: **Brief → Schema/Rules → Balancing → 2D → 3D → Material → Animation → VFX → SFX → UI/Integration → Localization → Test Gate → UE Packaging.** The spreadsheet intentionally splits the old monolithic "Logic" step into finer rule/data/balancing steps for RPG-heavy entities. Each row's exact steps live in its `plan.md`.

## Agent roles (per-step ownership)

Each step is ownable by a specialized agent: **Designer · Writer · Concept2D · 3DGen · Rigger · Animator · VFX · Audio · Balancer · QA · Packager.** A session plays whichever roles its steps require, in sequence.

## Test gate

A **test gate** is an explicit pass/fail checkpoint (automated + human) before an asset is promoted to a UE asset. In PoF this is a UE **functional test** (judged by the `-abslog`, since the headless editor exits non-zero on a benign shutdown crash) plus, where relevant, an agentic screenshot + Gemini visual check.

## How this maps to PoF systems

- **Catalogs** — every row is a registered catalog in `src/lib/catalog/sections.ts` (`CATALOG_SECTIONS`), keyed by `catalogId`; the 21 new ones are driven by `src/lib/catalog/new-catalogs.ts`. Entities carry a `lifecycle` (`planned → scaffolded → generated → wired → verified`/`failed`) persisted via `catalog-db.ts` / `/api/catalog`.
- **Pipeline tracks** — `src/lib/pipeline/tracks.ts` maps each catalog to the 8 production tracks (`logic · ai · art-2d · art-3d · animation · audio · vfx · test`). The fine 12–17-step model lives in these briefs; deepening the app's track model is a later Mission-Control redesign.
- **Dispatches / generators to reuse** — the CLI task system (`src/lib/cli-task.ts`): GAS C++ codegen (`generate-gas-effects`, see the B3 work), Leonardo 2D image generation, the Blender MCP pipeline, `import_audio_set` for SFX, the procgen/scatter level dispatches, and the `evaluate-track` assessment task. Recipes (`src/lib/catalog/recipe.ts`) drive scaffold→generate→wire→verify for catalogs that register one.
- **Live State** — `LiveStateTab` lists every catalog grouped by category with per-entity lifecycle/test status; progress shows up there as a session advances an entity.
- **Presentation-catalog binding** — `vfx`, `icon-sets`, `hud-elements`, `audio`, `music`, `ambient` are **shared presentation libraries**, not per-asset work. A content row's VFX/SFX/Icon/UI steps mean *bind to a presentation-catalog entry* via a `CatalogLink` — use `presentationLink(role, entityId)` from `src/lib/catalog/presentation-links.ts` (`role`: icon · vfx · sfx · music · ambient · hud). Produce the presentation entry once, reference it from every consumer. (And note: a GAS GameplayEffect and a `status-effects` entry are the same UE artifact — generating one can seed both.)

## Catalog index (30 rows)

| Category | Entity | Catalog | Status |
|----------|--------|---------|--------|
| Core / Existing | [Item](core-existing/item/plan.md) | `items` | existing |
| Core / Existing | [Loot Table](core-existing/loot-table/plan.md) | `loot-tables` | existing |
| Core / Existing | [Bestiary Entry](core-existing/bestiary-entry/plan.md) | `bestiary` | existing |
| Core / Existing | [Combat Map](core-existing/combat-map/plan.md) | `combat-map` | existing |
| Core / Existing | [Zone Map](core-existing/zone-map/plan.md) | `zone-map` | existing |
| Core / Existing | [Screen Flow](core-existing/screen-flow/plan.md) | `screen-flow` | existing |
| Core / Existing | [State Graph](core-existing/state-graph/plan.md) | `state-graph` | existing |
| Core / Existing | [Material](core-existing/material/plan.md) | `materials` | existing |
| Quests & Narrative | [Quest](quests-narrative/quest/plan.md) | `quests` | new |
| Quests & Narrative | [Dialog Tree](quests-narrative/dialog-tree/plan.md) | `dialog-trees` | new |
| Quests & Narrative | [Cutscene / Cinematic](quests-narrative/cutscene-cinematic/plan.md) | `cutscenes` | new |
| Quests & Narrative | [Codex / Lore Entry](quests-narrative/codex-lore-entry/plan.md) | `codex` | new |
| Quests & Narrative | [Faction / Reputation System](quests-narrative/faction-reputation-system/plan.md) | `factions` | new |
| Game Assets | [Character (Hero / NPC)](game-assets/character-hero-npc/plan.md) | `characters` | new |
| Game Assets | [Prop / Environment Asset](game-assets/prop-environment-asset/plan.md) | `props` | new |
| Game Assets | [Skill / Ability](game-assets/skill-ability/plan.md) | `spellbook` | existing |
| Game Assets | [Status Effect / Buff](game-assets/status-effect-buff/plan.md) | `status-effects` | new |
| Systems | [Crafting Recipe](systems/crafting-recipe/plan.md) | `crafting-recipes` | new |
| Systems | [Vendor / Shop](systems/vendor-shop/plan.md) | `vendors` | new |
| Systems | [Progression Curve](systems/progression-curve/plan.md) | `progression-curves` | new |
| Systems | [Achievement / Trophy](systems/achievement-trophy/plan.md) | `achievements` | new |
| Systems | [Save / Checkpoint](systems/save-checkpoint/plan.md) | `save-points` | new |
| Audio & FX | [Music Track / Stinger](audio-fx/music-track-stinger/plan.md) | `music` | new |
| Audio & FX | [Ambient Soundscape](audio-fx/ambient-soundscape/plan.md) | `ambient` | new |
| Audio & FX | [VFX Asset](audio-fx/vfx-asset/plan.md) | `vfx` | new |
| UI | [HUD Element](ui/hud-element/plan.md) | `hud-elements` | new |
| UI | [Icon Set](ui/icon-set/plan.md) | `icon-sets` | new |
| Input & Platform | [Input Scheme](input-platform/input-scheme/plan.md) | `input-schemes` | new |
| Onboarding | [Tutorial Beat](onboarding/tutorial-beat/plan.md) | `tutorial-beats` | new |
| Economy / Meta | [Currency](economy-meta/currency/plan.md) | `currencies` | new |

**Status legend:** `existing` = catalog already registered (deeper pipeline now); `new` = catalog registered in the Catalog Pipeline Expansion (Phase A), seeded with 1–2 starter entities.

## Conventions

- Folder: `docs/catalog/<category-slug>/<entity-slug>/plan.md`. Briefs are regenerable from `_sheet.json` via `_generate.mjs` (regeneration overwrites the pipeline/header, **not** the hand-written `## Session Findings` — copy findings out before regenerating, or regenerate only new rows).
- Branch convention follows the repo (app commits local; UE artifacts to `pof-exp`).

---

## Cross-Catalog Opportunities (living log)

_Each session appends one-liners here when it discovers reuse/synergy between catalogs._

- **[skill-ability/Fireball]** A GAS GameplayEffect and a `status-effects` entry are the **same UE artifact** — Fireball's generated `UGE_Gen_Fireball_Burning` IS the `status-effects` "Burning" starter. One generation run can seed both catalogs.
- **[skill-ability/Fireball]** `vfx` / `icon-sets` / `hud-elements` / `audio` are **shared presentation catalogs** every Game-Asset row consumes — produce them as referenced libraries, not per-asset. The pipeline's VFX/SFX/Icon/UI steps are really "bind to a presentation-catalog entry."
- **[skill-ability/Fireball]** The B3 `generate-gas-effects` dispatch is the reusable engine for the effect-logic/formulas/packaging steps of **every** ability — ability CLIs should call it, not re-implement.
- **[status-effect-buff/Burning]** A status effect's identity IS its granted `State.*` tag — declaring `State.Burning` natively turned the inert Fireball DoT into a real status effect. Any ability that applies a DoT/buff seeds a `status-effects` row from the same GE; the granted tag is the join key to `spellbook`.
- **[status-effect-buff/Burning]** The buff bar (`hud-elements`) is a **generic consumer of every `status-effects` row** — it renders any active GE carrying a `State.*` granted tag + remaining duration. Build it once; declaring real granted tags is the prerequisite that unblocks it for all statuses.
- **[status-effect-buff/Burning]** The `VSGenFireballEffectTest` config-gate pattern (assert a GE CDO's duration/period/modifier/granted-tag, no PIE world) generalizes to **every** GAS-backed catalog row — it's the cheapest real test gate for abilities and statuses alike. Chilled (sibling) is a near-clone of this whole pipeline.
- **[combat-map/Arena Slice]** The catalog had an **identity split** — registered as "tactical arenas" but seeded only with weapon combos. One catalog can hold two `data` shapes via a `kind` discriminator (`arena-slice` vs combo). **Audit other "existing" rows for legacy-seed-vs-intended-meaning drift** — the seed may not be the asset the row name promises.
- **[combat-map/Arena Slice]** An Arena Slice is the **unit a `zone-map` encounter hosts**: `AARPGEncounterVolume` already extends `ASpawnVolume` with `EEncounterPosition`, so a zone's encounter groups *are* arena slices placed at arc positions. The two catalogs should share the wave/position vocabulary — a zone row composes arena-slice rows.
- **[combat-map/Arena Slice]** An `AARPGEnvironmentalHazard` **applies a `UGameplayEffect`** — a fire-floor's GE is the same artifact as a `status-effects`/ability DoT. Extends the Fireball "a GE *is* a status" insight: one GE can seed hazard + status + ability rows. The `Damage.Fire` tag is the join key across all three.
- **[combat-map/Arena Slice]** Waves cross-link to `bestiary` archetypes, which carry **danger ranks** → encounter difficulty **auto-budgeting** (solve wave counts/composition for a target difficulty — the loot Goal-Seek balancer, applied to encounters).
- **[material/Weathered Stone]** Every `materials` row is a **parameter set over the shared master `M_ARPG_Surface_Master`**, not a new material. The new `MaterialSpec` + `MATERIALS_RECIPE` make instance authoring a one-script, self-gating generator — the materials analog of the GAS-codegen engine. Material CLIs author instances, never masters; "Weathered Stone" differs from the arena MIs only by exercising the master's `DetailNormal` + tint paths.
- **[material/Weathered Stone]** A material instance is the **binding surface for `props` / `zone-map` / `combat-map` meshes** — those rows should reference an existing `materials` entity (a `CatalogLink role:'material'`) rather than author one-offs, exactly like the presentation-catalog binding convention. The arena `T_wall_*`/`T_floor_*` textures are a reusable stone PBR library for any masonry entity.
- **[character-hero-npc/Captain Vael]** A named NPC reuses **`AARPGNPCActor` wholesale** — identity (`NPCID`), `NPCRole`, dialogue binding, the floating role indicator, and the `TalkTo` quest event are all already in that one production type. A character row is *configuration + wiring*, not new C++ (the bestiary `BP_<id>`-over-`AARPGEnemyCharacter` pattern). The new `CHARACTERS_RECIPE` makes this the default for all remaining character-like rows.
- **[character-hero-npc/Captain Vael]** `FARPGAttributeInitRow` + `DT_AttributeDefaults` is the **shared stat source for every character AND enemy** — a row's "stats" step = author one named row, not bespoke code. The app-side `CharacterAttributeRow` is the sync source (the `seed_ability_catalog.py` convention); a small `seed_attribute_defaults.py` would close the stat step for **all** stat-bearing rows at once.
- **[character-hero-npc/Captain Vael]** A **quest-giver NPC is the hub where `quests` / `dialog-trees` / `factions` / `cutscenes` meet** — Vael's `NPCID` is the `TalkTo` objective key (quests), the dialogue host (dialog-trees), a likely faction member (factions), and a cinematic actor (cutscenes). Driving one named NPC surfaces the wiring contract for four narrative catalogs at once. Presentation (`icon-sets` portraits, `audio` VO/footsteps) binds as shared libraries, exactly like abilities.
- **[bestiary/Brute]** One creature lives in **three trees** — `ENEMY_ARCHETYPES` (combat-sim numbers), `ArchetypeConfig`+`UI_META` (bestiary UI), and UE `EEnemyArchetype`+`GetArchetypeDefaults()` (runtime). The catalog entity stitches the first two; the UE runtime is the third leg. A shared **"enemy archetype spec"** (the bestiary analog of B1's `EnrichedAbilitySpec`) would drive all three from one source — and a check would flag app↔UE drift. Pairs with Vael's finding that `DT_AttributeDefaults` is the shared stat source for characters AND enemies: one `seed_attribute_defaults.py` + one archetype spec would close the stat step for every stat-bearing row.
- **[bestiary/Brute]** Enemy abilities aren't `spellbook` entities, so `bestiary→spellbook` links resolve only for player-shared ability names (the Brute's Charge Attack / Heavy Swing have no spellbook id). Seeding **enemy abilities into `spellbook`** makes those links real AND lets the B3 `generate-gas-effects` engine generate enemy GEs — one engine spanning the ability + bestiary rows.
- **[bestiary/Brute]** Lifting buried runtime config into a **pure, world-free static table** (`GetArchetypeDefaults()`, folding the old duplicated `ApplyArchetypeDefaults`/`GetBaseXPReward` switches) is the bestiary form of Fireball's GE-CDO gate: the cheapest real config gate for any catalog whose tuning lives inside a method. Same "extract config → assert it" shape as `VSGenFireballEffectTest`, now applied to a non-GAS C++ surface.
- **[zone-map/Ashen Forest]** A zone `.umap` is the **host substrate every other Game-Asset row gets placed into** — `bestiary` enemies, `props`, ability/VFX showcases, and quest triggers all need a level to live in. This confirms the combat-map finding that "an Arena Slice is the unit a zone hosts": a zone composes arena-slice/encounter rows at sector positions, and `ENEMY_DENSITY_CONFIG` + `ZONE_EDGES` are already a **balanced placement contract** a future bestiary→zone resolver can read to auto-spawn.
- **[zone-map/Ashen Forest]** The greybox-level recipe — new-level → MOVABLE lights → PlayerStart → seeded scatter → atmosphere (fog + PP) → **bake a reused compiled `AFunctionalTest` actor** → save → reload-verify (`build_ashen_forest.py`) — is the reusable shape for `combat-map` arenas, boss arenas, and any `props`/`vfx` showcase map. Factor it into a shared `build_zone_base.py`. Atmosphere (fog + post-process + light colour) carries the art read with **zero textures**, letting the Material/VFX steps stay honest gaps while the asset still reads as its concept.
- **[zone-map/Ashen Forest]** **Reusing an already-compiled `AFunctionalTest` subclass as the per-section gate avoids a C++ recompile entirely** — the whole session touched only Python + a new `.umap`, never `Source/`. This is the cheapest "real, runs-headless test gate" pattern for every map-bearing row on the shared UE tree (no rebuild, no collision with sessions editing C++). Generalizes the `VSGenFireballEffectTest` config-gate insight from data-assets to maps.

- **[currency/Gold]** Gold is the economy's **common denominator** — vendors, crafting-recipes, items (`BaseValue`→sell), loot-tables (gold drops) and quests (rewards) all transact in it. `UARPGWalletComponent::AddCurrency` / `SpendCurrency` is the **single faucet/sink seam** every economy-adjacent catalog calls — built once, reuse everywhere.
- **[currency/Gold]** The app **already owns** Gold's full faucet/sink model + inflation sim (`src/lib/economy/definitions.ts` + the Economy Simulator). The pipeline's "Source/Sink Mapping" + "Inflation Sim" steps for *every* currency ARE this engine — reuse it, don't re-derive flows; a bridge from its `EconomyFlow` list -> the wallet's registered call sites would close the design<->runtime loop.
- **[currency/Gold]** Currency belongs on a **component (wallet), not a GAS attribute** — the *inverse* of the Fireball "a GE is a status (same artifact)" insight. Not everything numeric should live on `UARPGAttributeSet`; spendable balances are inventory-adjacent. Recorded so economy rows don't bolt currency onto the attribute set.

## Gaps / Blockers Register (living log)

_Each session appends gaps/blockers it hit so future sessions (and tooling investment) are informed._

- **[skill-ability/Fireball] Generation read a fixture, not the entity.** The B3 dispatch generated the impact GE at −40 (fixture) vs canonical damage 35; aligned by hand to −35 this session. **Fix:** `generate-gas-effects` must pull the entity's persisted spec/scalars. _(High priority — blocks faithful generation for all abilities.)_
- **[skill-ability/Fireball] No ability-animation pipeline** (montage authoring/import for abilities). Timing data exists on the entity; no asset path.
- **[skill-ability/Fireball] No Niagara-VFX, camera-feedback, or localization systems** — gaps for every presentation-bearing catalog. Candidate shared-infra investments.
- **[skill-ability/Fireball] Generated GEs bypass `UARPGDamageExecution`** (flat additive skips crit/armor/resist). Decide policy: simple authored GEs vs route through the execution.
- **[skill-ability/Fireball] No lightweight per-asset runtime test harness.** The config gate works as a pure automation test (no map edit); a reusable "apply GE to a dummy ASC, assert attribute delta" fixture would let every ability/status row gate *runtime* behavior, not just config.
- **[status-effect-buff/Burning] Codegen emits no stacking/dispel/removal config.** `StackingType`/`StackLimitCount`/`StackDurationRefreshPolicy` and `RemovalTagRequirements` are unmodeled in the ability spec and `generate-gas-effects` — Burning fell back to the GAS default (independent instances). Every status needs a stacking + removal model. _(Blocks faithful stacking/dispel for all statuses.)_
- **[status-effect-buff/Burning] No status-interaction system, no dispel/cleanse, no buff-bar widget.** Thermal opposition (Burning↔Chilled), `RemoveActiveEffectsWithGrantedTags` cleanse, and the buff-bar HUD are all buildable now that statuses carry real `State.*` tags — but unbuilt.
- **[status-effect-buff/Burning] No looping-status GameplayCue / Niagara body-VFX.** Statuses want a looping cue (`GameplayCue.Status.Burning`) distinct from the one-shot impact cue; neither the cue nor a Niagara authoring path exists. _(Presentation gap shared with abilities.)_
- **[combat-map/Arena Slice] No spec→placement bridge.** The data-driven slice can't place itself — no `build_arena_slice.py` reads the spec and spawns `AARPGEncounterArena` + cover + `ASpawnVolume`(waves) + hazards into the arena map. **Highest-value next step** — makes the catalog→UE arena loop real; pattern exists (`build_arena.py`/`place_arena_tests.py`).
- **[combat-map/Arena Slice] No win/loss rule evaluator.** `ASpawnVolume` fires `OnAllWavesComplete`/`OnWaveStarted` but nothing evaluates a `WinCondition`/`LossCondition` to end the encounter. The spec encodes the rules; runtime needs a small encounter-state actor/component.
- **[combat-map/Arena Slice] No data-driven encounter-rules test.** The reused arena tests gate geometry/lighting/collision, not *rules* (wave count, archetypes, win-on-clear). A `VSArenaSliceRulesTest` (build an `ASpawnVolume` from the spec, assert wave config + completion) is the encounter analogue of Fireball's missing per-asset runtime harness. Note: several `ASpawnVolume` fields are `protected` — the test needs reflection or a test accessor.
- **[material/Weathered Stone] Config gate ≠ render proof.** Headless SM5 shader compile warns "Default Material will be used" for `M_ARPG_Surface_Master` + all instances (and pre-existing `M_Arena_*`) — NOT introduced by this row. The build-script gate verifies asset/parameter structure + non-sRGB only; a **visual gate (RHI screenshot + Gemini)** is the missing half for every material/visual catalog row. _(High priority — shared infra; same shape as Fireball's missing runtime harness, but for rendering.)_
- **[material/Weathered Stone] No offline catalog-lifecycle write.** The asset + config gate are done, but advancing an entity to `verified` in Live State needs the Next.js server + `/api/catalog` — there's no CLI/offline path, so static seeds stay `planned`. _(Affects every catalog CLI; a small `record-lifecycle` CLI or direct catalog-db write would close it.)_
- **[material/Weathered Stone] Master lacks wetness/weather + Substance/procedural inputs** (pipeline steps 6/10), and there's **no per-material LOD/perf-budget or decal tooling** (steps 7/9). Wetness/weather variants need a master extension; procedural variants need a texture-gen path.
- **[character-hero-npc/Captain Vael] Designed stats aren't written into the real `DT_AttributeDefaults`.** Vael's `CharacterAttributeRow` is persisted app-side and asserted by the test, but no Python seeder authors the `CaptainVael` row into the DataTable (unlike `seed_ability_catalog.py` for abilities). **Fix:** a `seed_attribute_defaults.py` reading the character specs — unblocks the stat step for every character/bestiary row. _(High value, widely reused.)_
- **[character-hero-npc/Captain Vael] No character art/mesh pipeline** — body mesh beyond the shared mannequin, face/blendshapes (MetaHuman), hair/cloth sim, outfit-variant slots, and a captain-specific texture pass are all gaps (steps 3–7). MetaHuman scripting/conform is already on the UE5.x capability backlog.
- **[character-hero-npc/Captain Vael] Step 16 "Performance Test Gate" is honestly only a config/identity gate.** `VSCharacterVaelTest` proves the NPC type carries Vael's config + that role logic behaves, but not that he spawns/talks/gives-a-quest in PIE, and not frame-rate — no perf-profiling harness exists, and the "no lightweight per-asset runtime harness" gap Fireball logged still applies. (UE C++ committed but not run here — shared `main` under concurrent edits; run gated on an editor rebuild, same as Fireball/Burning.)
- **[bestiary/Brute] No live per-archetype behavioral gate.** The config gate (`VSBruteArchetypeTest`) asserts the Brute's *tuning*; the recipe's intended `AVSBestiary_brute` LIVE test (spawn → chases + attacks → drops `lt-Brute` loot on death) needs a placed actor + a `BP_bruteEnemy` Blueprint authored via full editor Python + a shared-`.umap` edit. A reusable **"possess a spawned enemy in a transient world, assert post-possession getters + loot-on-death"** fixture would gate runtime without map edits — the bestiary form of the per-asset runtime-harness gap Fireball/Vael logged.
- **[bestiary/Brute] Cross-tree archetype drift.** App Brute `xpReward 60` / `attackIntervalSec 2.8` vs UE `BaseXPReward 25` / `AttackCooldown 4.0`. The bestiary catalog should pin canonical numbers and flag app↔UE drift (the bestiary analog of "generation read a fixture, not the entity"). The UE config was unified into one queryable table this session; combat balance numbers were **not** changed — drift recorded, not silently resolved.
- **[bestiary/Brute] Enemies model only flat `armor`, no per-damage-type resistances.** Step 3 ("Stat Block & Resistances") can't express fire/phys/etc. resists — schema gap for the whole bestiary. Perception/aggro is likewise outside the canonical archetype table (`aggroRange` lives in combat data + AIController config), so the AI step's data surface is incomplete.
- **[bestiary/Brute] Build not run (small-batch + concurrency).** No `UnrealEditor-PoF.dll` built at this location + an in-flight concurrent session → cold full build (~15–45 min) deferred; the config gate is compile-verified by inspection, run command in the file header (judge by `-abslog`). Same "committed, run gated on editor rebuild" disposition as Fireball/Burning/Vael.
- **[zone-map/Ashen Forest] Gate proves config, not traversal.** The baked `AshenForestSetupTest` (reused `AVSArenaSetupTest`) asserts lighting/PP present, not that the zone is *walkable*. The recipe text's intended `VSZone_<id>Test` (player crosses the clearing, `ProcGenWalkTest`-style) needs a RecastNavMesh bake + a player + a new C++ test class (recompile). Same shape as the per-asset runtime-harness gap Fireball/Vael/Brute logged — a reusable "spawn player in a transient world, assert traversal" fixture would gate every zone's runtime without a recompile or map edit.
- **[zone-map/Ashen Forest] `ZONE_MAP_RECIPE` doesn't sanitize `<id>` → map name.** It interpolates `/Game/Maps/${entity.data.id}.umap`, so `z-ashen` would yield a hyphenated `z-ashen.umap`; hand-mapped to PascalCase `AshenForest` this session. **Fix:** sanitize ids → PascalCase map names so generated build scripts produce clean UE asset names. _(Low effort, affects every zone.)_
- **[zone-map/Ashen Forest] No landscape/heightmap → UE import recipe.** App-side terrain generators exist (`visual-gen/generators/terrain.ts`, Diamond-Square/Perlin) but there's no path to a UE Landscape — zones are flat greybox floors until one exists. Likewise **no Niagara ambient-VFX, no ambient/music audio, no UE minimap pipeline, no World Partition packaging** (single monolithic `.umap`). Shared presentation/streaming gaps across every world-bearing row.
- **[zone-map/Ashen Forest] `ENEMY_DENSITY_CONFIG.cells` uses hand-indexed `row` numbers** while `rows` derives from `ZONES`. New zones MUST be appended to the **end** of `ZONES` (Ashen Forest = row 11) or the hard-coded heatmap rows silently mis-align. A name-keyed cell model would remove the footgun.
- **[zone-map/Ashen Forest] `pof-exp` push 403s for the `kazimi66` account** (same as the app repo — corrects the older "pushes work" belief). The UE commit (`1ec6353`: `build_ashen_forest.py` + `AshenForest.umap`) is **local-only**; the user must push.
- **[currency/Gold] Economy gate authored but not run headless.** `VSCurrencyWalletTest` (pure-logic `IMPLEMENT_SIMPLE_AUTOMATION_TEST` -> `Project.Functional Tests.PoF.Currency.WalletRules`) is convention-correct + arithmetic-traced, but the shared UE tree held another session's uncommitted edits (`ARPGGameplayTags`/`ARPGEnemyCharacter`/Burning test) + an active build, so the run was deferred to avoid a build race. Same "committed, run gated on editor rebuild" disposition as Fireball/Burning/Vael/Brute.
- **[currency/Gold] No loot->wallet wiring.** `UARPGLootDropComponent` drops a gold *pickup* but no player wallet receives it (none exists). The first real faucet wire-up = a `UARPGWalletComponent` on the player + a pickup->`AddCurrency` hook. Pairs with the "no offline catalog-lifecycle write" gap — the entity stays `planned` until the server records the verify.
- **[currency/Gold] Same presentation/localization gaps as Fireball.** No localization (`DisplayName`/`Plural` resolve nowhere), no Niagara gain-VFX, no SFX authoring, no icon-gen run, no HUD currency widget — currency consumes the same shared presentation catalogs; all are shared-infra investments, not per-row work.
- **[currency/Gold] Only Gold is seeded -> `Convert()` is mechanism-only** (proven with a synthetic Shard). A real 2nd currency (premium/shard) would give conversion real content plus a cross-currency balance concern for the simulator.
