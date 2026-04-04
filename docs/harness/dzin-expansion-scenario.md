# Dzin Dynamic UI — Full App Coverage Harness Scenario

> Target: Expand the LLM-driven dynamic UI (dzin) from 10 arpg-combat panels to full app coverage
> Codebase: `C:\Users\kazda\kiro\pof` (the PoF webapp, NOT the UE5 project)
> Current: 10 panels in `arpg-combat` domain only
> Goal: 50+ panels across all game dev domains + decision logic expansion

## Current State

| Component | Count | Coverage |
|-----------|-------|----------|
| Panel components | 10 | arpg-combat only |
| Panel domains | 1 | `arpg-combat` |
| Layout templates | 8 | Complete |
| Composition presets | 3 | Combat only |
| Intent handlers | 4 | compose, manipulate, navigate, system |
| Slash commands | ~5 | Combat shortcuts only |
| Entity relations | 2 types | ability, tag |
| Advisor tools | Basic | openPanels, setLayout |

## Expansion Plan — 8 Phases

### Phase 1: Character & Animation Panels (6 new panels)
New panels for character systems — reuses existing unique-tab data patterns.

| Panel ID | Label | Domain | Description |
|----------|-------|--------|-------------|
| `character-overview` | Character Blueprint | arpg-character | Class hierarchy, scaling preview, property inspector |
| `character-movement` | Movement & Feel | arpg-character | Sprint/dodge params, acceleration curves, feel optimizer |
| `animation-state-machine` | Animation States | arpg-animation | State machine graph, transitions, blend weights |
| `animation-montages` | Montage Library | arpg-animation | Montage list, notifies, sections, combo chains |
| `animation-blend-space` | Blend Spaces | arpg-animation | 2D blend space visualization |
| `character-input` | Input Bindings | arpg-character | Enhanced input actions, mapping contexts, key visualization |

### Phase 2: Inventory & Loot Panels (6 new panels)
Item economy panels — connects to existing ItemCatalog, LootTableVisualizer data.

| Panel ID | Label | Domain | Description |
|----------|-------|--------|-------------|
| `inventory-catalog` | Item Catalog | arpg-inventory | Item browser with filtering, rarity, stats |
| `inventory-equipment` | Equipment Slots | arpg-inventory | Slot layout, equipped items, stat changes |
| `loot-table` | Loot Tables | arpg-loot | Drop rates, weighted selection, pity timers |
| `loot-affix` | Affix Workbench | arpg-loot | Affix pools, crafting station, breakpoints |
| `item-economy` | Economy Sim | arpg-loot | Supply/demand curves, power distribution |
| `item-dna` | Item Genome | arpg-loot | DNA editor, breeding, evolution, roll simulator |

### Phase 3: Enemy AI & World Panels (6 new panels)
AI behavior and world design — connects to EnemyBestiary, ZoneMap.

| Panel ID | Label | Domain | Description |
|----------|-------|--------|-------------|
| `enemy-bestiary` | Enemy Bestiary | arpg-enemy | Archetypes, stats, behavior trees, comparison |
| `enemy-ai-tree` | Behavior Tree | arpg-enemy | BT flowchart, decision debugger, perception cones |
| `world-zone-map` | Zone Map | arpg-world | Topology graph, zone connections, density |
| `world-encounters` | Encounters | arpg-world | Spawn formations, boss encounters, difficulty |
| `world-level-design` | Level Designer | arpg-world | Room editor, streaming zones, flow graph |
| `progression-curves` | Progression | arpg-progression | XP curves, power curves, milestone timeline |

### Phase 4: UI/HUD & Save System Panels (5 new panels)
Game UI design and persistence — connects to ScreenFlowMap, SaveDataSchema.

| Panel ID | Label | Domain | Description |
|----------|-------|--------|-------------|
| `hud-compositor` | HUD Compositor | arpg-ui | Widget layout, health bars, damage numbers |
| `screen-flow` | Screen Flow | arpg-ui | Screen navigation graph, accessibility audit |
| `save-schema` | Save Schema | arpg-save | Schema tree, migration graph, size breakdown |
| `save-slots` | Save Manager | arpg-save | Slot management, auto-save config, integrity |
| `menu-flow` | Menu System | arpg-ui | Menu flow diagram, HUD theme editor |

### Phase 5: Evaluator & Quality Panels (5 new panels)
Meta-level quality panels — connects to evaluator system.

| Panel ID | Label | Domain | Description |
|----------|-------|--------|-------------|
| `eval-quality` | Quality Dashboard | evaluator | Aggregate scores, findings by severity |
| `eval-deps` | Dependency Graph | evaluator | Cross-module feature dependencies |
| `eval-insights` | Insights | evaluator | AI-generated insights, recommendations |
| `project-health` | Project Health | evaluator | Build status, test results, coverage |
| `feature-matrix` | Feature Matrix | evaluator | Implementation status across all modules |

### Phase 6: Content & Visual Panels (5 new panels)
Content creation panels — connects to material, audio, model systems.

| Panel ID | Label | Domain | Description |
|----------|-------|--------|-------------|
| `material-preview` | Material Lab | content | PBR preview, layer graph, shader patterns |
| `audio-spatial` | Spatial Audio | content | Sound emitters, reverb zones, music system |
| `model-assets` | Asset Inventory | content | Model browser, LOD preview, pipeline status |
| `level-blockout` | Level Blockout | content | Procedural level wizard, room editor |
| `vfx-particles` | VFX Studio | content | Post-process stack, particle preview |

### Phase 7: Decision Logic & Composition Expansion
Expand the advisor's ability to compose panels from any domain.

| Task | Description |
|------|-------------|
| Multi-domain registry | Register all 43+ panels in panel-definitions.ts |
| Cross-domain entity relations | Extend selection context beyond ability/tag |
| New composition presets | 15+ presets across domains |
| Advisor tool expansion | Domain-aware panel suggestion logic |
| Slash command coverage | `/character`, `/loot`, `/world`, `/save`, etc. |
| Intent handler: `query` | Search across all panels by content |

### Phase 8: Testing & Quality
Verify the expanded system works end-to-end.

| Task | Description |
|------|-------------|
| Panel rendering test | Each panel renders at all 3 densities |
| Layout stress test | 4-6 panels from different domains in grid-4/studio |
| Cross-domain selection | Entity selection highlights across domains |
| Advisor composition | LLM correctly picks panels for freeform requests |
| Slash command coverage | All commands produce correct compositions |

---

## Running

```bash
# From PoF webapp root (NOT UE5 project)
npx tsx src/lib/harness/run-harness.ts \
  --project "C:/Users/kazda/kiro/pof" \
  --name "PoF-Dzin" \
  --ue-version "5.7.3" \
  --max-iterations 50 \
  --target-pass-rate 90 \
  --theme "Expand the dzin dynamic UI system to cover all game development domains. Create new panel components following the existing pattern (3-density: micro/compact/full, PanelFrame wrapper, framer-motion density transitions, cross-panel selection support). Register panels in panel-definitions.ts. Add composition presets and slash commands for each domain."
```
