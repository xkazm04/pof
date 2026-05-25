# Bestiary Entry — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `bestiary` (existing) · **Description:** A creature/NPC archetype with stats, AI, and presentation.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Brute** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Role  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Lore & Codex Text  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Stat Block & Resistances  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Ability Set Definition  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. AI Behavior Tree  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Aggro / Perception Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Encounter Difficulty Balancing  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Loot Table Binding  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Concept Art 2D  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. 3D Model & Rig  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Material & Texture Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Animation Set (idle/move/attack/hit/death)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. VFX Set (abilities, status)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. SFX Set (voice, foley, ability)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 15. Combat Test Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 16. UE Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `bestiary` (already registered).
- **Data schema:** design during the schema step; persist via the catalog `data` field.
- **Reuse / gaps:** assess against existing PoF capabilities (catalogs, recipes, dispatches, Leonardo-2D, Blender, audio-import, GAS B3 codegen, functional tests) — record in Session Findings.

## Cross-catalog dependencies
- _Identify during design (e.g. consumers/producers of other catalog rows)._

## Session Findings
_Fill this in at the end of the session._
### Cross-catalog opportunities
-
### Gaps / blockers for future sessions
-
