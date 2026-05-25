# Save / Checkpoint — Catalog Pipeline Brief

**Category:** Systems · **Catalog:** `save-points` (new) · **Description:** Persistence point capturing player and world state.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Bonfire Checkpoint** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Granularity  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. State Schema (what is saved)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Versioning & Migration Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Trigger Rules (auto, manual, checkpoint)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Cloud / Local Storage Strategy  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Conflict Resolution Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Corruption Recovery Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Save UI (slots, thumbnails)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. VFX (autosave indicator)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. SFX (save sting)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Localization  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Load Time Budget Check  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Save/Load Soak Test Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. UE Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `save-points` (registered in Phase A).
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
