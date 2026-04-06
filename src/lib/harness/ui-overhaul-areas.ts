/**
 * UI Overhaul Areas — custom area definitions for the webapp UI/UX harness scenario.
 *
 * These areas target the PoF webapp itself (not UE5 project), upgrading all
 * core-engine unique tabs across three axes: Scaling, Usability, Visual Quality.
 *
 * Usage: Pass as `config.areas` to buildGamePlan() or import in run-harness.ts
 * with --scenario ui-overhaul flag.
 *
 * See docs/harness/ui-overhaul-scenario.md for full specifications.
 */

import type { ModuleArea, PlannedFeature } from './types';

/* ── Helper ─────────────────────────────────────────────────────────────────── */

function feat(name: string): PlannedFeature {
  return { id: name, name, status: 'pending', quality: null, lastSession: null };
}

function area(
  id: string,
  label: string,
  description: string,
  features: string[],
  dependsOn: string[] = [],
): ModuleArea {
  return {
    id,
    moduleId: 'arpg-character', // cross-cutting — moduleId is informational only for UI areas
    label,
    description,
    checklistItemIds: [],
    featureNames: features,
    dependsOn,
    status: 'pending',
    features: features.map(feat),
  };
}

/* ── Phase 0: Infrastructure ────────────────────────────────────────────────── */

const PHASE_0: ModuleArea[] = [
  area(
    'infra-entity-selector-a',
    'Scalable Entity Selector (Part 1)',
    `Create src/components/shared/ScalableSelector.tsx — a modal overlay component for picking
from 100+ entities. Must support: debounced search (300ms), group-by with collapsible sections,
virtual scroll for large lists, multi-select and single-select modes, keyboard navigation
(arrow keys, Enter, Escape), render prop for custom item cards, selected items shown as pills.
Props: items, groupBy, renderItem, onSelect, selected, searchKey, placeholder, mode.
Component structure: index.tsx, SelectorSearch.tsx, SelectorGroup.tsx, SelectorGrid.tsx, types.ts.
Place in src/components/shared/ScalableSelector/.`,
    [
      'Modal overlay with backdrop and focus trap',
      'Debounced search filtering (300ms)',
      'Group-by collapsible sections with count badges',
    ],
  ),

  area(
    'infra-entity-selector-b',
    'Scalable Entity Selector (Part 2)',
    `Create src/components/shared/ScalableSelector.tsx — a modal overlay component for picking
from 100+ entities. Must support: debounced search (300ms), group-by with collapsible sections,
virtual scroll for large lists, multi-select and single-select modes, keyboard navigation
(arrow keys, Enter, Escape), render prop for custom item cards, selected items shown as pills.
Props: items, groupBy, renderItem, onSelect, selected, searchKey, placeholder, mode.
Component structure: index.tsx, SelectorSearch.tsx, SelectorGroup.tsx, SelectorGrid.tsx, types.ts.
Place in src/components/shared/ScalableSelector/.`,
    [
      'Virtual scroll for 100+ items',
      'Multi-select and single-select modes',
      'Keyboard navigation (arrows, Enter, Escape)',
    ],
    ['infra-entity-selector-a'],
  ),

  area(
    'infra-entity-selector-c',
    'Scalable Entity Selector (Part 3)',
    `Create src/components/shared/ScalableSelector.tsx — a modal overlay component for picking
from 100+ entities. Must support: debounced search (300ms), group-by with collapsible sections,
virtual scroll for large lists, multi-select and single-select modes, keyboard navigation
(arrow keys, Enter, Escape), render prop for custom item cards, selected items shown as pills.
Props: items, groupBy, renderItem, onSelect, selected, searchKey, placeholder, mode.
Component structure: index.tsx, SelectorSearch.tsx, SelectorGroup.tsx, SelectorGrid.tsx, types.ts.
Place in src/components/shared/ScalableSelector/.`,
    [
      'Selected items as compact pills',
      'Render prop slot for custom item cards',
    ],
    ['infra-entity-selector-b'],
  ),

  area(
    'infra-feature-cards-a',
    'Feature Map Card System (Part 1)',
    `Replace the toggle-list FeatureMapTab with a card-grid matrix.
Each feature becomes a FeatureCard component — clickable card with active/inactive states.
Active: colored background tint (withOpacity accent 8%), bright border (accent 30%), full-color content.
Inactive: muted border (neutral 20%), desaturated content, reduced opacity.
Card shows: feature name (mono bold), metric content area (children render prop), status dot (bottom-right).
Layout: CSS grid auto-fill, min 160px, gap-3. Tab groups become section headers.
Create: src/components/shared/FeatureCard.tsx, src/components/shared/FeatureCardGrid.tsx.
Update: src/components/modules/core-engine/unique-tabs/FeatureMapTab.tsx to use new components.
Keep Enable All / Disable All buttons. Add NeonBar progress at top.`,
    [
      'FeatureCard with click-to-toggle',
      'Active/inactive visual states with accent coloring',
      'Metric content slot (children render prop)',
      'Status indicator dot (green/amber/red)',
    ],
  ),

  area(
    'infra-feature-cards-b',
    'Feature Map Card System (Part 2)',
    `Replace the toggle-list FeatureMapTab with a card-grid matrix.
Each feature becomes a FeatureCard component — clickable card with active/inactive states.
Active: colored background tint (withOpacity accent 8%), bright border (accent 30%), full-color content.
Inactive: muted border (neutral 20%), desaturated content, reduced opacity.
Card shows: feature name (mono bold), metric content area (children render prop), status dot (bottom-right).
Layout: CSS grid auto-fill, min 160px, gap-3. Tab groups become section headers.
Create: src/components/shared/FeatureCard.tsx, src/components/shared/FeatureCardGrid.tsx.
Update: src/components/modules/core-engine/unique-tabs/FeatureMapTab.tsx to use new components.
Keep Enable All / Disable All buttons. Add NeonBar progress at top.`,
    [
      'FeatureCardGrid with CSS grid layout',
      'Section headers from tab groups',
      'NeonBar progress bar at top',
      'Responsive grid (2→3→4 columns)',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'infra-design-tokens-a',
    'Design Token Standardization (Part 1)',
    `Audit and standardize border opacities, glow radii, spacing across all unique-tab components.
Add to chart-colors.ts: BORDER_DEFAULT=OPACITY_20, BORDER_HOVER=OPACITY_37, BORDER_SUBTLE=OPACITY_10,
GLOW_SM='0 0 4px', GLOW_MD='0 0 8px', GLOW_LG='0 0 16px'.
Add to globals.css: --panel-padding:12px, --card-gap:12px, --section-gap:16px.
Update _design.tsx and _shared.tsx to use new constants.
Grep all unique-tabs/ for hardcoded hex opacity suffixes (e.g., #3b82f618, #f8717120)
and replace with imported withOpacity + constants. Do NOT change visual appearance.`,
    [
      'Border opacity constants in chart-colors.ts',
      'Glow size constants in chart-colors.ts',
      'Spacing CSS variables in globals.css',
    ],
  ),

  area(
    'infra-design-tokens-b',
    'Design Token Standardization (Part 2)',
    `Audit and standardize border opacities, glow radii, spacing across all unique-tab components.
Add to chart-colors.ts: BORDER_DEFAULT=OPACITY_20, BORDER_HOVER=OPACITY_37, BORDER_SUBTLE=OPACITY_10,
GLOW_SM='0 0 4px', GLOW_MD='0 0 8px', GLOW_LG='0 0 16px'.
Add to globals.css: --panel-padding:12px, --card-gap:12px, --section-gap:16px.
Update _design.tsx and _shared.tsx to use new constants.
Grep all unique-tabs/ for hardcoded hex opacity suffixes (e.g., #3b82f618, #f8717120)
and replace with imported withOpacity + constants. Do NOT change visual appearance.`,
    [
      '_design.tsx updated to use new tokens',
      '_shared.tsx updated to use new tokens',
      'Hardcoded opacity suffixes replaced in components',
    ],
    ['infra-design-tokens-a'],
  ),

  area(
    'infra-metadata-schema-a',
    'Entity Metadata Schema (Part 1)',
    `Define TypeScript interfaces for categorizing game entities.
Create src/types/game-metadata.ts with:
- EntityMetadata: id, name, category, subcategory?, tags[], level?, levelMax?, area?, tier?, icon?
- EntityGrouping: field (keyof EntityMetadata), label, order? (explicit group sort)
- Default grouping presets: CHAR_GROUPINGS (category→subcategory), ITEM_GROUPINGS (category→tier),
  ABILITY_GROUPINGS (category→element), ENEMY_GROUPINGS (area→tier)
Extend each module's data.ts with metadata fields on mock items (add category, tags, area, tier).
This is the foundation for ScalableSelector group-by in Phase 2.`,
    [
      'EntityMetadata interface',
      'EntityGrouping interface',
      'Default grouping presets per module type',
      'Character mock data annotated with metadata',
    ],
  ),

  area(
    'infra-metadata-schema-b',
    'Entity Metadata Schema (Part 2)',
    `Define TypeScript interfaces for categorizing game entities.
Create src/types/game-metadata.ts with:
- EntityMetadata: id, name, category, subcategory?, tags[], level?, levelMax?, area?, tier?, icon?
- EntityGrouping: field (keyof EntityMetadata), label, order? (explicit group sort)
- Default grouping presets: CHAR_GROUPINGS (category→subcategory), ITEM_GROUPINGS (category→tier),
  ABILITY_GROUPINGS (category→element), ENEMY_GROUPINGS (area→tier)
Extend each module's data.ts with metadata fields on mock items (add category, tags, area, tier).
This is the foundation for ScalableSelector group-by in Phase 2.`,
    [
      'Item mock data annotated with metadata',
      'Enemy mock data annotated with metadata',
      'Ability mock data annotated with metadata',
    ],
    ['infra-metadata-schema-a'],
  ),
];

/* ── Phase 1: Feature Map Metrics ───────────────────────────────────────────── */

const PHASE_1: ModuleArea[] = [
  area(
    'ui-character-feature-metrics-a',
    'Character Blueprint Feature Metrics (Part 1)',
    `Add unique metric visualizations to each FeatureCard in the Character Blueprint Feature Map tab.
Each card's children slot gets a micro-visualization:
- Class Hierarchy: "{types} types / {classes} classes" side by side numbers
- Properties: Stacked mini bars (HP, Speed, Armor ranges, 60px wide)
- Scaling: Sparkline SVG (60×20px) showing first 10 curve points
- Hitbox: "{zones} zones" with colored dots (hurtbox=red, hitbox=blue, pushbox=green)
- Camera: Three compact stats "FOV | Arm | Lag" in mono font
- Bindings: Colored ratio bar "{bound}/{total}" with NeonBar
- Keyboard: "{conflicts}" count — green if 0, red if >0
- States: "{count} states" with mini icon
- Dodge: "{distance}m" bold number
- Curve Editor: Tiny sparkline of feel curve
- Optimizer: Preset name or "No preset" muted
- Comparison: "{dupes} duplicates" — red if >0
- Balance: Mini radar thumbnail (40×40px SVG)
All metrics derive from existing data in CharacterBlueprint/data.ts.
Create metric components in CharacterBlueprint/metrics/ directory.`,
    [
      'Class Hierarchy metric component',
      'Properties mini-bar metric',
      'Scaling sparkline metric',
      'Hitbox zone-dots metric',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-character-feature-metrics-b',
    'Character Blueprint Feature Metrics (Part 2)',
    `Add unique metric visualizations to each FeatureCard in the Character Blueprint Feature Map tab.
Each card's children slot gets a micro-visualization:
- Class Hierarchy: "{types} types / {classes} classes" side by side numbers
- Properties: Stacked mini bars (HP, Speed, Armor ranges, 60px wide)
- Scaling: Sparkline SVG (60×20px) showing first 10 curve points
- Hitbox: "{zones} zones" with colored dots (hurtbox=red, hitbox=blue, pushbox=green)
- Camera: Three compact stats "FOV | Arm | Lag" in mono font
- Bindings: Colored ratio bar "{bound}/{total}" with NeonBar
- Keyboard: "{conflicts}" count — green if 0, red if >0
- States: "{count} states" with mini icon
- Dodge: "{distance}m" bold number
- Curve Editor: Tiny sparkline of feel curve
- Optimizer: Preset name or "No preset" muted
- Comparison: "{dupes} duplicates" — red if >0
- Balance: Mini radar thumbnail (40×40px SVG)
All metrics derive from existing data in CharacterBlueprint/data.ts.
Create metric components in CharacterBlueprint/metrics/ directory.`,
    [
      'Camera compact stats metric',
      'Bindings ratio bar metric',
      'Keyboard conflict counter metric',
      'States count metric',
    ],
    ['ui-character-feature-metrics-a'],
  ),

  area(
    'ui-character-feature-metrics-c',
    'Character Blueprint Feature Metrics (Part 3)',
    `Add unique metric visualizations to each FeatureCard in the Character Blueprint Feature Map tab.
Each card's children slot gets a micro-visualization:
- Class Hierarchy: "{types} types / {classes} classes" side by side numbers
- Properties: Stacked mini bars (HP, Speed, Armor ranges, 60px wide)
- Scaling: Sparkline SVG (60×20px) showing first 10 curve points
- Hitbox: "{zones} zones" with colored dots (hurtbox=red, hitbox=blue, pushbox=green)
- Camera: Three compact stats "FOV | Arm | Lag" in mono font
- Bindings: Colored ratio bar "{bound}/{total}" with NeonBar
- Keyboard: "{conflicts}" count — green if 0, red if >0
- States: "{count} states" with mini icon
- Dodge: "{distance}m" bold number
- Curve Editor: Tiny sparkline of feel curve
- Optimizer: Preset name or "No preset" muted
- Comparison: "{dupes} duplicates" — red if >0
- Balance: Mini radar thumbnail (40×40px SVG)
All metrics derive from existing data in CharacterBlueprint/data.ts.
Create metric components in CharacterBlueprint/metrics/ directory.`,
    [
      'Comparison duplicate detector metric',
      'Balance mini-radar metric',
      'All metrics integrated into FeatureMapTab',
    ],
    ['ui-character-feature-metrics-b'],
  ),

  area(
    'ui-animation-feature-metrics-a',
    'Animation State Graph Feature Metrics (Part 1)',
    `Add unique metric visualizations to Animation State Graph Feature Map.
- States: "{n} states / {g} groups"
- Transitions: "{n} edges" with mini directed-graph icon
- Heatmap: Micro heatmap grid (4×4, 20px)
- Chain: "{n} combos / depth {d}"
- Montages: "{n} montages"
- Scrubber: "{n} notifies"
- Skeleton: "{mapped}/{total}" bone mapping bar
- Trajectories: "{n} root motion curves"
- Assets: "{size}MB" estimated memory
- Playrate: "{min}–{max}x" range
Derive from AnimationStateGraph/data.ts. Create metrics/ subdirectory.`,
    [
      'States/groups count metric',
      'Transitions edge count metric',
      'Micro heatmap metric',
      'Combo chain depth metric',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-animation-feature-metrics-b',
    'Animation State Graph Feature Metrics (Part 2)',
    `Add unique metric visualizations to Animation State Graph Feature Map.
- States: "{n} states / {g} groups"
- Transitions: "{n} edges" with mini directed-graph icon
- Heatmap: Micro heatmap grid (4×4, 20px)
- Chain: "{n} combos / depth {d}"
- Montages: "{n} montages"
- Scrubber: "{n} notifies"
- Skeleton: "{mapped}/{total}" bone mapping bar
- Trajectories: "{n} root motion curves"
- Assets: "{size}MB" estimated memory
- Playrate: "{min}–{max}x" range
Derive from AnimationStateGraph/data.ts. Create metrics/ subdirectory.`,
    [
      'Montage count metric',
      'Bone mapping bar metric',
      'Memory estimate metric',
      'All metrics integrated',
    ],
    ['ui-animation-feature-metrics-a'],
  ),

  area(
    'ui-gas-feature-metrics-a',
    'Ability Spellbook Feature Metrics (Part 1)',
    `Add unique metric visualizations to Ability Spellbook Feature Map.
- Architecture: "ASC → {n} GA → {n} GE" pipeline count
- Radar: Mini radar (40px) with 3-ability overlay
- Cooldowns: "{avg}s avg / {min}–{max}s range"
- Timeline: Micro timeline strip (60px)
- Effects Timeline: "{n} active / {n} passive"
- Tags: "{n} tags / {depth} depth"
- Hierarchy: "{n} roots / {n} leaves"
- Audit: "{n} warnings" — green if 0, red if >0
- Dependencies: "{n} deps / {n} circular" — red if circular >0
Derive from AbilitySpellbook/data.ts.`,
    [
      'Architecture pipeline metric',
      'Mini radar metric',
      'Cooldown stats metric',
      'Effect type split metric',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-gas-feature-metrics-b',
    'Ability Spellbook Feature Metrics (Part 2)',
    `Add unique metric visualizations to Ability Spellbook Feature Map.
- Architecture: "ASC → {n} GA → {n} GE" pipeline count
- Radar: Mini radar (40px) with 3-ability overlay
- Cooldowns: "{avg}s avg / {min}–{max}s range"
- Timeline: Micro timeline strip (60px)
- Effects Timeline: "{n} active / {n} passive"
- Tags: "{n} tags / {depth} depth"
- Hierarchy: "{n} roots / {n} leaves"
- Audit: "{n} warnings" — green if 0, red if >0
- Dependencies: "{n} deps / {n} circular" — red if circular >0
Derive from AbilitySpellbook/data.ts.`,
    [
      'Tag tree stats metric',
      'Audit warning counter metric',
      'Dependency circular detector metric',
      'All metrics integrated',
    ],
    ['ui-gas-feature-metrics-a'],
  ),

  area(
    'ui-combat-feature-metrics-a',
    'Combat Action Map Feature Metrics (Part 1)',
    `Add unique metric visualizations to Combat Action Map Feature Map.
- Lanes: "{n} lanes / {n} actions"
- Sequences: "{n} events / {n} systems"
- Traces: "{sphere} sphere / {capsule} capsule"
- Stats: "{avg} avg DPS" bold
- Feedback Tuner: "{tuned}/{total}" params bar
- DPS: Mini bar chart (3 bars for top abilities)
- Effectiveness: "{best}" top ability name
- Sankey: "{flows} flows"
- KPIs: Traffic light (3 dots for TTK, DPS, APM)
Derive from CombatActionMap/data-metrics.ts.`,
    [
      'Lane and action count metric',
      'Sequence event count metric',
      'Trace type count metric',
      'Feedback tuner progress bar',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-combat-feature-metrics-b',
    'Combat Action Map Feature Metrics (Part 2)',
    `Add unique metric visualizations to Combat Action Map Feature Map.
- Lanes: "{n} lanes / {n} actions"
- Sequences: "{n} events / {n} systems"
- Traces: "{sphere} sphere / {capsule} capsule"
- Stats: "{avg} avg DPS" bold
- Feedback Tuner: "{tuned}/{total}" params bar
- DPS: Mini bar chart (3 bars for top abilities)
- Effectiveness: "{best}" top ability name
- Sankey: "{flows} flows"
- KPIs: Traffic light (3 dots for TTK, DPS, APM)
Derive from CombatActionMap/data-metrics.ts.`,
    [
      'Mini DPS bar chart',
      'KPI traffic light metric',
      'All metrics integrated',
    ],
    ['ui-combat-feature-metrics-a'],
  ),

  area(
    'ui-bestiary-feature-metrics-a',
    'Enemy Bestiary Feature Metrics (Part 1)',
    `Add unique metric visualizations to Enemy Bestiary Feature Map.
- Cards: "{n} archetypes" with role pie (melee/ranged/tank/support micro-donut)
- Modifiers: "{n} modifiers / {n} exclusions"
- Radar: Mini radar comparing weakest vs strongest enemy
- Behavior Tree: "{n} nodes / {d} depth"
- Decision Log: "{n} decisions/sec" throughput
- Aggro: "{n} threat sources"
- Formations: "{n} formations" with mini dot-pattern
- Waves: "{n} waves / {total} enemies"
- Difficulty: Sparkline of difficulty curve
Derive from EnemyBestiary/data.ts.`,
    [
      'Archetype count with role pie metric',
      'Modifier count metric',
      'Min/max radar metric',
      'BT node count metric',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-bestiary-feature-metrics-b',
    'Enemy Bestiary Feature Metrics (Part 2)',
    `Add unique metric visualizations to Enemy Bestiary Feature Map.
- Cards: "{n} archetypes" with role pie (melee/ranged/tank/support micro-donut)
- Modifiers: "{n} modifiers / {n} exclusions"
- Radar: Mini radar comparing weakest vs strongest enemy
- Behavior Tree: "{n} nodes / {d} depth"
- Decision Log: "{n} decisions/sec" throughput
- Aggro: "{n} threat sources"
- Formations: "{n} formations" with mini dot-pattern
- Waves: "{n} waves / {total} enemies"
- Difficulty: Sparkline of difficulty curve
Derive from EnemyBestiary/data.ts.`,
    [
      'Formation dot-pattern metric',
      'Wave summary metric',
      'Difficulty sparkline metric',
      'All metrics integrated',
    ],
    ['ui-bestiary-feature-metrics-a'],
  ),

  area(
    'ui-items-feature-metrics-a',
    'Item Catalog Feature Metrics (Part 1)',
    `Add unique metric visualizations to Item Catalog Feature Map.
- Grid: "{n} items / {slots} slots"
- Sets: "{n} sets / {bonuses} bonuses"
- Loadout: "{equipped}/{slots}" fill bar
- Sources: "{n} source types"
- Scaling: Sparkline item power vs level
- Stats: "{avg} avg ilvl"
- Power: "{min}–{max}" power range bar
Derive from ItemCatalog/data.ts.`,
    [
      'Item/slot count metric',
      'Set bonus count metric',
      'Loadout fill bar metric',
      'Source type count metric',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-items-feature-metrics-b',
    'Item Catalog Feature Metrics (Part 2)',
    `Add unique metric visualizations to Item Catalog Feature Map.
- Grid: "{n} items / {slots} slots"
- Sets: "{n} sets / {bonuses} bonuses"
- Loadout: "{equipped}/{slots}" fill bar
- Sources: "{n} source types"
- Scaling: Sparkline item power vs level
- Stats: "{avg} avg ilvl"
- Power: "{min}–{max}" power range bar
Derive from ItemCatalog/data.ts.`,
    [
      'Scaling sparkline metric',
      'Power range bar metric',
      'All metrics integrated',
    ],
    ['ui-items-feature-metrics-a'],
  ),

  area(
    'ui-loot-feature-metrics-a',
    'Loot Table Feature Metrics (Part 1)',
    `Add unique metric visualizations to Loot Table Visualizer Feature Map.
- Pipeline: "{stages} stages" flow
- Weights: Mini pie showing rarity distribution
- World Items: "{n} world items"
- Treemap: Micro treemap thumbnail (40×30px)
- Histogram: "{n} brackets"
- Simulator: "{n} affixes in pool"
- Co-occurrence: "{conflicts}" hot cell count
- Timer: "{threshold} pulls" pity
- Drought: "{prob}%" probability
- Beacon: "{n} beacons"
- Impact: "{gold}/hr" rate
Derive from LootTableVisualizer/data.ts.`,
    [
      'Pipeline stage count metric',
      'Rarity mini pie metric',
      'Micro treemap metric',
      'Affix pool count metric',
    ],
    ['infra-feature-cards-a'],
  ),

  area(
    'ui-loot-feature-metrics-b',
    'Loot Table Feature Metrics (Part 2)',
    `Add unique metric visualizations to Loot Table Visualizer Feature Map.
- Pipeline: "{stages} stages" flow
- Weights: Mini pie showing rarity distribution
- World Items: "{n} world items"
- Treemap: Micro treemap thumbnail (40×30px)
- Histogram: "{n} brackets"
- Simulator: "{n} affixes in pool"
- Co-occurrence: "{conflicts}" hot cell count
- Timer: "{threshold} pulls" pity
- Drought: "{prob}%" probability
- Beacon: "{n} beacons"
- Impact: "{gold}/hr" rate
Derive from LootTableVisualizer/data.ts.`,
    [
      'Pity threshold metric',
      'Economy rate metric',
      'All metrics integrated',
    ],
    ['ui-loot-feature-metrics-a'],
  ),
];

/* ── Phase 2: Scaling ───────────────────────────────────────────────────────── */

const PHASE_2: ModuleArea[] = [
  area(
    'ui-character-scaling-a',
    'Character Blueprint Scaling (Part 1)',
    `Upgrade Character Blueprint to handle 100+ characters.
1. Expand data.ts: Add 50+ characters with EntityMetadata (categories: Warrior, Mage, Rogue, Tank, Support, Beast, Droid, Force-user; areas: Taris, Dantooine, Kashyyyk, Korriban, Manaan; tiers: common, elite, boss, legendary).
2. Comparison tab: Replace inline character list with ScalableSelector modal. Default shows 2 selected. "Add Character" button opens selector grouped by class→role.
3. Overview tab: Add character picker (single-select ScalableSelector grouped by area).
4. Camera Profiles: Support comparing 3+ profiles via multi-select.
5. Balance Radar: Handle 10+ overlay by showing top-5 + "show all" toggle.`,
    [
      'Data expanded to 50+ characters with metadata',
      'Comparison uses ScalableSelector modal',
      'Overview has character picker',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-character-scaling-b',
    'Character Blueprint Scaling (Part 2)',
    `Upgrade Character Blueprint to handle 100+ characters.
1. Expand data.ts: Add 50+ characters with EntityMetadata (categories: Warrior, Mage, Rogue, Tank, Support, Beast, Droid, Force-user; areas: Taris, Dantooine, Kashyyyk, Korriban, Manaan; tiers: common, elite, boss, legendary).
2. Comparison tab: Replace inline character list with ScalableSelector modal. Default shows 2 selected. "Add Character" button opens selector grouped by class→role.
3. Overview tab: Add character picker (single-select ScalableSelector grouped by area).
4. Camera Profiles: Support comparing 3+ profiles via multi-select.
5. Balance Radar: Handle 10+ overlay by showing top-5 + "show all" toggle.`,
    [
      'Camera supports 3+ profile comparison',
      'Balance radar handles 10+ characters',
      '100 characters render without lag',
    ],
    ['ui-character-scaling-a'],
  ),

  area(
    'ui-animation-scaling-a',
    'Animation State Graph Scaling (Part 1)',
    `Upgrade Animation State Graph to handle 100+ montages.
1. Expand data.ts: Add 80+ montages with metadata (categories: Attack, Dodge, HitReact, Death, Idle, Locomotion, Ability, Emote).
2. Combo Chain: Add montage picker via ScalableSelector grouped by category. Paginate 10/page.
3. State Machine: Support 30+ states by clustering into collapsible groups.
4. Frame Scrubber: Montage selector dropdown (grouped by category).
5. Budget: Virtual-scroll asset list. Group by category. Per-group memory subtotals.`,
    [
      'Data expanded to 80+ montages with metadata',
      'Combo chain uses ScalableSelector',
      'State machine clusters into collapsible groups',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-animation-scaling-b',
    'Animation State Graph Scaling (Part 2)',
    `Upgrade Animation State Graph to handle 100+ montages.
1. Expand data.ts: Add 80+ montages with metadata (categories: Attack, Dodge, HitReact, Death, Idle, Locomotion, Ability, Emote).
2. Combo Chain: Add montage picker via ScalableSelector grouped by category. Paginate 10/page.
3. State Machine: Support 30+ states by clustering into collapsible groups.
4. Frame Scrubber: Montage selector dropdown (grouped by category).
5. Budget: Virtual-scroll asset list. Group by category. Per-group memory subtotals.`,
    [
      'Frame scrubber has grouped montage selector',
      'Budget asset list virtual-scrolls',
      '100 montages render without lag',
    ],
    ['ui-animation-scaling-a'],
  ),

  area(
    'ui-gas-scaling-a',
    'Ability Spellbook Scaling (Part 1)',
    `Upgrade Ability Spellbook to handle 100+ abilities.
1. Expand data.ts: Add 60+ abilities with metadata (categories: Offensive, Defensive, Utility, Passive, Ultimate; elements: Fire, Ice, Lightning, Shadow, Holy; tiers: basic, advanced, ultimate).
2. Ability Radar: ScalableSelector to pick 3-6 abilities for comparison. Group by category→element.
3. Effects List: Paginate gameplay effects. Group by type (Instant, Duration, Periodic, Infinite).
4. Tag Tree: Lazy expansion — only first level by default. Search filter for tag names.
5. Core: Attribute picker for 20+ attributes.`,
    [
      'Data expanded to 60+ abilities with metadata',
      'Ability radar uses ScalableSelector',
      'Effects list paginated and grouped',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-gas-scaling-b',
    'Ability Spellbook Scaling (Part 2)',
    `Upgrade Ability Spellbook to handle 100+ abilities.
1. Expand data.ts: Add 60+ abilities with metadata (categories: Offensive, Defensive, Utility, Passive, Ultimate; elements: Fire, Ice, Lightning, Shadow, Holy; tiers: basic, advanced, ultimate).
2. Ability Radar: ScalableSelector to pick 3-6 abilities for comparison. Group by category→element.
3. Effects List: Paginate gameplay effects. Group by type (Instant, Duration, Periodic, Infinite).
4. Tag Tree: Lazy expansion — only first level by default. Search filter for tag names.
5. Core: Attribute picker for 20+ attributes.`,
    [
      'Tag tree lazy-expands with search',
      'Attribute picker for large lists',
      '100 abilities render without lag',
    ],
    ['ui-gas-scaling-a'],
  ),

  area(
    'ui-combat-scaling-a',
    'Combat Action Map Scaling (Part 1)',
    `Upgrade Combat Action Map to handle 100+ weapons/combos.
1. Expand data.ts: Add 40+ weapons with metadata (categories: Sword, Axe, Mace, Bow, Staff, Dagger, Polearm; tiers: common-legendary). Add 30+ combo sequences.
2. Flow: Weapon selector to filter lanes. ScalableSelector grouped by category.
3. Hits: Filter traces by weapon. Per-weapon hit stats.
4. Metrics: Select 2-4 weapons for DPS comparison.
5. Combo Chains: Paginate combos. Group by weapon type.`,
    [
      'Data expanded to 40+ weapons with metadata',
      'Flow tab has weapon ScalableSelector',
      'Hits tab filters by weapon',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-combat-scaling-b',
    'Combat Action Map Scaling (Part 2)',
    `Upgrade Combat Action Map to handle 100+ weapons/combos.
1. Expand data.ts: Add 40+ weapons with metadata (categories: Sword, Axe, Mace, Bow, Staff, Dagger, Polearm; tiers: common-legendary). Add 30+ combo sequences.
2. Flow: Weapon selector to filter lanes. ScalableSelector grouped by category.
3. Hits: Filter traces by weapon. Per-weapon hit stats.
4. Metrics: Select 2-4 weapons for DPS comparison.
5. Combo Chains: Paginate combos. Group by weapon type.`,
    [
      'Metrics compares 2-4 weapons',
      'Combo chains paginated and grouped',
      '100 weapons render without lag',
    ],
    ['ui-combat-scaling-a'],
  ),

  area(
    'ui-bestiary-scaling-a',
    'Enemy Bestiary Scaling (Part 1)',
    `Upgrade Enemy Bestiary to handle 100+ enemies.
1. Expand data.ts: Add 80+ archetypes with metadata (categories: Humanoid, Beast, Droid, Force-sensitive, Undead; areas: all zones; tiers: minion/standard/elite/boss/raid-boss; roles: melee/ranged/tank/healer/caster/swarm).
2. Archetype Grid: Paginated grid. Group by area→role. ScalableSelector for comparison picks.
3. Comparison: Multi-select up to 4 enemies. Radar overlay.
4. Encounters: Enemy picker via ScalableSelector grouped by area→tier. Wave editor handles 20+ waves with virtual scroll.
5. AI Logic: BT viewer supports 50+ nodes with collapsible subtrees and search.`,
    [
      'Data expanded to 80+ enemies with metadata',
      'Archetype grid paginated and grouped',
      'Comparison multi-select with ScalableSelector',
      'Encounter enemy picker uses ScalableSelector',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-bestiary-scaling-b',
    'Enemy Bestiary Scaling (Part 2)',
    `Upgrade Enemy Bestiary to handle 100+ enemies.
1. Expand data.ts: Add 80+ archetypes with metadata (categories: Humanoid, Beast, Droid, Force-sensitive, Undead; areas: all zones; tiers: minion/standard/elite/boss/raid-boss; roles: melee/ranged/tank/healer/caster/swarm).
2. Archetype Grid: Paginated grid. Group by area→role. ScalableSelector for comparison picks.
3. Comparison: Multi-select up to 4 enemies. Radar overlay.
4. Encounters: Enemy picker via ScalableSelector grouped by area→tier. Wave editor handles 20+ waves with virtual scroll.
5. AI Logic: BT viewer supports 50+ nodes with collapsible subtrees and search.`,
    [
      'Wave editor virtual-scrolls 20+ waves',
      'BT viewer collapses 50+ nodes',
      '100 enemies render without lag',
    ],
    ['ui-bestiary-scaling-a'],
  ),

  area(
    'ui-items-scaling-a',
    'Item Catalog Scaling (Part 1)',
    `Upgrade Item Catalog to handle 100+ items.
1. Expand data.ts: Add 120+ items with metadata (categories: Weapon/Armor/Accessory/Consumable/Quest/Material; subcategories per type; tiers: common-legendary; sets).
2. Catalog Grid: Paginated 20/page. Filter by category, tier, slot. Sort by name/power/tier. ScalableSelector for comparison.
3. Equipment Loadout: Item picker per slot using ScalableSelector filtered to slot type.
4. Item Sets: Collapsible set panels. Filter complete/incomplete.
5. Comparison: Side-by-side 2-3 items with stat diff highlighting.`,
    [
      'Data expanded to 120+ items with metadata',
      'Catalog grid paginated with filters',
      'Equipment loadout slot pickers',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-items-scaling-b',
    'Item Catalog Scaling (Part 2)',
    `Upgrade Item Catalog to handle 100+ items.
1. Expand data.ts: Add 120+ items with metadata (categories: Weapon/Armor/Accessory/Consumable/Quest/Material; subcategories per type; tiers: common-legendary; sets).
2. Catalog Grid: Paginated 20/page. Filter by category, tier, slot. Sort by name/power/tier. ScalableSelector for comparison.
3. Equipment Loadout: Item picker per slot using ScalableSelector filtered to slot type.
4. Item Sets: Collapsible set panels. Filter complete/incomplete.
5. Comparison: Side-by-side 2-3 items with stat diff highlighting.`,
    [
      'Item set panels collapsible and filterable',
      'Item comparison with stat diff highlighting',
      '100 items render without lag',
    ],
    ['ui-items-scaling-a'],
  ),

  area(
    'ui-loot-scaling-a',
    'Loot Table Visualizer Scaling (Part 1)',
    `Upgrade Loot Table Visualizer to handle 100+ entries.
1. Expand data.ts: Add 60+ loot table entries, 30+ affixes, 20+ enemy bindings.
2. Loot Table Editor: Paginated with search. Group by source (enemy/chest/quest/crafting). Inline weight editing.
3. Affix Simulator: Affix pool picker via ScalableSelector grouped by Offensive/Defensive/Utility.
4. Drop Simulator: Enemy picker for simulation using ScalableSelector.
5. Economy Impact: Filter by tier/source. Paginated impact table.`,
    [
      'Data expanded to 60+ loot entries',
      'Loot table editor paginated and grouped',
      'Affix pool uses ScalableSelector',
    ],
    ['infra-entity-selector-a', 'infra-metadata-schema-a'],
  ),

  area(
    'ui-loot-scaling-b',
    'Loot Table Visualizer Scaling (Part 2)',
    `Upgrade Loot Table Visualizer to handle 100+ entries.
1. Expand data.ts: Add 60+ loot table entries, 30+ affixes, 20+ enemy bindings.
2. Loot Table Editor: Paginated with search. Group by source (enemy/chest/quest/crafting). Inline weight editing.
3. Affix Simulator: Affix pool picker via ScalableSelector grouped by Offensive/Defensive/Utility.
4. Drop Simulator: Enemy picker for simulation using ScalableSelector.
5. Economy Impact: Filter by tier/source. Paginated impact table.`,
    [
      'Drop simulator has enemy ScalableSelector',
      'Economy table paginated and filterable',
      '100 loot entries render without lag',
    ],
    ['ui-loot-scaling-a'],
  ),
];

/* ── Phase 3: Flow Redesign ─────────────────────────────────────────────────── */

const PHASE_3: ModuleArea[] = [
  area(
    'ui-character-flow',
    'Character Blueprint Flow Redesign',
    `Restructure Character Blueprint tabs to tell a chronological narrative.
New tab order: Features → Overview → Input → Movement → Playground → AI Feel → Simulator.
Narrative: "Define → Control → Move → Feel → Optimize → Compare".
Add a subtle breadcrumb bar at top of the unique tab showing the narrative flow with styled steps.
Each tab header gets a one-line subtitle explaining its role in the pipeline.
Reorder the subtab array and update the navigation. Do not change component internals.`,
    [
      'Tab order restructured to narrative flow',
      'Breadcrumb bar with flow visualization',
      'Tab subtitles added',
      'Navigation updated',
    ],
    ['ui-character-scaling-b'],
  ),

  area(
    'ui-animation-flow',
    'Animation State Graph Flow Redesign',
    `Restructure Animation tabs: Features → State Graph → Combos → Retargeting → Budget.
Narrative: "Define States → Chain Actions → Port Across Skeletons → Budget Check".
Add breadcrumb flow bar. Add tab subtitles.`,
    [
      'Tab order restructured',
      'Breadcrumb flow bar added',
      'Tab subtitles added',
    ],
    ['ui-animation-scaling-b'],
  ),

  area(
    'ui-gas-flow',
    'Ability Spellbook Flow Redesign',
    `Restructure Ability tabs: Features → Core → Abilities → Effects → Tags → Combos.
Narrative: "Foundation → Define Abilities → Apply Effects → Organize Tags → Chain Combos".
Add breadcrumb flow bar. Add tab subtitles.`,
    [
      'Tab order restructured',
      'Breadcrumb flow bar added',
      'Tab subtitles added',
    ],
    ['ui-gas-scaling-b'],
  ),

  area(
    'ui-combat-flow',
    'Combat Action Map Flow Redesign',
    `Restructure Combat tabs: Features → Flow → Hits → Metrics → Polish.
Narrative: "Pipeline → Hit Detection → Measure Balance → Polish Feel".
Add breadcrumb flow bar. Add tab subtitles.`,
    [
      'Tab order restructured',
      'Breadcrumb flow bar added',
      'Tab subtitles added',
    ],
    ['ui-combat-scaling-b'],
  ),

  area(
    'ui-bestiary-flow',
    'Enemy Bestiary Flow Redesign',
    `Restructure Bestiary tabs: Features → Archetypes → AI Logic → Encounters.
Narrative: "Define Enemies → Give Them Brains → Place in World".
Add breadcrumb flow bar. Add tab subtitles.`,
    [
      'Tab order restructured',
      'Breadcrumb flow bar added',
      'Tab subtitles added',
    ],
    ['ui-bestiary-scaling-b'],
  ),

  area(
    'ui-items-flow',
    'Item Catalog Flow Redesign',
    `Restructure Item tabs: Features → Catalog → Economy → Mechanics.
Narrative: "Browse Items → Track Economy → Understand Scaling".
Add breadcrumb flow bar. Add tab subtitles.`,
    [
      'Tab order restructured',
      'Breadcrumb flow bar added',
      'Tab subtitles added',
    ],
    ['ui-items-scaling-b'],
  ),

  area(
    'ui-loot-flow',
    'Loot Table Flow Redesign',
    `Restructure Loot tabs: Features → Core → Simulation → Affix → Pity → Economy.
Narrative: "Define Drops → Simulate → Roll Affixes → Ensure Fairness → Economy".
Add breadcrumb flow bar. Add tab subtitles.`,
    [
      'Tab order restructured',
      'Breadcrumb flow bar added',
      'Tab subtitles added',
    ],
    ['ui-loot-scaling-b'],
  ),
];

/* ── Phase 4: Visual Polish ─────────────────────────────────────────────────── */

const PHASE_4: ModuleArea[] = [
  area(
    'ui-character-visual-a',
    'Character Blueprint Visual Polish (Part 1)',
    `Visual upgrade for Character Blueprint components.
1. Comparison Matrix: Card-based columns per character. Stat bars with diff highlighting.
2. Hitbox Viewer: Layered wireframe SVG with zone coloring and glow. Hover to highlight zones.
3. Camera Profiles: Visual viewport mockups showing FOV cone, arm length, lag zone.
4. Movement States: State-machine SVG diagram with animated transition arrows.
5. Properties: Collapsible categories with colored headers.
6. Keyboard: Proper key sizing, accent glow on bound keys, red pulse on conflicts.
Follow design directive for all styling decisions.`,
    [
      'Comparison matrix card-based columns',
      'Hitbox wireframe SVG with glow',
      'Camera viewport mockups',
    ],
    ['ui-character-flow'],
  ),

  area(
    'ui-character-visual-b',
    'Character Blueprint Visual Polish (Part 2)',
    `Visual upgrade for Character Blueprint components.
1. Comparison Matrix: Card-based columns per character. Stat bars with diff highlighting.
2. Hitbox Viewer: Layered wireframe SVG with zone coloring and glow. Hover to highlight zones.
3. Camera Profiles: Visual viewport mockups showing FOV cone, arm length, lag zone.
4. Movement States: State-machine SVG diagram with animated transition arrows.
5. Properties: Collapsible categories with colored headers.
6. Keyboard: Proper key sizing, accent glow on bound keys, red pulse on conflicts.
Follow design directive for all styling decisions.`,
    [
      'Movement state-machine SVG',
      'Properties collapsible categories',
      'Keyboard enhanced visualization',
    ],
    ['ui-character-visual-a'],
  ),

  area(
    'ui-animation-visual',
    'Animation State Graph Visual Polish',
    `Visual upgrade for Animation State Graph.
1. State Machine: Full SVG node graph — rounded rects, animated transition arrows, glow on active, group backgrounds.
2. Combo Timeline: Horizontal with hit windows (colored), cancel windows (hatched), damage numbers, scrub handle.
3. Blend Space: 2D scatter with blend triangle.
4. Budget: Horizontal stacked bar chart showing memory per category.`,
    [
      'State machine SVG node graph',
      'Combo timeline with hit/cancel windows',
      'Blend space 2D scatter',
      'Budget stacked bar chart',
    ],
    ['ui-animation-flow'],
  ),

  area(
    'ui-gas-visual-a',
    'Ability Spellbook Visual Polish (Part 1)',
    `Visual upgrade for Ability Spellbook.
1. Ability Cards: Rich cards — icon circle with initial, cooldown badge, element dot, mini cost bar.
2. Effect Timeline: Gantt-style chart with durations, stacking, decay. Color by effect type.
3. Tag Tree: Interactive tree with expand/collapse, search highlight, SVG relationship curves.
4. Attribute Web: Interactive force-directed graph. Drag nodes. Hover shows relationship details.
5. Damage Calculator: Visual formula breakdown (Base × Mult + Flat → Armor → Final).`,
    [
      'Rich ability cards',
      'Gantt-style effect timeline',
      'Interactive tag tree with search',
    ],
    ['ui-gas-flow'],
  ),

  area(
    'ui-gas-visual-b',
    'Ability Spellbook Visual Polish (Part 2)',
    `Visual upgrade for Ability Spellbook.
1. Ability Cards: Rich cards — icon circle with initial, cooldown badge, element dot, mini cost bar.
2. Effect Timeline: Gantt-style chart with durations, stacking, decay. Color by effect type.
3. Tag Tree: Interactive tree with expand/collapse, search highlight, SVG relationship curves.
4. Attribute Web: Interactive force-directed graph. Drag nodes. Hover shows relationship details.
5. Damage Calculator: Visual formula breakdown (Base × Mult + Flat → Armor → Final).`,
    [
      'Force-directed attribute web',
      'Visual damage calculator formula',
    ],
    ['ui-gas-visual-a'],
  ),

  area(
    'ui-combat-visual-a',
    'Combat Action Map Visual Polish (Part 1)',
    `Visual upgrade for Combat Action Map.
1. Action Lanes: Swim-lane diagram with horizontal flows and inter-lane arrows.
2. Sequence Diagram: UML-style — vertical lifelines, horizontal arrows, activation boxes.
3. Feedback Tuner: Slider-based editor with grouped categories (Shake, Hitstop, Particles, Sound).
4. Sankey: Full Sankey flow viz with proportional widths.
5. DPS Chart: Grouped bar chart with weapon comparison. Hover for breakdown.`,
    [
      'Swim-lane action diagram',
      'UML sequence diagram',
      'Slider-based feedback tuner',
    ],
    ['ui-combat-flow'],
  ),

  area(
    'ui-combat-visual-b',
    'Combat Action Map Visual Polish (Part 2)',
    `Visual upgrade for Combat Action Map.
1. Action Lanes: Swim-lane diagram with horizontal flows and inter-lane arrows.
2. Sequence Diagram: UML-style — vertical lifelines, horizontal arrows, activation boxes.
3. Feedback Tuner: Slider-based editor with grouped categories (Shake, Hitstop, Particles, Sound).
4. Sankey: Full Sankey flow viz with proportional widths.
5. DPS Chart: Grouped bar chart with weapon comparison. Hover for breakdown.`,
    [
      'Sankey flow visualization',
      'Grouped DPS bar chart',
    ],
    ['ui-combat-visual-a'],
  ),

  area(
    'ui-bestiary-visual',
    'Enemy Bestiary Visual Polish',
    `Visual upgrade for Enemy Bestiary.
1. Archetype Cards: Role icon, tier glow border (gray/purple/orange/gold), stat bars with avg markers, modifier pills.
2. Behavior Tree: Full diagram — diamond selectors, rect sequences, rounded tasks, hex decorators. Color by status. Collapsible.
3. Formation Viz: Top-down dot formation with role-colored dots.
4. Difficulty Curve: Line chart with shaded danger zones (too easy/target/too hard).`,
    [
      'Enhanced archetype cards with tier glow',
      'Behavior tree diagram with node types',
      'Formation dot visualization',
      'Difficulty curve with danger zones',
    ],
    ['ui-bestiary-flow'],
  ),

  area(
    'ui-items-visual-a',
    'Item Catalog Visual Polish (Part 1)',
    `Visual upgrade for Item Catalog.
1. Item Cards: RPG-style — rarity border glow, slot icon, power badge, stat list with +/- coloring, set indicator.
2. Equipment Loadout: Paper-doll slot layout (silhouette with positions). Click opens ScalableSelector for slot type.
3. Affix Sunburst: Enhanced with tooltips, smooth transitions, tier-colored rings.
4. Scaling Chart: Multi-line with rarity-colored curves, hover values, confidence bands.
5. Economy Flow: Sankey showing sources → player → sinks.`,
    [
      'RPG-style item cards with rarity glow',
      'Paper-doll equipment layout',
      'Enhanced affix sunburst',
    ],
    ['ui-items-flow'],
  ),

  area(
    'ui-items-visual-b',
    'Item Catalog Visual Polish (Part 2)',
    `Visual upgrade for Item Catalog.
1. Item Cards: RPG-style — rarity border glow, slot icon, power badge, stat list with +/- coloring, set indicator.
2. Equipment Loadout: Paper-doll slot layout (silhouette with positions). Click opens ScalableSelector for slot type.
3. Affix Sunburst: Enhanced with tooltips, smooth transitions, tier-colored rings.
4. Scaling Chart: Multi-line with rarity-colored curves, hover values, confidence bands.
5. Economy Flow: Sankey showing sources → player → sinks.`,
    [
      'Multi-line scaling chart',
      'Economy Sankey flow',
    ],
    ['ui-items-visual-a'],
  ),

  area(
    'ui-loot-visual-a',
    'Loot Table Visual Polish (Part 1)',
    `Visual upgrade for Loot Table Visualizer.
1. Weight Distribution: Donut chart with interactive segments and drill-down. Rarity-colored with glow.
2. Drop Treemap: Proper nested rectangles. Rarity-colored. Size = probability. Hover for details.
3. Monte Carlo: Histogram with distribution curve overlay. Mean/median/stddev vertical lines.
4. Pity Timer: Circular gauge with animated fill and threshold marker.
5. Co-occurrence: Heatmap with color scale legend. Cell hover shows frequency and conflict flag.
6. Economy Dashboard: KPI cards at top (gold/hr, items/hr, rarity dist), charts below.`,
    [
      'Interactive donut chart',
      'Nested treemap visualization',
      'Monte Carlo histogram with overlay',
    ],
    ['ui-loot-flow'],
  ),

  area(
    'ui-loot-visual-b',
    'Loot Table Visual Polish (Part 2)',
    `Visual upgrade for Loot Table Visualizer.
1. Weight Distribution: Donut chart with interactive segments and drill-down. Rarity-colored with glow.
2. Drop Treemap: Proper nested rectangles. Rarity-colored. Size = probability. Hover for details.
3. Monte Carlo: Histogram with distribution curve overlay. Mean/median/stddev vertical lines.
4. Pity Timer: Circular gauge with animated fill and threshold marker.
5. Co-occurrence: Heatmap with color scale legend. Cell hover shows frequency and conflict flag.
6. Economy Dashboard: KPI cards at top (gold/hr, items/hr, rarity dist), charts below.`,
    [
      'Circular pity gauge',
      'Enhanced co-occurrence heatmap',
      'Economy KPI dashboard layout',
    ],
    ['ui-loot-visual-a'],
  ),
];

/* ── Phase 5: Integration ───────────────────────────────────────────────────── */

const PHASE_5: ModuleArea[] = [
  area(
    'ui-style-audit-a',
    'Cross-Module Style Audit (Part 1)',
    `Verify visual consistency across all 7 modules.
1. Grep for hardcoded colors, inconsistent spacing, non-standard fonts.
2. Verify same card/header/stat style everywhere.
3. Check tab nav looks identical across modules.
4. Verify ScalableSelector renders consistently.
5. Check Feature Map card sizing across modules.
6. Run contrast check on all text/bg combinations (WCAG AA 4.5:1).
7. Fix all deviations found.`,
    [
      'No hardcoded colors remain',
      'Consistent card and header styles',
      'Tab navigation identical across modules',
    ],
    [
      'ui-character-visual-b', 'ui-animation-visual', 'ui-gas-visual-b',
      'ui-combat-visual-b', 'ui-bestiary-visual', 'ui-items-visual-b', 'ui-loot-visual-b',
    ],
  ),

  area(
    'ui-style-audit-b',
    'Cross-Module Style Audit (Part 2)',
    `Verify visual consistency across all 7 modules.
1. Grep for hardcoded colors, inconsistent spacing, non-standard fonts.
2. Verify same card/header/stat style everywhere.
3. Check tab nav looks identical across modules.
4. Verify ScalableSelector renders consistently.
5. Check Feature Map card sizing across modules.
6. Run contrast check on all text/bg combinations (WCAG AA 4.5:1).
7. Fix all deviations found.`,
    [
      'ScalableSelector consistent',
      'Feature Map cards uniform sizing',
      'WCAG AA contrast verified',
    ],
    ['ui-style-audit-a'],
  ),

  area(
    'ui-responsive-audit-a',
    'Responsive & Performance Audit (Part 1)',
    `Verify responsive behavior and performance.
1. Test at 1280px, 1440px, 1920px widths.
2. Verify card grids reflow (2→3→4 cols).
3. Check virtual scroll perf with 200+ items.
4. No layout shifts on feature toggle.
5. 100+ items render without jank.
6. Add React.memo where needed.
7. Modal overlays no body scroll lock issues.`,
    [
      'Responsive at 1280/1440/1920px',
      'Grid reflow verified',
      'Virtual scroll perf verified',
    ],
    ['ui-style-audit-b'],
  ),

  area(
    'ui-responsive-audit-b',
    'Responsive & Performance Audit (Part 2)',
    `Verify responsive behavior and performance.
1. Test at 1280px, 1440px, 1920px widths.
2. Verify card grids reflow (2→3→4 cols).
3. Check virtual scroll perf with 200+ items.
4. No layout shifts on feature toggle.
5. 100+ items render without jank.
6. Add React.memo where needed.
7. Modal overlays no body scroll lock issues.`,
    [
      'No layout shifts',
      'No render jank with 100+ items',
      'React.memo applied where needed',
    ],
    ['ui-responsive-audit-a'],
  ),
];

/* ── Public Exports ─────────────────────────────────────────────────────────── */

/** All UI overhaul areas in dependency order. */
export const UI_OVERHAUL_AREAS: ModuleArea[] = [
  ...PHASE_0,
  ...PHASE_1,
  ...PHASE_2,
  ...PHASE_3,
  ...PHASE_4,
  ...PHASE_5,
];

/** Area count summary by phase. */
export const UI_OVERHAUL_SUMMARY = {
  phase0_infrastructure: PHASE_0.length,
  phase1_featureMetrics: PHASE_1.length,
  phase2_scaling: PHASE_2.length,
  phase3_flow: PHASE_3.length,
  phase4_visual: PHASE_4.length,
  phase5_integration: PHASE_5.length,
  total: UI_OVERHAUL_AREAS.length,
} as const;
