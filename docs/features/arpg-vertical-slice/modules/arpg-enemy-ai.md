# `arpg-enemy-ai` — vertical-slice readiness

## 1. One-line purpose
Provides AI controller, behavior tree, perception, and enemy character base for standing still, taking damage, and dying when Health ≤ 0.

## 2. Files of record
- **UI panels:** `src/components/modules/core-engine/dzin-panels/EnemyBestiaryPanel.tsx:142-144` — Enemy archetype overview
- **UI panels:** `src/components/modules/core-engine/dzin-panels/EnemyAITreePanel.tsx:124-144` — BT state display
- **Module registry entry:** `src/lib/module-registry.ts:466-474` — Module registration with quick actions
- **Quick actions:** `src/lib/module-registry.ts:312-316` — Debug AI, Create Enemy Type, Tune Difficulty
- **Feature definitions:** `src/lib/feature-definitions.ts:212-221` — 8 feature specs
- **Evaluator prompts:** `src/lib/evaluator/module-eval-prompts.ts:133-145` — Structure, quality, performance checks

API routes: _(none)_  
Prompt builders: _(none)_  
Store slice: _(none)_

## 3. Vertical-slice relevance
**Required UE5 artifact:** `AARPGEnemyBase` with ASC, no movement — stands still, takes damage, dies (Health ≤ 0 → destroy)

Acceptance bullets:
- [ ] Enemy character spawns with Health attribute from ASC (depends on `arpg-gas::Core AttributeSet`)
- [ ] Enemy takes damage via GAS when hit (depends on `arpg-combat::Death flow` integration)
- [ ] Enemy destroyed when Health ≤ 0; one loot pickup spawns at death location (depends on `arpg-loot::Loot drop on death`)
- [ ] Standing idle without movement/patrolling; no AI controller activity required for slice

## 4. Current state
Harness scenario: **8/8 "Complete", 3.9/5 quality**. UI panels fully structured: EnemyBestiaryPanel shows 4 archetypes (Melee Grunt, Ranged Caster, Brute, Assassin) and radar stats; EnemyAITreePanel displays 5 BT states (Idle, Patrol, Chase, Attack, Flee) with execution pipeline. Module registry defines 8 features spanning AIController, AARPGEnemyCharacter, perception, BT, EQS, archetypes, abilities, and spawn system. Evaluator checks cover BT structure, blackboard typing, perception radius, and State Tree (5.7+) support.

## 5. Gaps blocking the slice
_(no gaps blocking the vertical slice)_

**Open question for sub-project B:** The module spec defines full AI scope (behavior trees, EQS patrol, perception, 3 archetypes, charge attacks, wave spawning, difficulty scaling). For the minimal dummy enemy slice, only `AARPGEnemyCharacter` with ASC and death-to-loot is needed. **Does PoF prompt generation over-engineer a full AI controller + BT + perception when the slice needs only a stateless character?** Recommend a "dummy enemy" mode or path that skips AIController entirely for the vertical slice, with a TODO flag if perception/BT are outside slice scope.

## 6. testId touchpoints
| File | Component | Target testId | Currently present? | Notes |
|------|-----------|---------------|--------------------|-------|
| EnemyBestiaryPanel | Archetype list | `pof-module-arpg-enemy-ai-archetype-list` | No | Could target BT states / archetype renders |
| EnemyAITreePanel | BT state cards | `pof-module-arpg-enemy-ai-bt-states` | No | Could expose individual state items |

EnemyBestiaryPanel and EnemyAITreePanel are **display-only** in dzin prototypes; no Playwright controls for direct enemy spawning. Slice scenario drives PoF UI via MCP, then runs the packaged build — enemy spawning is UE5-side, not testId-driven. Recommend tagging the panel render targets for integration test visibility.
