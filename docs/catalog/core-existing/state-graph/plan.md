# State Graph — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `state-graph` (existing) · **Description:** Generic finite state machine used across systems (player, NPC, door, quest...).

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Door FSM** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Scope  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. State Enumeration  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Transition Rules & Guards  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Event / Trigger Bindings  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Variable & Blackboard Schema  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Persistence Rules (save/load)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Replication Rules (multiplayer)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Debug Visualization  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Hook Points for VFX  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Hook Points for SFX  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Hook Points for Animation  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Unit Test Cases  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Edge Case & Deadlock Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. UE Asset Export  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `state-graph` (already registered).
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
