# Prop / Environment Asset — Catalog Pipeline Brief

**Category:** Game Assets · **Catalog:** `props` (new) · **Description:** Static or interactable world object.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Reinforced Crate** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Reference  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Interaction Rules (static / usable / destructible)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Mesh Generation (LOD0-LOD3)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Collision & Physics Setup  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Material & Texture Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Damage / Destruction States  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Animation (if interactable)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. VFX (use, destruction)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. SFX (interact, impact)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Lighting Bake Compatibility  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Memory & Tri Budget Check  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Variant Generation (color, wear)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Visual QA Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. UE Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `props` (registered in Phase A).
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
