# Cutscene / Cinematic — Catalog Pipeline Brief

**Category:** Quests & Narrative · **Catalog:** `cutscenes` (new) · **Description:** Scripted in-engine sequence for story moments.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Prologue: The Fall** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Story Beat  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Beat Sheet / Storyboard  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Shot List & Camera Plan  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Character Blocking  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Body Animation (mocap or AI gen)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Facial Animation & Lipsync  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Set Dressing & Props  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Lighting & Mood Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. VFX Pass (atmosphere, action)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Music Composition / Selection  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. SFX & Foley Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. VO Integration  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Subtitle & Localization  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. Cinematic Timing & Pacing  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 15. Skip / Replay Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 16. UE Sequencer Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `cutscenes` (registered in Phase A).
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
