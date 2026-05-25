# Skill / Ability — Catalog Pipeline Brief

**Category:** Game Assets · **Catalog:** `spellbook` (existing) · **Description:** Active or passive ability used by characters/enemies.

> Read [`../../index.md`](../../index.md) first — shared execution contract, agent roles, test-gate definition, PoF-systems map.

## Target asset (build this one end-to-end)
**Fireball** — drive this single entity through every step below, idea → real UE asset → passing test gate.

## Pipeline (from game_catalog_pipelines.xlsx)
- [ ] 1. Concept Brief & Fantasy  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 2. Mechanical Effect Logic  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 3. Cost & Cooldown Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 4. Targeting Rules (range, shape, LoS)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 5. Damage / Healing / Status Formulas  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 6. Combo & Interaction Rules  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 7. Balancing & Tuning Pass  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 8. Animation Set (windup, cast, recover)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 9. VFX (cast, projectile, impact)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 10. SFX (cast, impact, voice)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 11. UI (icon, tooltip, cooldown ring)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 12. Camera Shake / Feedback  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 13. Localization  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 14. AI Usage Hints (for enemy use)  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 15. Combat Test Gate  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_
- [ ] 16. UE Ability Asset Packaging  
  _agent: TBD-by-session · reuse/gap: TBD-by-session_

## PoF integration
- **Catalog:** `spellbook` (already registered).
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
