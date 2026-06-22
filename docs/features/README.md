# PoF Feature Documentation

**Pillars of Fortune (PoF)** is an AI-powered UE5 game-development platform. It turns a blank idea into **realized, verified Unreal Engine 5 content** through declarative pipelines an LLM can drive — and proves the result actually works in the engine rather than assuming it.

This folder is the going-forward capability map. It documents the **Blueprint** world (the `/layout` design studio + the `src/lib/catalog/` pipeline engine + the LLM↔Unreal harness). It deliberately omits the **legacy** 7×37 sidebar module system (`src/components/modules/`, dzin-panels, the Evaluator and Game Director modules), which is being discontinued.

---

## The three pillars

| Pillar | What it is | Where |
|--------|------------|-------|
| **Catalog pipelines** | 31 declarative content pipelines — one per game-content type (Items, Quests, Bestiary, …). Each takes an entity from concept → spec → assets → verified UE content via a uniform View/Produce/Acceptance model. | this folder + [`pipeline-architecture.md`](pipeline-architecture.md) |
| **LLM ↔ Unreal interface** | The verification & control surface: Tiers-of-Truth observation, the PoF Bridge plugin (`:30040`), the L3/L4 gate runner, and the `pof-mcp` tools an agent calls. "Done" means *observed*, not assumed. | [`harness-llm-unreal/llm-ue-interface.md`](harness-llm-unreal/llm-ue-interface.md) |
| **Autonomous builder** | A long-running loop that plans whole features, spawns Claude Code sessions to implement them, runs quality gates, self-heals, and checkpoints green states. | [`harness-llm-unreal/autonomous-builder.md`](harness-llm-unreal/autonomous-builder.md) |

**Read these first:** [`pipeline-architecture.md`](pipeline-architecture.md) (the chassis all pipelines share) and [`harness-llm-unreal/`](harness-llm-unreal/README.md) (how authored content gets driven into UE and verified). [`items/`](items/README.md) is the worked reference example.

---

## How a pipeline works (60-second version)

Every pipeline is an ordered list of **steps**; every step has three faces:

- **View** — a purpose-built render of the step's current state (prose, table, gallery, graph, …).
- **Produce** — an LLM/CLI action (with a user direction box) that writes `{ data, ueAssets, links }`.
- **Acceptance** — a *derived* verdict (never a manual checkbox), tiered by how grounded the evidence is:

| Tier | Proves | Parallel-safe |
|------|--------|---------------|
| **L0** data | the spec is complete & in-budget | ✅ |
| **L1** selection | a human picked the asset | ✅ |
| **L2** static | the symbol/row exists in UE source | ✅ |
| **L3** runtime | it loads/spawns/applies in PIE | ❌ (serialized, `deferred` → drained) |
| **L4** visual | it renders correctly (a seeing agent judges a frame) | ❌ (serialized, `deferred` → drained) |

L0–L2 are the **config-complete** bar a single CLI reaches solo, so many authors run in parallel; only L3/L4 verification serializes through the one live editor. Full detail in [`pipeline-architecture.md`](pipeline-architecture.md).

---

## Catalog pipeline index (31 pipelines · ~332 steps)

### Core / Existing
| Pipeline | Steps | What it authors |
|----------|-------|-----------------|
| [items](items/README.md) | 11 | equippable items — affixes-as-GameplayEffects, rarity/ilvl model. **Reference implementation.** |
| [loot-tables](loot-tables/README.md) | 10 | drop distributions: drop-class → rarity → ilvl-gated affix roll |
| [bestiary](bestiary/README.md) | 12 | creature/NPC archetypes — stats, AI, presentation |
| [combat-map](combat-map/README.md) | 12 | tactical encounter arenas, rules & spawn logic |
| [screen-flow](screen-flow/README.md) | 11 | UI navigation graph between screens/menus (graph archetype) |
| [zone-map](zone-map/README.md) | 12 | explorable regions — POIs, navigation, ambient systems |
| [state-graph](state-graph/README.md) | 9 | generic finite state machines (graph archetype) |
| [materials](materials/README.md) | 10 | shader/material definitions, parameters & variants |

### Game Assets
| Pipeline | Steps | What it authors |
|----------|-------|-----------------|
| [characters](characters/README.md) | 12 | playable/named NPCs (designed seed: **Captain Vael**) |
| [spellbook](spellbook/README.md) | 11 | active/passive abilities (seed: Fireball) |
| [status-effects](status-effects/README.md) | 6 | temporary/persistent actor modifiers (Burning, Chilled) |
| [props](props/README.md) | 11 | static/interactable world objects |
| [player-movement](player-movement/README.md) | 10 | **bridge-driven** Mixamo→Manny locomotion → playable gate |

### Quests & Narrative
| Pipeline | Steps | What it authors |
|----------|-------|-----------------|
| [quests](quests/README.md) | 11 | structured objectives — stages, rewards, beats (objective DAG) |
| [dialog-trees](dialog-trees/README.md) | 12 | branching conversations with conditions/effects/voice |
| [cutscenes](cutscenes/README.md) | 13 | scripted in-engine LevelSequence story moments |
| [codex](codex/README.md) | 11 | unlockable encyclopedia entries (knowledge graph) |
| [factions](factions/README.md) | 11 | group standings, rewards, consequences |

### Systems
| Pipeline | Steps | What it authors |
|----------|-------|-----------------|
| [crafting-recipes](crafting-recipes/README.md) | 11 | combine inputs → output items with conditions |
| [vendors](vendors/README.md) | 11 | NPC merchants — inventory, pricing, restock |
| [progression-curves](progression-curves/README.md) | 12 | XP/level/mastery curves driving advancement |
| [achievements](achievements/README.md) | 12 | cross-session accomplishments (server-authoritative) |
| [save-points](save-points/README.md) | 12 | persistence/checkpoint capture of player+world state |

### Audio & FX
| Pipeline | Steps | What it authors |
|----------|-------|-----------------|
| [music](music/README.md) | 10 | adaptive/linear music with stems & layers |
| [ambient](ambient/README.md) | 10 | layered environmental soundscapes |
| [vfx](vfx/README.md) | 10 | reusable Niagara particle effects |

### UI · Input · Onboarding · Economy
| Pipeline | Steps | Category | What it authors |
|----------|-------|----------|-----------------|
| [hud-elements](hud-elements/README.md) | 10 | UI | persistent in-game HUD widgets |
| [icon-sets](icon-sets/README.md) | 7 | UI | coherent icon families (atlas taxonomy) |
| [input-schemes](input-schemes/README.md) | 12 | Input & Platform | bindings & feel for one input device family |
| [tutorial-beats](tutorial-beats/README.md) | 13 | Onboarding | single scripted teaching moments |
| [currencies](currencies/README.md) | 7 | Economy / Meta | spendable resource types in the economy |

> **Seed-only stubs (no pipeline yet):** the `audio` and `animation-assets` catalogs are registered as sections with seed data but have no `registerCatalogPipeline` definition — they are placeholders for future pipelines, not documented here.

---

## What this lets us do going forward

- **Author any content type the same way.** Adding a pipeline is adding one self-registering file; the `/layout` studio, the e2e walker, and the gate runner pick it up automatically. New content domains are cheap.
- **Run many authors in parallel.** Because config-complete (L0–L2) is parallel-safe and only L3/L4 serialize, a fleet of CLI sessions (or the autonomous builder's streaming pool) can make real progress at once without clobbering the shared editor.
- **Trust the output.** Nothing is "done" on a symbolic proxy alone — runtime tests run in PIE and a multimodal agent reads rendered frames (the T-pose lesson). Verdicts are derived from UE/SQLite truth and recorded.
- **Close the loop autonomously.** The builder can plan → implement → verify → self-heal → checkpoint a whole feature, emitting a reusable build guide as it goes.
- **Drive it from anywhere.** The same capabilities are exposed over HTTP (`/api/...`), as `pof-mcp` MCP tools for a Claude Code CLI, and through the `/layout` UI.

---

## Source map

| Area | Path |
|------|------|
| Pipeline definitions | `src/lib/catalog/pipelines/*.ts` |
| Pipeline engine, acceptance, canon | `src/lib/catalog/` |
| `/layout` design studio | `src/components/layout-lab/` |
| Autonomous builder | `src/lib/harness/` |
| LLM↔UE observation contract | `src/lib/observation/` |
| UE bridge client | `src/lib/bridge/` |
| L3/L4 gate runner | `src/lib/test-gate-runner/` |
| Agent-facing MCP tools | `tools/pof-mcp/` |
| Deeper architecture docs | `docs/architecture/`, `docs/catalog/` |
