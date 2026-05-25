# Item — Catalog Pipeline Brief

**Category:** Core / Existing · **Catalog:** `items` (existing) · **Description:** Equippable, consumable, or quest item with stats and presentation.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Iron Longsword** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Data Schema Definition  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Stat & Rules Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Economy & Rarity Balancing  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Localization Strings  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Icon 2D Art  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. 3D Mesh Generation  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Material & Texture Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. Pickup / Equip Animation  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. VFX (idle, equip, use)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. SFX (pickup, use, equip)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Inventory UI Integration  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Tooltip & Compare View  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. Test Gate (rules + visuals)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 15. UE Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `items` (already registered).
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
