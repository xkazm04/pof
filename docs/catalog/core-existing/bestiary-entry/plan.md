# Bestiary Entry — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `bestiary` (existing) · **Description:** A creature/NPC archetype with stats, AI, and presentation.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Brute** — the real archetype `EEnemyArchetype::Brute` / app `ENEMY_ARCHETYPES['brute']` "Stone Brute" (HP 150, armor 10, AP 18; Charge Attack base 30 + Heavy Swing base 15; AttackRange 250, AttackCooldown 4.0s, charge speed x3 / vulnerability 2.0s; loot LT_Brute, base XP 25).

**Status (small-batch reflection session, mirroring skill-ability/Fireball):** ~8/16 steps covered by current PoF tooling (reuse or produced), 3 partial, 5 gaps. Honest dispositions below; findings at the bottom.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief & Role  
  _agent: Designer · **reuse/produced**: Stone Brute = elite Humanoid **tank/bruiser**. Fantasy = "the wall that punishes greed" — telegraphs a charge from range, ground-slams on arrival, then is vulnerable 2s. Counterplay: bait the charge, punish the recovery window._
- [ ] 2. Lore & Codex Text  
  _agent: Writer · ⚠️ **GAP** + 🔗 `codex`: no codex / string-table system (same localization gap Fireball hit); lore is writable but has no asset path._
- [x] 3. Stat Block & Resistances  
  _agent: Designer/Balancer · **reuse** `ENEMY_ARCHETYPES['brute']` (HP 150, armor 10, AP 18, STR 14, DEX 2, INT 1, crit 1%/x1.2; levelScaling +25 HP / +3 armor / +4 AP / +2 STR per level). ⚠️ enemies model only flat `armor` — **no per-damage-type resistances** (schema gap)._
- [x] 4. Ability Set Definition  
  _agent: Designer · **reuse**: Charge Attack (base 30, AP×1.3, cd 6s, cast 1.0s, range 500, aoe 200) + Heavy Swing (base 15, AP×0.9, cast 0.7s, range 250). UE `PrimaryAbilityTag = Ability.Melee.HeavyAttack`; charge = `BTTask_ChargeToTarget`. ⚠️ these enemy abilities are **not** seeded `spellbook` entities (unlike Fireball) → cross-catalog seam (findings)._
- [x] 5. AI Behavior Tree  
  _agent: Designer · **reuse (rich, existing)**: `BTTask_ChargeToTarget`, `BTDecorator_CheckArchetype`/`HealthBelow`/`IsInAttackRange`, `BTTask_ExecuteAttackAbility`, `AARPGAIController` blackboard keys. Brute branch: charge from range (x3 speed) → slam → 2s vulnerability → heavy-swing loop. **Config gated** (defaults written to blackboard at possession)._
- [~] 6. Aggro / Perception Rules  
  _agent: Designer · **partial**: `AARPGAIController` drives perception/aggro; app `aggroRange` 500. ⚠️ `aggroRange` (detection) is distinct from UE `AttackRange` (reach, 250) and is **not** in the canonical archetype-defaults table — perception lives in AIController config, not the archetype data surface._
- [x] 7. Encounter Difficulty Balancing  
  _agent: Balancer · **reuse** `DIFFICULTY_BRUTE` curve + level scaling (+25 HP/lvl); reads as the elite anchor (danger rank 1 / 67 player-kills in `KILL_DEATH_STATS`). Balanced._
- [x] 8. Loot Table Binding  
  _agent: Designer · **reuse + config-gated**: `DEFAULT_ENEMY_LOOT_BINDINGS` `'Brute' → LT_Brute` (dropChance 0.50, bonusGold 40) + UE `LootDropComponent` `NumRolls=2`, `RarityBonusMultiplier=2.0` applied at possession (the gate asserts both). 🔗 `loot-tables` `lt-Brute`._
- [ ] 9. Concept Art 2D  
  _agent: Concept2D · ⚠️ **GAP this session** + 🔗 `icon-sets`: producible via the Leonardo 2D dispatch (not run — small-batch); no Brute concept run. Same disposition as Fireball's icon step._
- [ ] 10. 3D Model & Rig  
  _agent: 3DGen/Rigger · ⚠️ **GAP** + 🔗 Blender MCP: pipeline exists (`project_blender_mcp`) but no Brute mesh/rig authored; runtime relies on the shared `BP_VSEnemy` skeletal-mesh placeholder._
- [~] 11. Material & Texture Pass  
  _agent: 3DGen · **partial/reuse**: recipe best-practice uses the `M_EnemyRed` variant for player-vs-enemy contrast; no Brute-specific texture set._
- [ ] 12. Animation Set (idle/move/attack/hit/death)  
  _agent: Animator · ⚠️ **GAP** (same as Fireball): no per-asset animation authoring pipeline. Timing exists (charge cast 1.0s, swing 0.7s) → future montages (charge, ground-slam, hit-react, death)._
- [ ] 13. VFX Set (abilities, status)  
  _agent: VFX · ⚠️ **GAP** + 🔗 `vfx`: ground-slam impact + charge dust trail; no Niagara authoring pipeline._
- [ ] 14. SFX Set (voice, foley, ability)  
  _agent: Audio · ⚠️ **GAP** + 🔗 `audio` + `import_audio_set` dispatch: stomp/roar/impact set importable but none authored._
- [x] 15. Combat Test Gate  
  _agent: QA · **produced**: `Source/PoF/Test/Combat/VSBruteArchetypeTest.cpp` (`IMPLEMENT_SIMPLE_AUTOMATION_TEST`) asserts the canonical Brute config via the new world-free `AARPGEnemyCharacter::GetArchetypeDefaults(Brute)` surface (AttackRange 250, cooldown 4.0, charge 2.0s/x3, HeavyAttack tag, 2 rolls/x2 rarity, XP 25, no kite/retreat). ⚠️ build+run blocker documented (findings); the recipe's intended LIVE `AVSBestiary_brute` (spawn→chase→attack→loot-on-death) remains the next step._
- [~] 16. UE Asset Packaging  
  _agent: Packager · **produced (config + test layer)**: refactored `ARPGEnemyCharacter` archetype config into a single-source-of-truth `FEnemyArchetypeDefaults` / `GetArchetypeDefaults()` table (folds the old duplicated `ApplyArchetypeDefaults` + `GetBaseXPReward` switches) + the config gate, committed to `pof-exp`. Full packaging (author `BP_bruteEnemy` via full editor Python, `M_EnemyRed`, place under `/Game/Enemies/`) is the recipe's `author-python`/`wire` steps — deferred (needs full editor; avoids shared-`.umap` edit this session)._

## PoF integration
- **Catalog:** `bestiary` (registered); entity `bestiary-brute` (seeded from `ARCHETYPES`; `data` = `ArchetypeConfig 'brute'`, derived from `ENEMY_ARCHETYPES['brute']`). Recipe: `BESTIARY_RECIPE` (`author-python → wire → verify`).
- **Reuse:** `ENEMY_ARCHETYPES['brute']` · `ArchetypeConfig`/`UI_META` · `DIFFICULTY_BRUTE` · `DEFAULT_ENEMY_LOOT_BINDINGS` · UE `AARPGEnemyCharacter`/`EEnemyArchetype` + BT tasks/decorators + `AARPGAIController` · `BESTIARY_RECIPE`.
- **Produced:** `FEnemyArchetypeDefaults` + `AARPGEnemyCharacter::GetArchetypeDefaults()` (single-source archetype table, folds the duplicated `ApplyArchetypeDefaults`/`GetBaseXPReward` switches) + `VSBruteArchetypeTest` config gate (`pof-exp`).
- **Gaps:** codex/localization, concept-2D run, 3D mesh/rig, animation montages, Niagara VFX, SFX, per-type resistances, perception-in-canonical-data, enemy-abilities-not-in-`spellbook` seam, live behavioral gate, `BP_bruteEnemy` authoring/packaging.

## Cross-catalog dependencies
- **`loot-tables` → `lt-Brute` / `LT_Brute`** — drops on death (2 rolls @ x2 rarity bonus).
- **`spellbook`** — enemy abilities (Charge Attack / Heavy Swing) are **not** yet spellbook entities → `bestiary→spellbook` links don't resolve for enemy-only abilities (seam).
- **`vfx`** (ground-slam impact / charge dust), **`audio`** (Brute SFX set), **`icon-sets`** (bestiary portrait/icon), **`codex`** (lore entry) — presentation/narrative consumers, produced once and bound.

## Session Findings
### Cross-catalog opportunities
- **One creature lives in THREE trees** — `ENEMY_ARCHETYPES['brute']` (combat-sim numbers), `ArchetypeConfig 'brute'`+`UI_META` (bestiary UI/derived), and UE `EEnemyArchetype::Brute`+`GetArchetypeDefaults()` (runtime). The catalog entity `bestiary-brute` already stitches sim+UI; the UE runtime is the third leg. A shared **"enemy archetype spec"** (the bestiary analog of B1's `EnrichedAbilitySpec` for abilities) would drive all three from one source.
- **Enemy abilities want a `spellbook` home** — Fireball is a real spellbook entity, but the Brute's Charge Attack / Heavy Swing live only in combat data with no spellbook id, so `bestiary→spellbook` links resolve only for player-shared ability names. Seeding enemy abilities into `spellbook` would (a) make bestiary ability-links real and (b) let the B3 `generate-gas-effects` engine generate **enemy** GEs too — reuse spanning the ability AND bestiary rows.
- **`GetArchetypeDefaults()` is the bestiary analog of Fireball's GE-CDO gate** — extracting runtime config into a pure, world-free static table lets EVERY archetype (and future ones) be gated without a PIE world. The pattern "lift config out of a method into a pure table, then assert it" is the cheap config gate for any catalog whose runtime config is buried in a function.
- **Presentation steps mirror Fireball exactly** — Brute's 2D/3D/VFX/SFX/icon steps are "bind to a presentation catalog" (`vfx`/`audio`/`icon-sets`), confirming the index's shared-presentation-library finding generalizes from abilities to bestiary.

### Gaps / blockers for future sessions
- **No live per-archetype behavioral gate.** The config gate asserts the Brute's *tuning*; the recipe's intended `AVSBestiary_brute` LIVE test (spawn → chases + attacks → drops `lt-Brute` loot on death) needs a placed actor + a `BP_bruteEnemy` Blueprint authored via full editor Python + a shared-`.umap` edit. This is the bestiary analog of Fireball's "no lightweight per-asset runtime test harness" — a reusable **"possess a spawned enemy in a transient world, assert post-possession getters + loot-on-death"** fixture would gate runtime behavior without map edits.
- **Test-gate build not run (blocker).** No `UnrealEditor-PoF.dll` is built at this location and the tree showed an in-flight concurrent session; a cold full build (~15–45 min) wasn't triggered in this small-batch session. Artifact is compile-verified by inspection. Run command is in the test file header; judge by `-abslog`.
- **Cross-tree archetype drift (Brute).** App `xpReward: 60` vs UE `BaseXPReward: 25`; app `attackIntervalSec: 2.8` vs UE `AttackCooldown: 4.0`. The bestiary catalog should pin canonical numbers and a check should flag app↔UE drift (the bestiary analog of "generation read a fixture, not the entity"). I unified the UE config into one queryable table this session but did **not** change combat balance — drift is recorded, not silently resolved.
- **Enemies model only flat `armor`, no per-damage-type resistances.** Step 3 ("Stat Block & Resistances") can't express fire/phys/etc. resists — schema gap for the whole bestiary.
- **Perception/aggro not in canonical archetype data.** `aggroRange` lives in combat data + AIController config, separate from `GetArchetypeDefaults()`; the table covers attack reach/cooldown/charge/loot/XP but not detection. Folding perception into the archetype schema would complete the AI step's data surface.
