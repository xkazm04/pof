# Character (Hero / NPC) — Catalog Pipeline Brief

**Category:** Game Assets · **Catalog:** `characters` (new) · **Owning module:** `arpg-character`
**Description:** Playable or named NPC with full presentation and behavior.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Captain Vael** — the seeded `characters` entity `id: 'char-captain-vael'` (a named, plate-armored human-officer **quest-giver** NPC; `NPCID=CaptainVael`, `NPCRole=QuestGiver`, level-5 stats, grants Melee + Heavy Attack).

**Status (Phase C delegated row, mirrors the Fireball exemplar):** the design is persisted end-to-end and the NPC maps onto the **existing `AARPGNPCActor`** production type (no new C++ class). 7/17 steps reuse-or-produced, 4 partial, 6 are art/audio-pipeline gaps. Honest dispositions below; findings at the bottom.

## Pipeline (from game_catalog_pipelines.xlsx)
- [x] 1. Concept Brief & Archetype
  _agent: Designer · **produced**: veteran human officer who anchors the early-game hub — plate-armored and martially capable, but a talker first. Persisted in `seed-characters.ts` `data` (archetype `human-officer`, tags `named`/`quest-giver`)._
- [ ] 2. Visual Concept Art
  _agent: Concept2D · ⚠️ **gap/partial**: producible via the Leonardo-2D dispatch (not run this session). 🔗 needs an `icon-sets` "NPC Portraits" entry — no portrait family exists yet._
- [x] 3. Body Mesh & Rig
  _agent: 3DGen/Rigger · **reuse (partial)**: the proven `setup_characters_ue.py` mannequin path (SKM_Manny + ABP_Manny) — recorded in `data.bodyMesh`. ⚠️ no bespoke captain mesh (no MetaHuman/Blender character pipeline)._
- [ ] 4. Face Mesh & Blendshapes
  _agent: 3DGen · ⚠️ **gap**: no MetaHuman / face-rig pipeline (a UE5.x capability candidate)._
- [ ] 5. Hair / Cloth Sim Setup
  _agent: Rigger · ⚠️ **gap**: no groom / cloth-sim pipeline._
- [x] 6. Material & Texture Pass (skin, gear, hair)
  _agent: Material · **reuse (partial)**: mannequin default materials; `M_ARPG_Surface_Master` + the `materials` recipe cover gear surfaces. ⚠️ no captain-specific skin/gear texture pass._
- [ ] 7. Outfit / Variant Slots
  _agent: Designer · ⚠️ **gap**: no outfit / variant-slot system for NPCs._
- [x] 8. Locomotion Animation Set
  _agent: Animator · **reuse**: ABP_Manny locomotion via the mannequin path; the `state-graph` Mixamo recipe is the authoring path. AnimBP graph stays a manual step (state-graph finding)._
- [ ] 9. Combat Animation Set
  _agent: Animator · ⚠️ **partial**: Vael grants Melee Attack (`off-phy-01`) + Heavy Attack (`off-phy-02`) via spellbook links, which carry montage timing; no captain-specific combat montages. 🔗 `spellbook` + `state-graph`._
- [ ] 10. Emote & Interaction Animation Set
  _agent: Animator · ⚠️ **partial**: the dialogue "face player" interaction is real (`AARPGNPCActor.bFacePlayerInDialogue` → faces player on dialogue start); no emote montages._
- [ ] 11. VO Identity & Sample Lines
  _agent: Writer/Audio · ⚠️ **gap**: no VO / localization system. 🔗 `audio` + `dialog-trees`._
- [ ] 12. SFX (footsteps, foley, voice grunts)
  _agent: Audio · ⚠️ **partial**: the `import_audio_set` dispatch + `audio` catalog can import a footstep/foley set; none authored for Vael. 🔗 `audio`._
- [ ] 13. VFX (signature abilities, status)
  _agent: VFX · ⚠️ **gap**: no Niagara authoring pipeline (a quest-giver has no signature VFX regardless). 🔗 `vfx`._
- [x] 14. Behavior / Personality Logic (for NPC)
  _agent: Designer · **reuse/produced**: the **real** behavior is `AARPGNPCActor`'s role + indicator logic (QuestGiver → "!" gold indicator, `GetRoleDisplayText`/`GetRoleColor`) + the `UARPGDialogueComponent` + the quest-subsystem `TalkTo` event on `NPCID`. The combat `AARPGAIController`/Behavior-Tree exists for guard variants (reuse). The test gate exercises this logic._
- [ ] 15. Cinematic Pose Library
  _agent: Animator · ⚠️ **gap**: no cinematic / pose-library system. 🔗 `cutscenes`._
- [x] 16. Performance Test Gate
  _agent: QA · **produced**: `Source/PoF/Test/Character/VSCharacterVaelTest.cpp` (`IMPLEMENT_SIMPLE_AUTOMATION_TEST`, the Fireball-style pure config gate) asserts the NPC identity/role/indicator logic for a QuestGiver **and** the canonical `FARPGAttributeInitRow` design contract. Runs headless: `Automation RunTests Project.Functional Tests.PoF.CharacterVael`. ⚠️ honest naming: it's an **identity/config** gate, not a frame-rate perf gate (no perf-profiling harness exists)._
- [x] 17. UE Asset Packaging
  _agent: Packager · **produced (recipe) / reuse**: registered `CHARACTERS_RECIPE` (`author-python → wire → verify`) in `recipe.ts` — packages `BP_<id>` over `AARPGNPCActor` + a `DT_AttributeDefaults` row + cross-catalog wiring, gated by the test above. ⚠️ the actual BP authoring needs an editor session (documented in the recipe prompt)._

## PoF integration
- **Catalog:** `characters` (registered in Phase A); entity `id: 'char-captain-vael'`, now seeded with full design `data` via the dedicated `seed-characters.ts` (swapped in `sections.ts` for the generic starter).
- **Schema (produced this session):** `CharacterEntry` / `CharacterData` / `CharacterAttributeRow` / `CharacterNPCRole` in `catalog/types.ts` — mirrors UE `AARPGNPCActor` (NPCID/role/facePlayer) + `FARPGAttributeInitRow` (the `DT_AttributeDefaults` row struct).
- **Recipe (produced this session):** `CHARACTERS_RECIPE` in `recipe.ts` (closes the "no characters recipe" gap for **all** character rows). `testPath = Project.Functional Tests.PoF.CharacterVael.NPCConfig`.
- **Reuse:** `AARPGNPCActor` + `UARPGDialogueComponent` + `AARPGQuestSubsystem` (behavior) · `setup_characters_ue.py` (mannequin wiring) · `FARPGAttributeInitRow`/`DT_AttributeDefaults` (stats) · `spellbook` links (abilities) · `IMPLEMENT_SIMPLE_AUTOMATION_TEST` (gate).
- **Gaps:** MetaHuman/face + body-mesh authoring, hair/cloth sim, outfit-variant slots, VO/localization, Niagara VFX, cinematic-pose library, a perf-profiling harness, and a `DT_AttributeDefaults` Python seeder (stats are designed but not yet written into the real DataTable).

## Cross-catalog dependencies
- **`spellbook` → Melee Attack (`off-phy-01`) + Heavy Attack (`off-phy-02`)** (abilities granted; resolved to real links at seed time).
- **`dialog-trees` → (planned) `dialog-captain-vael`** (the quest-giver conversation; owned by that row — Vael's `NPCID` is the `TalkTo` key).
- **`icon-sets` → (planned) NPC Portraits**, **`audio` → footstep/VO set**, **`quests` → the quest Vael gives**, **`cutscenes` → cinematic poses** (all consumer/producer relationships).

## Session Findings
### Cross-catalog opportunities
- **Named NPCs reuse `AARPGNPCActor` wholesale — no per-character C++.** Identity (`NPCID`), `NPCRole`, dialogue binding, the floating role indicator, and the `TalkTo` quest event are all already in this one production type. A character row is *configuration + wiring*, not new code — exactly the bestiary pattern (`BP_<id>` over `AARPGEnemyCharacter`). The `CHARACTERS_RECIPE` makes this the default for all 29 remaining character-like rows.
- **`FARPGAttributeInitRow` + `DT_AttributeDefaults` is the shared stat source for every character AND enemy.** A character/bestiary row's "stats" step = author one named row, not bespoke code. The app-side `CharacterAttributeRow` is the sync source (the `seed_ability_catalog.py` convention); a tiny `seed_attribute_defaults.py` would close the loop for every stat-bearing row at once.
- **A quest-giver row is the hub where `quests` / `dialog-trees` / `factions` / `cutscenes` meet.** Vael's `NPCID` is the `TalkTo` objective key (quests), the dialogue host (dialog-trees), a likely faction member (factions), and a cinematic actor (cutscenes). Driving one named NPC surfaces the wiring contract for four narrative catalogs at once.
- **`setup_characters_ue.py`'s mannequin-wiring pattern is reusable for any humanoid character** (swap the `AARPGNPCActor` StaticMeshComponent for a SkeletalMesh + ABP_Manny). Presentation catalogs (`icon-sets` portraits, `audio` VO/footsteps, `vfx`) are shared libraries every character binds to, not per-character work (the Fireball presentation finding generalizes from abilities to characters).

### Gaps / blockers for future sessions
- **Designed stats aren't written into the real `DT_AttributeDefaults`.** Vael's `CharacterAttributeRow` is persisted app-side and asserted by the test, but there is no Python seeder that authors the `CaptainVael` row into the DataTable (unlike `seed_ability_catalog.py` for abilities). **Fix:** a `seed_attribute_defaults.py` that reads the character specs — unblocks the stat step for every character/bestiary row. _(High value, reused widely.)_
- **No character art/mesh pipeline.** Body mesh beyond the shared mannequin, face/blendshapes (MetaHuman), hair/cloth sim, outfit-variant slots, and a captain-specific texture pass are all gaps (steps 3–7). MetaHuman scripting/conform is already on the UE5.x capability backlog.
- **No VO/localization, no Niagara VFX, no cinematic-pose systems** (steps 11/13/15) — the same shared-infra gaps Fireball hit for presentation, now confirmed for characters too.
- **The gate is config/identity-level, not runtime or perf.** It proves the NPC type carries Vael's config and that role logic behaves, but not that he spawns, talks, and gives a quest in PIE, and not frame-rate. The same "no lightweight per-asset runtime harness" gap Fireball logged applies; a perf-profiling gate doesn't exist at all (step 16 is honestly a config gate).
- **The UE test is authored + committed but not run here.** The UE tree is a shared `main` under concurrent edits; a headless editor rebuild is slow, clobbers other sessions, and exits non-zero on the benign shutdown crash. Run command is in the test file; judge by the `-abslog`. (Same disposition as the Fireball/Burning rows — UE C++ committed, run gated on an editor rebuild.)
