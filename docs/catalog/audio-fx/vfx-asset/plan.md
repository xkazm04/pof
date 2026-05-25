# VFX Asset — Catalog Pipeline Brief

**Category:** Audio & FX · **Catalog:** `vfx` (new) · **Description:** Reusable particle/Niagara effect.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Fire Impact Burst** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Reference  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Behavior Logic (emission, lifetime, collision)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Mesh / Sprite Source Generation  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Material / Shader Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Light & Shadow Contribution  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Sound Hook Binding  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. LOD & Scalability  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. GPU Cost Budget  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Variant Set (small/med/large)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Trigger Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Visual QA Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Performance Test Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. UE Niagara Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `vfx` (registered in Phase A).
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
