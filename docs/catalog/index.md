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
