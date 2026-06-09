/**
 * Content Module Overhaul Areas — harness area definitions for
 * src/components/modules/content/ UI/UX improvements.
 *
 * Content modules (animations, audio, level-design, materials, models, ui-hud)
 * are tool-focused (designers, painters, generators) rather than system-focused.
 * The overhaul focuses on:
 * 1. Visual consistency with core-engine design system
 * 2. Scaling for large asset counts (100+ animations, materials, etc.)
 * 3. Logical tab flow within each module
 * 4. Feature map integration (adding feature-map-config entries)
 *
 * Usage: --scenario content-overhaul
 */

import type { ModuleArea } from './types';
import { makeArea } from './overhaul-area-helpers';

// moduleId is informational for these cross-cutting areas.
const area = makeArea('animations');

/* ── Phase 0: Content Infrastructure ────────────────────────────────────── */

const PHASE_0: ModuleArea[] = [
  area(
    'content-feature-map-config',
    'Add Content Modules to Feature Map Config',
    `Add all 6 content modules to src/components/modules/core-engine/unique-tabs/feature-map-config.ts.
Define sections for each:
- animations: Setup (anim-bp, locomotion), Montages (attacks, notifies), Combos (choreographer, chains)
- audio: Pipeline (manager, spatial), Zones (reverb, ambient), Events (catalog, triggers)
- level-design: Layout (blockout, rooms), Streaming (zones, LOD), Procedural (pcg, generation)
- materials: Master (base, functions), Instances (dynamic, MPC), Effects (post-process, HLSL)
- models: Pipeline (import, FBX), Assets (LOD, collision), Validation (Nanite, slots)
- ui-hud: Menus (main, settings), HUD (health, abilities), Inventory (grid, slots), Polish (damage-numbers, effects)
Register with getTabGroups() so FeatureMapTab works for content modules.`,
    [
      'animations sections defined in feature-map-config',
      'audio sections defined',
      'level-design sections defined',
      'materials sections defined',
    ],
  ),

  area(
    'content-feature-map-config-b',
    'Add Content Feature Map Config (Part 2)',
    `Continue adding content modules to feature-map-config.ts:
- models sections defined
- ui-hud sections defined
Verify getTabGroups() returns correct groups for all 6 content modules.
Add FeatureMapTab as a tab in each content module's view component.`,
    [
      'models sections defined',
      'ui-hud sections defined',
      'FeatureMapTab integrated in all 6 content views',
    ],
    ['content-feature-map-config'],
  ),

  area(
    'content-design-consistency',
    'Apply Design System to Content Modules',
    `Audit all 6 content modules for design system compliance.
All content module views should use:
- BlueprintPanel from _design.tsx for card containers
- SectionHeader for section labels
- Colors from chart-colors.ts (no hardcoded hex)
- Consistent typography: mono headers, sans body, mono stats
- withOpacity() for all color manipulation
- ACCENT color from MODULE_COLORS.content for all content modules
Read each view's main component and fix design system violations.
Focus on the top-level layout and headers, not deep component internals.`,
    [
      'AnimationsView uses design system components',
      'AudioView uses design system components',
      'LevelDesignView uses design system components',
      'MaterialsView uses design system components',
    ],
    ['content-feature-map-config-b'],
  ),
];

/* ── Phase 1: Animations Module ─────────────────────────────────────────── */

const PHASE_1_ANIMATIONS: ModuleArea[] = [
  area(
    'content-animations-scaling',
    'Animations Module Scaling',
    `AnimationStateMachine.tsx and AnimationChecklist.tsx need to handle 100+ animations.
1. Add search/filter to the state machine view for finding states by name
2. Add pagination or virtual scroll to the checklist (currently shows all items)
3. Add grouping for montages by category (Attack, Dodge, HitReact, etc.)
4. Combo choreographer should support filtering combos by weapon type`,
    [
      'State machine view has search filter',
      'Checklist supports pagination for 100+ items',
      'Montages grouped by category',
    ],
    ['content-design-consistency'],
  ),

  area(
    'content-animations-flow',
    'Animations Module Tab Flow',
    `Restructure tabs for logical flow:
Current: Setup Guide, State Machine, Combo Designer, Ask Claude
New: Features → Setup Guide → State Machine → Combos → Ask Claude
Narrative: "Configure → Define States → Chain Combos → Explore"
Add breadcrumb flow bar. Add one-line subtitle per tab.`,
    [
      'Tab order restructured with narrative flow',
      'Breadcrumb bar added',
      'Tab subtitles describe pipeline stage',
    ],
    ['content-animations-scaling'],
  ),

  area(
    'content-animations-visual',
    'Animations Module Visual Polish',
    `Upgrade visual quality of animation tools:
1. State machine: nodes should have rounded rects with glow, animated transition arrows
2. Combo choreographer: timeline with hit windows as colored blocks
3. Setup checklist: progress indicators with NeonBar per section
4. Use consistent ACCENT color from MODULE_COLORS.content`,
    [
      'State machine nodes with styled SVG',
      'Combo timeline with colored windows',
      'Checklist progress bars',
    ],
    ['content-animations-flow'],
  ),
];

/* ── Phase 1: Audio Module ──────────────────────────────────────────────── */

const PHASE_1_AUDIO: ModuleArea[] = [
  area(
    'content-audio-scaling',
    'Audio Module Scaling',
    `Audio module (AudioView.tsx + 6 child components) needs to handle 100+ audio events.
1. AudioEventCatalog: add search/filter and virtual scroll for large event lists
2. AudioScenePainter: support 50+ zones with grouping by area
3. Add pagination to zone and emitter lists`,
    [
      'Event catalog has search and virtual scroll',
      'Scene painter groups zones by area',
      'Zone/emitter lists paginated',
    ],
    ['content-design-consistency'],
  ),

  area(
    'content-audio-flow',
    'Audio Module Tab Flow',
    `Restructure audio tabs for logical flow.
Ensure tabs follow: Features → Pipeline → Scene Painter → Events → Code Gen
Narrative: "Design Pipeline → Paint Scenes → Define Events → Generate Code"
Add breadcrumb bar and subtitles.`,
    [
      'Tab order follows pipeline narrative',
      'Breadcrumb bar added',
      'Tab subtitles added',
    ],
    ['content-audio-scaling'],
  ),

  area(
    'content-audio-visual',
    'Audio Module Visual Polish',
    `Upgrade audio module visuals:
1. Pipeline diagram: proper flow visualization with node types
2. Spatial painter: enhanced zone visualization with opacity/radius indicators
3. Event catalog: card-based layout with type-colored badges
4. Consistent MODULE_COLORS.content accent`,
    [
      'Pipeline has styled flow nodes',
      'Spatial painter enhanced zones',
      'Event catalog card-based layout',
    ],
    ['content-audio-flow'],
  ),
];

/* ── Phase 1: Level Design Module ───────────────────────────────────────── */

const PHASE_1_LEVEL: ModuleArea[] = [
  area(
    'content-level-scaling',
    'Level Design Module Scaling',
    `Level design (8 files, 3805 LOC) needs to handle 50+ rooms and zones.
1. LevelFlowEditor: support 50+ rooms with auto-layout and search
2. StreamingZonePlanner: paginate zone list, group by area
3. ProceduralLevelWizard: handle large generation parameters`,
    [
      'Flow editor supports 50+ rooms with search',
      'Streaming planner paginated and grouped',
      'Procedural wizard handles large params',
    ],
    ['content-design-consistency'],
  ),

  area(
    'content-level-flow',
    'Level Design Module Tab Flow',
    `Restructure level design tabs for logical flow.
Current: overview, roadmap, flow, procgen, narrative, sync, arc, streaming (8 tabs — too many)
Consolidate to 5: Features → Layout → Streaming → Procedural → Difficulty
Move narrative into Layout. Move sync into Layout. Merge arc into Difficulty.
Add breadcrumb and subtitles.`,
    [
      'Tabs consolidated from 8 to 5',
      'Breadcrumb flow bar added',
      'Tab subtitles describe pipeline stage',
    ],
    ['content-level-scaling'],
  ),

  area(
    'content-level-visual',
    'Level Design Module Visual Polish',
    `Upgrade level design visuals:
1. Room flow graph: styled node graph with room-type icons
2. Streaming zones: visual map with zone boundaries
3. Difficulty arc: line chart with shaded target zone
4. Consistent MODULE_COLORS.content accent`,
    [
      'Room flow graph styled with icons',
      'Streaming zones visual map',
      'Difficulty chart with target zones',
    ],
    ['content-level-flow'],
  ),
];

/* ── Phase 1: Materials Module ──────────────────────────────────────────── */

const PHASE_1_MATERIALS: ModuleArea[] = [
  area(
    'content-materials-scaling',
    'Materials Module Scaling',
    `Materials module (6 files, 2594 LOC) needs to handle 100+ materials.
1. MaterialPatternCatalog: search, filter by type, virtual scroll
2. MaterialLayerGraph: support 20+ layers with zoom/pan
3. MaterialParameterConfigurator: paginate parameters`,
    [
      'Pattern catalog has search and virtual scroll',
      'Layer graph supports 20+ layers',
      'Parameter list paginated',
    ],
    ['content-design-consistency'],
  ),

  area(
    'content-materials-visual',
    'Materials Module Flow & Visual Polish',
    `Restructure tabs and polish visuals:
Tab flow: Features → Patterns → Layer Graph → Parameters → Post-Process → Style Transfer
1. Pattern catalog: card-based grid with material type badges
2. Layer graph: proper node graph with connection lines
3. Post-process: stack visualization with reorderable stages
4. Add breadcrumb and subtitles`,
    [
      'Tab flow restructured with breadcrumb',
      'Pattern catalog card-based',
      'Post-process stack visualization',
    ],
    ['content-materials-scaling'],
  ),
];

/* ── Phase 1: Models Module ─────────────────────────────────────────────── */

const PHASE_1_MODELS: ModuleArea[] = [
  area(
    'content-models-upgrade',
    'Models Module Scaling & Polish',
    `Models module is the smallest (3 files, 940 LOC). Upgrade in one pass:
1. AssetInventory: add search, filter by type (static mesh, skeletal, etc.), virtual scroll for 200+ assets
2. AssetPipelineDiagram: enhance with styled flow nodes and status indicators
3. Add tab flow: Features → Asset Inventory → Import Pipeline
4. Add breadcrumb and subtitles
5. Apply design system (BlueprintPanel, SectionHeader, MODULE_COLORS.content)`,
    [
      'Asset inventory search and virtual scroll',
      'Pipeline diagram styled flow nodes',
      'Tab flow with breadcrumb',
      'Design system applied',
    ],
    ['content-design-consistency'],
  ),
];

/* ── Phase 1: UI/HUD Module ─────────────────────────────────────────────── */

const PHASE_1_UI_HUD: ModuleArea[] = [
  area(
    'content-uihud-scaling',
    'UI/HUD Module Scaling',
    `UI/HUD module (8 files, 4108 LOC — largest content module).
1. InventoryGridDesigner: support 100+ item slots with virtual scroll
2. MenuFlowDiagram: support 30+ screens with search
3. HudThemeEditor: paginate theme parameters
4. DamageNumberPalette: handle 20+ number styles`,
    [
      'Inventory designer virtual scrolls 100+ slots',
      'Menu flow supports 30+ screens with search',
      'Theme editor paginated',
    ],
    ['content-design-consistency'],
  ),

  area(
    'content-uihud-flow',
    'UI/HUD Module Tab Flow',
    `Restructure UI/HUD tabs for logical flow.
Tab flow: Features → Menus → HUD → Inventory → Polish
Narrative: "Design Menus → Build HUD → Create Inventory → Polish Effects"
Merge damage number tools into Polish tab.
Add breadcrumb and subtitles.`,
    [
      'Tab order follows UI development narrative',
      'Breadcrumb flow bar added',
      'Damage number tools merged into Polish',
    ],
    ['content-uihud-scaling'],
  ),

  area(
    'content-uihud-visual',
    'UI/HUD Module Visual Polish',
    `Upgrade UI/HUD visuals:
1. Menu flow: proper flowchart with screen-type icons
2. Inventory grid: visual slot layout with drag preview
3. HUD theme: live preview panel with parameter sliders
4. Damage numbers: physics simulation with visual tuning`,
    [
      'Menu flow chart with screen icons',
      'Inventory grid visual layout',
      'HUD theme live preview',
    ],
    ['content-uihud-flow'],
  ),
];

/* ── Phase 2: Cross-Module Audit ────────────────────────────────────────── */

const PHASE_2: ModuleArea[] = [
  area(
    'content-style-audit',
    'Content Module Style Audit',
    `Verify visual consistency across all 6 content modules.
1. All modules use MODULE_COLORS.content accent consistently
2. All use BlueprintPanel, SectionHeader from design system
3. No hardcoded hex colors
4. Typography hierarchy consistent with core-engine modules
5. Feature Map tab works for all modules
6. Fix any deviations found`,
    [
      'Consistent accent color across all 6 modules',
      'Design system components used everywhere',
      'No hardcoded colors',
      'Feature Map functional for all modules',
    ],
    [
      'content-animations-visual',
      'content-audio-visual',
      'content-level-visual',
      'content-materials-visual',
      'content-models-upgrade',
      'content-uihud-visual',
    ],
  ),
];

/* ── Exports ────────────────────────────────────────────────────────────── */

export const CONTENT_OVERHAUL_AREAS: ModuleArea[] = [
  ...PHASE_0,
  ...PHASE_1_ANIMATIONS,
  ...PHASE_1_AUDIO,
  ...PHASE_1_LEVEL,
  ...PHASE_1_MATERIALS,
  ...PHASE_1_MODELS,
  ...PHASE_1_UI_HUD,
  ...PHASE_2,
];

export const CONTENT_OVERHAUL_SUMMARY = {
  phase0_infrastructure: PHASE_0.length,
  phase1_animations: PHASE_1_ANIMATIONS.length,
  phase1_audio: PHASE_1_AUDIO.length,
  phase1_level: PHASE_1_LEVEL.length,
  phase1_materials: PHASE_1_MATERIALS.length,
  phase1_models: PHASE_1_MODELS.length,
  phase1_uihud: PHASE_1_UI_HUD.length,
  phase2_audit: PHASE_2.length,
  total: CONTENT_OVERHAUL_AREAS.length,
} as const;
