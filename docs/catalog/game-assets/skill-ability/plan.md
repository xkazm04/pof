# Skill / Ability — Catalog Pipeline Brief

**Category:** Game Assets · **Catalog:** `spellbook` (existing) · **Owning module:** `arpg-gas`
**Description:** Active or passive ability used by characters/enemies.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Fireball** — the real seeded spellbook entity `id: 'fireball'` (damage 35, manaCost 20, cooldown 3.0s, tag `Ability.Fireball`, damageType Fire, animDuration 0.8, damageWindow [0.3,0.5], recovery 0.3, comboMultiplier 1.1).

**Status (this session = the first complete item / reflection vehicle):** 9/16 steps covered by current PoF tooling (reuse or produced), 2 partial, 5 are gaps. Honest dispositions below; findings at the bottom.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief & Fantasy  
  _agent: Designer · **produced**: a hurled fire projectile (advanced-tier offensive). Hits one target for fire impact damage, then ignites them (Burning DoT). Fantasy = "the mage's bread-and-butter nuke."_
- [x] 2. Mechanical Effect Logic  
  _agent: Designer · **reuse B1/B2** (`EnrichedAbilitySpec` — `src/lib/ability/spec.ts`, effect-timeline + tag-rule editors): effects = FireImpact (instant, Health −35) + Burning (HasDuration 3s, period 1s, Health −5/tick, grants State.Burning); tag rules block activation while State.Dead/State.Stunned._
- [x] 3. Cost & Cooldown Rules  
  _agent: Designer · **reuse** entity data (manaCost 20, cooldown 3.0s). ⚠️ the generated ability leaves cooldown as a TODO (B3b); the hand-written `GE_Cooldown_Fireball` already exists in UE → wiring opportunity._
- [ ] 4. Targeting Rules (range, shape, LoS)  
  _agent: Designer · ⚠️ **GAP**: no targeting data model in the spec; the generated `UGA_Gen_Fireball` applies to a placeholder ASC (B3b "target acquisition is bespoke"). Intended: single-target projectile on hit. Needs a targeting schema + projectile wiring._
- [x] 5. Damage / Healing / Status Formulas  
  _agent: Balancer · **reuse** `src/lib/ability/damage-formula.ts` (`calculateDamage`) + the GE modifier. ⚠️ finding: the generated GE uses a flat additive modifier, bypassing the project's `UARPGDamageExecution` (crit/armor/fire-resist). For parity the generated GE should route through SetByCaller + the damage execution._
- [x] 6. Combo & Interaction Rules  
  _agent: Designer · **reuse** `src/lib/ability/combo-analysis.ts` + entity `comboMultiplier` 1.1 + the tag rules (block while incapacitated)._
- [x] 7. Balancing & Tuning Pass  
  _agent: Balancer · **reuse** the damage/combo tuners. 35 dmg / 20 mana / 3s cd reads as a balanced advanced-tier nuke; `formulaPreview` shows ≈ the expected post-mitigation value._
- [ ] 8. Animation Set (windup, cast, recover)  
  _agent: Animator · ⚠️ **partial/GAP**: timing data exists (animDuration 0.8 / damageWindow [0.3,0.5] / recovery 0.3) but there is NO ability-animation pipeline (no montage asset, no Mixamo/Blender path wired for abilities). Timing → a future AnimMontage._
- [ ] 9. VFX (cast, projectile, impact)  
  _agent: VFX · ⚠️ **GAP** + 🔗 cross-catalog: the new `vfx` catalog's "Fire Impact Burst" starter pairs with this. No Niagara authoring pipeline yet._
- [ ] 10. SFX (cast, impact, voice)  
  _agent: Audio · ⚠️ **GAP** + 🔗: the `import_audio_set` dispatch + `audio` catalog can import a Fireball SFX set, but none authored. Opportunity, not done._
- [ ] 11. UI (icon, tooltip, cooldown ring)  
  _agent: Concept2D/UI · ⚠️ **partial**: tooltip data exists (dmg/mana/cd); icon is producible via the Leonardo 2D dispatch (not run this session) and 🔗 the `icon-sets` "Ability Icons" row; cooldown ring 🔗 the `hud-elements` catalog._
- [ ] 12. Camera Shake / Feedback  
  _agent: VFX · ⚠️ **GAP**: no camera-feedback/shake system in PoF._
- [ ] 13. Localization  
  _agent: Writer · ⚠️ **GAP**: no localization/string-table system. Keys would be `Ability_Fireball_Name` / `_Desc`._
- [x] 14. AI Usage Hints (for enemy use)  
  _agent: Designer · **reuse** bestiary AI conventions (🔗 `bestiary`): enemy casters cast at range when mana ≥ 20 and LoS, hold during cooldown — feeds the behavior-tree decision._
- [x] 15. Combat Test Gate  
  _agent: QA · **produced**: `Source/PoF/Test/Combat/VSGenFireballEffectTest.cpp` (`IMPLEMENT_SIMPLE_AUTOMATION_TEST`) asserts the generated `UGE_Gen_Fireball_FireImpact` is Instant + one Additive Health modifier of −35 (canonical). Runs headless via `Automation RunTests Project.Functional Tests.PoF.GenFireball`._
- [x] 16. UE Ability Asset Packaging  
  _agent: Packager · **reuse B3a/b/c**: `UGE_Gen_Fireball_*` (Effects/Generated/), `UGA_Gen_Fireball` (Abilities/Generated/), and the `DT_GeneratedAbilities` registry row — committed to `pof-exp`. Impact GE aligned to canonical damage (−35) this session._

## PoF integration
- **Catalog:** `spellbook` (already registered); entity `id: 'fireball'`.
- **Reuse:** B1 spec (`spec.ts`) · B2 editors · B3 codegen (`generate-gas-effects`) · `damage-formula.ts` · `combo-analysis.ts` · `logic-prompts.ts`.
- **Gaps:** targeting model, ability animation pipeline, Niagara VFX authoring, SFX authoring, camera-feedback system, localization system, cooldown-GE wiring, damage-execution routing.

## Cross-catalog dependencies
- **`status-effects` → Burning** (the DoT this ability grants; State.Burning).
- **`vfx` → Fire Impact Burst** (impact effect).
- **`icon-sets` → Ability Icons** (the tooltip/hotbar icon).
- **`hud-elements`** (cooldown ring), **`bestiary`** (AI usage), **`audio`** (SFX set).

## Session Findings
### Cross-catalog opportunities
- The `status-effects` "Burning" starter IS the `UGE_Gen_Fireball_Burning` DoT this ability already generates — **one generation run can seed both catalogs**. A GAS effect and a "status effect" are the same UE artifact viewed from two catalogs.
- `vfx` / `icon-sets` / `hud-elements` / `audio` are all *presentation* catalogs that every Game-Asset row (abilities, characters, props) consumes — they should be produced as shared libraries, not per-ability, and referenced. The pipeline's "VFX/SFX/Icon/UI" steps are really "bind to a presentation-catalog entry."
- The `spellbook` Effect Mapping "Generate C++" dispatch (B3) is the reusable engine for steps 2/5/16 of EVERY ability — the per-CLI ability sessions should call it rather than re-implement.

### Gaps / blockers for future sessions
- **Generation consumed a test fixture, not the seeded entity.** The B3 dispatch generated the impact GE at −40 (fixture) vs the canonical Fireball damage 35; aligned to −35 by hand this session. **Fix:** the `generate-gas-effects` dispatch must read the entity's persisted spec/scalars, not a fixture. (High-value, blocks faithful generation for all abilities.)
- **No ability-animation pipeline.** Timing data exists but there's no montage authoring/import path for abilities. (Blocks step 8 for every ability.)
- **No Niagara VFX, no camera-feedback, no localization systems.** Steps 9/12/13 are gaps for every catalog with presentation. Candidate shared-infra investments.
- **Generated GEs bypass `UARPGDamageExecution`.** Flat additive modifiers skip crit/armor/resist. Decide: keep simple GEs for authored effects vs route damage through the execution. (Affects balancing fidelity.)
- **No lightweight per-asset test harness.** The combat test gate works as a pure automation test (no map edit), but applying a GE to a live ASC needs PIE/world setup; a reusable "apply GE to a dummy ASC, assert attribute delta" test fixture would let every ability/status row gate its runtime behavior, not just its config.
