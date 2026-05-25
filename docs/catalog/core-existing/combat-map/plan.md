# Combat Map — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `combat-map` (existing) · **Description:** Tactical encounter arena with rules and spawn logic.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Arena Slice** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Objectives  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Tactical Grid / Layout Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Cover & LoS Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Spawn & Wave Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Win/Loss Condition Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Encounter Balancing  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Environmental Hazards Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Terrain Mesh & Props  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Material Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Lighting Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Ambient VFX  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Ambient SFX & Music Cue  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Camera Behavior  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. Playtest Balance Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 15. UE Level Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `combat-map` (already registered).
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
