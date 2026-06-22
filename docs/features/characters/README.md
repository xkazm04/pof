# Characters Pipeline

> Catalog ID `characters` · Category Game Assets · `arpg-character` module · 12 steps · Tracks: logic, art-3d, animation, audio, vfx, test

**Purpose.** Authors a named NPC / hero character — config-driven over the shared `AARPGNPCActor` production type, with no per-character C++ (canon `char-config-not-cpp`). Per ARPG-LAWS §9 (classes + attributes) and §8 (defenses/EHP). Wiring: a BP child of `AARPGNPCActor`; stats in `DT_AttributeDefaults` (`FARPGAttributeInitRow`); abilities granted via `UARPGAbilitySystemComponent` at BeginPlay; dialogue bound via `UARPGDialogueComponent` + NPCID; the quest-giver role activates the `AARPGQuestSubsystem` TalkTo event.

## Target / starter entity
- **Captain Vael** (`char-captain-vael`) — A named quest-giver NPC: a plate-armored, level-5 human officer who anchors the early-game hub. Designed end-to-end in the dedicated seed (`seed-characters.ts`), where the design `data` is the single source the UE artifacts mirror.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept & Role | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | Concept 2D Art | gallery | `T_<name>_Concept` | L1 · `selected` |
| 3 | Stat Block | schema | `DT_AttributeDefaults_<name>` | L0 · `fieldsPopulated(stats: health/damage/armor/moveSpeed)` + L2 statics |
| 4 | 3D & Rig | gallery | `SK_<name>` | L1 · `selected(mesh)` |
| 5 | Material / Outfit | gallery | `MI_<name>_Outfit` | L1 · `selected(material)` |
| 6 | Locomotion Anim | checklist | — | L0 · `minCount(clips, ≥3)` |
| 7 | Combat Anim | checklist | — | L0 · `minCount(clips, ≥2)` |
| 8 | VO | checklist | — | L0 · `minCount(lines, ≥1)` |
| 9 | Behavior (NPC) | rules | — | L0 · `fieldsPopulated(behavior: role/npcId/dialogueBinding)` |
| 10 | Icon 2D Art (portrait) | gallery | `T_<name>_Portrait` | L1 · `selected(portrait)` |
| 11 | Test Gate | checklist | — | L3 · `runtimeDeferred(VSCharacterVaelTest)` |
| 12 | UE Packaging | manifest | `BP_<name>`, `SK_<name>`, `DT_AttributeDefaults`, `DT_Characters` | L0 · `minCount(assets, ≥4)` + L2 statics |

## UE wiring
- **C++ symbols** (`cppSymbolExists`): `FARPGAttributeInitRow` (step 3), `AARPGNPCActor` (step 12). Runtime grant path: `UARPGAbilitySystemComponent::InitAbilityActorInfo` at BeginPlay; dialogue via `UARPGDialogueComponent`; quest via `AARPGQuestSubsystem` TalkTo.
- **DataTables**: `DT_AttributeDefaults` (one `FARPGAttributeInitRow` row keyed by NPCID=CaptainVael, canon `char-stat-source`), `DT_Characters` (catalog row).
- **Seeds** (`seedRowPresent`): `seed_attribute_defaults.py` (stat row, step 3), `seed_characters.ts` (character catalog row, step 12).
- **Runtime test** (`runtimeDeferred`): `VSCharacterVaelTest` — NPC spawns + talks + gives quest in PIE.
- **Cross-catalog `links`** (step 9): `dialog-trees::dialog-gatekeeper` (host, resolvable seed), `quests::quest-ember-pact` (giver, resolvable seed), `spellbook::off-phy-01` + `spellbook::off-phy-02` (granted Melee/Heavy Attack abilities). Pending rows noted in comments: `dialog-captain-vael` and `quest-vael-intro`.

## Acceptance profile
Uses L0 (data: brief/stats/clips/lines/behavior/assets), L1 (gallery selections: concept, mesh, material, portrait), L2 (static UE source: `FARPGAttributeInitRow`, `AARPGNPCActor`, seeded rows), and one L3 deferred gate (`VSCharacterVaelTest`). The L4 visual tier is not used. "Config-complete" means every step has reached `pass` (L0/L1/L2) except the Test Gate, which terminates `deferred` with a reason — the runtime PIE behavior (spawn → role indicator → dialogue → quest grant → ability grant) is verified later by the named test.

## Status & notes
12-step pipeline, the most graph-heavy of this batch. Obeys ARPG-LAWS §9c (Str-primary attribute spread: every 10 Str → +5 life; canonical Str 16 / Dex 12 / Int 11 → 220 life), §8 (defenses/EHP) and §3 (Physical damage routing through `ARPGDamageExecution`). NPC resistances are uncapped (§4c, no 75% cap). **Has a dedicated designed seed**: `char-captain-vael` is the explicit Catalog Pipeline *target asset* — `seed-characters.ts` authors Captain Vael end-to-end (stats kept identical to `VSCharacterVaelTest`'s asserted values), making the design `data` the single source the UE artifacts mirror. Known gap: visual presentation reuses the `SKM_Manny` + `ABP_Manny` mannequin path; a captain-specific mesh/material pass awaits the MetaHuman/Blender character pipeline.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
