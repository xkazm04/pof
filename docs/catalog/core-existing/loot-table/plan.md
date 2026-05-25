# Loot Table — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `loot-tables` (existing) · **Description:** Drop distribution for enemies, containers, quests, vendors.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Brute Drop Table** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Source Binding (enemy/chest/quest)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Rarity Weight Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Conditional Modifiers (level, luck, quest flags)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Pity / Anti-Streak Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Currency vs Item Mix Balancing  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Economy Simulation (drop rates)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Drop VFX Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Drop SFX Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. Loot Beam / Highlight 2D  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. Telemetry Hooks  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Edge Case Tests (empty, overflow)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Balance Test Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. UE Data Asset Export  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `loot-tables` (already registered).
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
