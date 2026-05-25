# Dialog Tree — Catalog Pipeline Brief

**Category:** Quests & Narrative · **Catalog:** `dialog-trees` (new) · **Description:** Branching conversation with conditions, effects, and voice.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Gatekeeper Greeting** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Character Voice  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Branch Graph Authoring  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Condition Logic (flags, stats, items)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Effect Logic (give/take, flag set, quest advance)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Persuasion / Skill Check Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Localization Strings  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. VO Script & Take Directions  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. VO Recording / TTS Generation  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Lipsync Generation  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Facial / Body Animation Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Camera Framing Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Ambient SFX & Music Bed  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. UI Layout (subtitles, choices)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. Accessibility Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 15. Branch Coverage Test Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 16. UE Dialog Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `dialog-trees` (registered in Phase A).
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
