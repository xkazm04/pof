# State Graph Pipeline

> Catalog ID `state-graph` · Category Core / Existing · 9 steps

**Purpose.** Represents a generic finite state machine (FSM) used across systems — player, enemy AI, interactables, quest stages, companion logic — authored around an **enemy AI FSM** (Idle → Patrol → Chase → Attack → {Flee, Dead}) as the canonical exemplar. Wiring: `UStateTreeComponent` on the enemy actor runs the StateTree asset; transition guards read blackboard keys set by `UAISenseConfig_Sight` / `UAISenseConfig_Damage`; state ENTER/EXIT fire AnimNotify / GameplayEvent hooks so VFX/SFX/anim-blends key off `State.AI.*` gameplay tags, never imperative calls. Persistence obeys `arpg-save-semantics` — only discrete world-state mutations (`State.Enemy.Defeated.<slug>`) are saved.

## Target / starter entity
- **Enemy AI State Graph** (seeded from `ALL_MONTAGES` via `montageToEntry`, id `anim-<id>`) — the FSM governing a standard melee enemy NPC (the Brute archetype). Six states: IDLE, PATROL, CHASE, ATTACK, FLEE, DEAD. DEAD is the hard terminal; FLEE is a time-bounded recovery terminal.

## Pipeline steps
| # | Step | Archetype | Produces (UE assets) | Acceptance |
|---|------|-----------|----------------------|------------|
| 1 | Concept Brief | brief | — | L0 · `minLength(brief, ≥300)` |
| 2 | State Graph | graph | — | L0 · `graphValid(graph)` — 6 nodes / 13 edges, terminals FLEE + DEAD |
| 3 | Blackboard Schema | schema | `BB_EnemyAI_<slug>` | L0 · `minCount(blackboard, 7)` |
| 4 | Transition Rules | rules | `DT_StateGraphs` | L0 · `minCount(transitions, 6)` |
| 5 | Hook Points | rules | `NS_<slug>_*`, `SC_<slug>_*`, `ABP_EnemyAI` | L0 · `minCount(hooks, 5)` |
| 6 | Persistence | rules | `ARPGWorldStateSave` | L0 · `fieldsPopulated(currentState/patrolIndex/defeatedTag)` |
| 7 | Icon 2D Art | gallery | `T_<slug>_StateGraphIcon` | L1 · `selected` |
| 8 | Test Gate | checklist | — | L3 deferred · `runtimeDeferred(VSStateGraphTest)` |
| 9 | UE Packaging | manifest | `ST_EnemyAI_<slug>`, `BB_EnemyAI_<slug>`, `BT_EnemyAI_<slug>`, `ABP_EnemyAI_<slug>`, `DT_StateGraphs::<slug>`, `T_<slug>_StateGraphIcon` | L0 · `minCount(assets, 4)`; L2 `cppSymbolExists(UStateTreeComponent)` |

## UE wiring
- **C++ symbol** (`cppSymbolExists`): `UStateTreeComponent` (StateTree runner — engine or project component). Wiring contracts also reference `FARPGStateGraphRow`, `USTService_*` / `USTTask_*` (distance/LOS/timer services, `ApplyStateTag`), `UARPGVFXComponent` / `UARPGAudioComponent` (tag-event listeners), `AARPGWorldStateComponent` + `ARPGWorldStateSave` (persistence), `UARPGLootDropComponent` (fires on DEAD).
- **Assets:** `ST_EnemyAI_<slug>` (StateTree, primary), `BT_EnemyAI_<slug>` (legacy BT fallback), `BB_EnemyAI_<slug>` (8 typed blackboard keys), `ABP_EnemyAI_<slug>` (state-tag-driven blend spaces), `DT_StateGraphs` row.
- **Seed script** (named in wiring contracts): `Content/Python/seed_state_graph.py` seeds the StateTree/Blackboard assets + `DT_StateGraphs` row.
- **Runtime test:** `VSStateGraphTest` (no deadlock, all 6 states reachable, DEAD fires loot drop + `State.Enemy.Defeated.<slug>` world-state tag, save/reload suppresses re-spawn).
- **Cross-catalog links:** `icon-sets::iconset-abilities` (icon source). Dependencies on `bestiary` (`AARPGEnemyCharacter` host + `UARPGAttributeSet` HealthPct), `loot-tables` (`UARPGLootDropComponent`), `vfx` (NS_ assets).

## Acceptance profile
**L0 (data)** for every authoring step, with the State Graph using the `graphValid` checker (reachability from IDLE + ≥1 terminal), **L1 (human selection)** for the icon gallery, **L2 (static UE source)** on UE Packaging (`cppSymbolExists(UStateTreeComponent)`), plus one **L3 runtime-deferred** gate (`VSStateGraphTest`). Config-complete = all L0/L1/L2 steps pass and the no-deadlock/reachability test sits `deferred` until a live-UE/PIE runner executes it.

## Status & notes
Uses the **`graph` archetype** for its key step (6 nodes, 13 edges; FLEE recovery terminal + DEAD hard terminal). Guards are fully specified with UE condition types (`FAICondition_*`, `FSTCondition_*`) and priority ordering; health-driven transitions (→FLEE, →DEAD) are both event-driven and tick-evaluated. Persistence is deliberately minimal: current state, patrol index, and all blackboard keys are ephemeral (`saved: false`) — only the defeated tag persists, with a save-migration map handling slug renames.

---
*See [`../pipeline-architecture.md`](../pipeline-architecture.md) for the View/Produce/Acceptance model and the L0–L4 acceptance ladder.*
