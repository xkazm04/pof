# Faction / Reputation System — Catalog Pipeline Brief

**Category:** Quests & Narrative · **Catalog:** `factions` (new) · **Description:** Group affiliation with standings, rewards, and consequences.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**The Ashen Order** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Role in World  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Reputation Tier Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Action → Reputation Mapping  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Cross-Faction Relation Matrix  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Reward & Discount Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Hostility / Access Gates  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Decay & Recovery Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Faction Icon & Heraldry 2D  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Faction Theme Music Cue  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. NPC Greeting Variation Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. UI Standing Display  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Localization  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Edge Case Test (max/min standing)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. UE Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `factions` (registered in Phase A).
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
