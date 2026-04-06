/**
 * Plan Builder — generates a GamePlan from the module registry and feature definitions.
 *
 * Groups checklist items and features into "module areas" — coherent units
 * that fit well in a single 1M-context Claude session. Uses MODULE_PREREQUISITES
 * for dependency ordering via topological sort.
 */

import type { SubModuleId } from '@/types/modules';
import { SUB_MODULES } from '@/lib/module-registry';
import type { SubModuleDefinition, ChecklistItem } from '@/types/modules';
import {
  MODULE_FEATURE_DEFINITIONS,
  MODULE_PREREQUISITES,
} from '@/lib/feature-definitions';
import type {
  GamePlan,
  ModuleArea,
  PlannedFeature,
  HarnessConfig,
} from './types';

// ── Area Definition Presets ─────────────────────────────────────────────────

/**
 * Hand-curated area groupings for core modules.
 * Each area maps to a coherent block of work suitable for one session.
 * If a module isn't listed here, it becomes a single area automatically.
 */
const AREA_PRESETS: Partial<Record<SubModuleId, Array<{
  id: string;
  label: string;
  description: string;
  checklistPrefix: string[];
  featureCategories: string[];
}>>> = {
  'arpg-character': [
    {
      id: 'character-foundation',
      label: 'Character Foundation',
      description: 'Base character class, game mode, player controller, and core movement (walk, sprint)',
      checklistPrefix: ['ac-1', 'ac-2', 'ac-3', 'ac-4'],
      featureCategories: ['Character', 'Movement', 'GameMode'],
    },
    {
      id: 'character-camera-input',
      label: 'Camera & Input System',
      description: 'Camera setup, input mapping context, enhanced input actions',
      checklistPrefix: ['ac-5', 'ac-6', 'ac-7', 'ac-8'],
      featureCategories: ['Camera', 'Input'],
    },
  ],
  'arpg-gas': [
    {
      id: 'gas-core',
      label: 'Gameplay Ability System Core',
      description: 'Ability system component, attribute sets, gameplay effects, ability base class',
      checklistPrefix: ['ag-1', 'ag-2', 'ag-3', 'ag-4', 'ag-5'],
      featureCategories: ['AbilitySystem', 'Attributes', 'Effects'],
    },
    {
      id: 'gas-abilities',
      label: 'GAS Abilities & Tags',
      description: 'Concrete abilities, gameplay tags, gameplay cues, ability tasks',
      checklistPrefix: ['ag-6', 'ag-7', 'ag-8'],
      featureCategories: ['Abilities', 'Tags', 'Cues'],
    },
  ],
  'arpg-animation': [
    {
      id: 'animation-locomotion',
      label: 'Animation Locomotion',
      description: 'AnimInstance, blend spaces, locomotion state machine',
      checklistPrefix: ['aa-1', 'aa-2', 'aa-3', 'aa-4'],
      featureCategories: ['AnimBP', 'Locomotion', 'BlendSpace'],
    },
    {
      id: 'animation-montages',
      label: 'Montages & Motion Warping',
      description: 'Attack montages, anim notifies, motion warping, root motion',
      checklistPrefix: ['aa-5', 'aa-6', 'aa-7', 'aa-8'],
      featureCategories: ['Montage', 'Notifies', 'Retarget', 'Automation'],
    },
  ],
  'arpg-combat': [
    {
      id: 'combat-melee',
      label: 'Combat — Melee & Combos',
      description: 'Melee attack ability, combo system, hit detection, GAS damage application',
      checklistPrefix: ['acb-1', 'acb-2', 'acb-3', 'acb-4'],
      featureCategories: ['Abilities', 'Combat', 'HitDetection'],
    },
    {
      id: 'combat-feedback',
      label: 'Combat — Feedback & Death',
      description: 'Hit reactions, death flow, combat feedback, dodge ability (GAS)',
      checklistPrefix: ['acb-5', 'acb-6', 'acb-7', 'acb-8', 'acb-9'],
      featureCategories: ['Feedback', 'Damage', 'Combo', 'Weapon'],
    },
  ],
  'arpg-enemy-ai': [
    {
      id: 'enemy-ai-core',
      label: 'Enemy AI — Controllers & Perception',
      description: 'AI controller, enemy character, AI perception, behavior tree basics',
      checklistPrefix: ['ae-1', 'ae-2', 'ae-3', 'ae-4'],
      featureCategories: ['AI', 'Character', 'BehaviorTree', 'Perception'],
    },
    {
      id: 'enemy-ai-advanced',
      label: 'Enemy AI — EQS, Archetypes & Spawning',
      description: 'EQS queries, enemy archetypes, enemy abilities, spawn system',
      checklistPrefix: ['ae-5', 'ae-6', 'ae-7', 'ae-8'],
      featureCategories: ['Enemy', 'Spawning', 'Abilities'],
    },
  ],
  'arpg-inventory': [
    {
      id: 'inventory-items',
      label: 'Item Definitions & Inventory',
      description: 'Item definition, item instance, inventory component',
      checklistPrefix: ['ai-1', 'ai-2', 'ai-3'],
      featureCategories: ['Data', 'Runtime', 'Component'],
    },
    {
      id: 'inventory-equipment',
      label: 'Equipment & Consumables',
      description: 'Equipment slots, equip/unequip GAS flow, consumables, affix system',
      checklistPrefix: ['ai-4', 'ai-5', 'ai-6', 'ai-7', 'ai-8'],
      featureCategories: ['Equipment', 'Items', 'Inventory'],
    },
  ],
  'arpg-loot': [
    {
      id: 'loot-tables',
      label: 'Loot Tables & Selection',
      description: 'Loot table data, weighted random selection, world items',
      checklistPrefix: ['al-1', 'al-2', 'al-3'],
      featureCategories: ['Data', 'Logic', 'Actors'],
    },
    {
      id: 'loot-drops',
      label: 'Loot Drops & Feedback',
      description: 'Drop on death, pickup, visual feedback, chest/container actors',
      checklistPrefix: ['al-4', 'al-5', 'al-6', 'al-7', 'al-8'],
      featureCategories: ['Loot', 'Drop', 'VFX', 'Affix', 'Rarity'],
    },
  ],
  'arpg-ui': [
    {
      id: 'ui-hud-gas',
      label: 'HUD & GAS Bindings',
      description: 'Main HUD widget, GAS attribute binding, enemy health bars, ability cooldowns',
      checklistPrefix: ['au-1', 'au-2', 'au-3', 'au-4'],
      featureCategories: ['HUD', 'Widget'],
    },
    {
      id: 'ui-screens',
      label: 'UI Screens',
      description: 'Inventory screen, character stats, floating damage numbers, pause/settings',
      checklistPrefix: ['au-5', 'au-6', 'au-7', 'au-8'],
      featureCategories: ['Screens', 'Feedback', 'UI'],
    },
  ],
  'arpg-progression': [
    {
      id: 'progression-xp',
      label: 'XP & Leveling',
      description: 'XP/level attributes, XP curve, XP on kill, level-up detection',
      checklistPrefix: ['ap-1', 'ap-2', 'ap-3', 'ap-4'],
      featureCategories: ['Attributes', 'Data', 'Logic', 'XP', 'Level'],
    },
    {
      id: 'progression-skills',
      label: 'Abilities & Skill Trees',
      description: 'Active abilities, unlock system, attribute points, ability loadout',
      checklistPrefix: ['ap-5', 'ap-6', 'ap-7', 'ap-8'],
      featureCategories: ['Abilities', 'Progression', 'SkillTree'],
    },
  ],
  'arpg-world': [
    {
      id: 'world-zones',
      label: 'World Zones & Blockouts',
      description: 'Zone layout design, blockout levels, NavMesh coverage',
      checklistPrefix: ['aw-1', 'aw-2', 'aw-3'],
      featureCategories: ['Design', 'Levels', 'Navigation', 'Zone'],
    },
    {
      id: 'world-encounters',
      label: 'Encounters & Bosses',
      description: 'Enemy spawn placement, boss encounter, environmental hazards',
      checklistPrefix: ['aw-4', 'aw-5', 'aw-6'],
      featureCategories: ['Spawning', 'Boss', 'Actors'],
    },
    {
      id: 'world-interactive',
      label: 'Interactive World',
      description: 'Interactive world objects, zone transitions',
      checklistPrefix: ['aw-7', 'aw-8'],
      featureCategories: ['Streaming', 'Interaction', 'World'],
    },
  ],
  'arpg-save': [
    {
      id: 'save-core',
      label: 'Save/Load Core',
      description: 'USaveGame, custom serialization, save and load functions',
      checklistPrefix: ['as-1', 'as-2', 'as-3', 'as-4'],
      featureCategories: ['Core', 'Save', 'Serialization'],
    },
    {
      id: 'save-features',
      label: 'Save Features',
      description: 'Auto-save, slot system, save versioning',
      checklistPrefix: ['as-5', 'as-6', 'as-7', 'as-8'],
      featureCategories: ['Logic', 'UI', 'Persistence'],
    },
  ],
  'arpg-polish': [
    {
      id: 'polish-debug',
      label: 'Debug & Logging',
      description: 'Structured logging, debug draw helpers, console commands',
      checklistPrefix: ['apl-1', 'apl-2', 'apl-3'],
      featureCategories: ['Debug', 'VFX'],
    },
    {
      id: 'polish-performance',
      label: 'Performance Optimization',
      description: 'Object pooling, tick optimization, async asset loading',
      checklistPrefix: ['apl-4', 'apl-5', 'apl-6', 'apl-7', 'apl-8'],
      featureCategories: ['Performance', 'Polish', 'PostProcess', 'Audio'],
    },
  ],
  // ── Content Modules ─────────────────────────────────────────────────────
  'materials': [
    {
      id: 'materials-core',
      label: 'Materials — Core',
      description: 'Master material, dynamic instances, MPC, material functions',
      checklistPrefix: ['mat-1', 'mat-2', 'mat-3', 'mat-4'],
      featureCategories: ['Master', 'Dynamic', 'MPC', 'Functions'],
    },
    {
      id: 'materials-advanced',
      label: 'Materials — Advanced',
      description: 'Post-process, HLSL custom nodes, layer system, Substrate',
      checklistPrefix: ['mat-5', 'mat-6', 'mat-7', 'mat-8'],
      featureCategories: ['PostProcess', 'HLSL', 'Layer', 'Substrate'],
    },
  ],
  'level-design': [
    {
      id: 'level-design-core',
      label: 'Level Design — Core',
      description: 'Blockout geometry, spawn points, level streaming, zone transitions',
      checklistPrefix: ['ld-1', 'ld-2', 'ld-3', 'ld-4'],
      featureCategories: ['Blockout', 'Spawn', 'Streaming', 'Zone'],
    },
    {
      id: 'level-design-advanced',
      label: 'Level Design — Advanced',
      description: 'Environmental hazards, NavMesh, procedural gen, PCG, vegetation',
      checklistPrefix: ['ld-5', 'ld-6', 'ld-7', 'ld-8'],
      featureCategories: ['Hazard', 'NavMesh', 'Procedural', 'PCG', 'Vegetation'],
    },
  ],
  // ── Game Systems ────────────────────────────────────────────────────────
  'multiplayer': [
    {
      id: 'multiplayer-core',
      label: 'Multiplayer — Replication',
      description: 'Replicated properties, RPC framework, GameState replication',
      checklistPrefix: ['mp-1', 'mp-2', 'mp-3', 'mp-4'],
      featureCategories: ['Replication', 'RPC', 'GameState'],
    },
    {
      id: 'multiplayer-advanced',
      label: 'Multiplayer — Sessions & Prediction',
      description: 'Session management, network prediction, net relevancy',
      checklistPrefix: ['mp-5', 'mp-6', 'mp-7'],
      featureCategories: ['Session', 'Prediction', 'Relevancy', 'Iris'],
    },
  ],
  'dialogue-quests': [
    {
      id: 'dialogue-quests-core',
      label: 'Dialogue & NPC Interaction',
      description: 'Dialogue data assets, branching conversations, NPC interaction',
      checklistPrefix: ['dq-1', 'dq-2', 'dq-3'],
      featureCategories: ['Dialogue', 'NPC', 'Conversation'],
    },
    {
      id: 'dialogue-quests-system',
      label: 'Quest System',
      description: 'Quest tracker, objectives, quest log UI',
      checklistPrefix: ['dq-4', 'dq-5', 'dq-6'],
      featureCategories: ['Quest', 'Objective', 'UI'],
    },
  ],
};

// ── Topological Sort ────────────────────────────────────────────────────────

function topologicalSortModules(moduleIds: SubModuleId[]): SubModuleId[] {
  const visited = new Set<SubModuleId>();
  const sorted: SubModuleId[] = [];
  const idSet = new Set(moduleIds);

  function visit(id: SubModuleId) {
    if (visited.has(id)) return;
    visited.add(id);
    const prereqs = MODULE_PREREQUISITES[id] ?? [];
    for (const p of prereqs) {
      if (idSet.has(p)) visit(p);
    }
    sorted.push(id);
  }

  for (const id of moduleIds) visit(id);
  return sorted;
}

// ── Area Builder ────────────────────────────────────────────────────────────

function buildAreasForModule(moduleId: SubModuleId): ModuleArea[] {
  const moduleDef = SUB_MODULES.find((m: SubModuleDefinition) => m.id === moduleId);
  const featureDefs = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
  const checklist = moduleDef?.checklist ?? [];

  const presets = AREA_PRESETS[moduleId];

  if (presets && presets.length > 0) {
    return presets.map(preset => {
      const matchingChecklist = checklist
        .filter((item: ChecklistItem) => preset.checklistPrefix.some(prefix => item.id.startsWith(prefix)))
        .map((item: ChecklistItem) => item.id);

      const matchingFeatures = featureDefs
        .filter(f => preset.featureCategories.some(cat =>
          f.category.toLowerCase().includes(cat.toLowerCase()),
        ))
        .map(f => f.featureName);

      // If no features matched by category, include all (single-area module)
      const finalFeatures = matchingFeatures.length > 0
        ? matchingFeatures
        : featureDefs.map(f => f.featureName);

      const finalChecklist = matchingChecklist.length > 0
        ? matchingChecklist
        : checklist.map((c: ChecklistItem) => c.id);

      const features: PlannedFeature[] = finalFeatures.map(name => ({
        id: `${moduleId}::${name}`,
        name,
        status: 'pending',
        quality: null,
        lastSession: null,
      }));

      return {
        id: preset.id,
        moduleId,
        label: preset.label,
        description: preset.description,
        checklistItemIds: finalChecklist,
        featureNames: finalFeatures,
        dependsOn: [],
        status: 'pending',
        features,
      };
    });
  }

  // Fallback: entire module as a single area
  const features: PlannedFeature[] = featureDefs.map(f => ({
    id: `${moduleId}::${f.featureName}`,
    name: f.featureName,
    status: 'pending',
    quality: null,
    lastSession: null,
  }));

  return [{
    id: moduleId,
    moduleId,
    label: moduleDef?.label ?? moduleId,
    description: moduleDef?.description ?? '',
    checklistItemIds: checklist.map((c: ChecklistItem) => c.id),
    featureNames: featureDefs.map(f => f.featureName),
    dependsOn: [],
    status: 'pending',
    features,
  }];
}

/**
 * Wire up area-level dependencies from MODULE_PREREQUISITES.
 * If module B depends on module A, all areas in B depend on all areas in A.
 */
function wireAreaDependencies(areas: ModuleArea[]): void {
  const areasByModule = new Map<SubModuleId, string[]>();
  for (const area of areas) {
    const existing = areasByModule.get(area.moduleId) ?? [];
    existing.push(area.id);
    areasByModule.set(area.moduleId, existing);
  }

  for (const area of areas) {
    const modulePrereqs = MODULE_PREREQUISITES[area.moduleId] ?? [];
    const deps: string[] = [];
    for (const prereqModule of modulePrereqs) {
      const prereqAreas = areasByModule.get(prereqModule) ?? [];
      deps.push(...prereqAreas);
    }

    // Within the same module, chain areas sequentially
    const sibling = areasByModule.get(area.moduleId) ?? [];
    const myIndex = sibling.indexOf(area.id);
    if (myIndex > 0) {
      deps.push(sibling[myIndex - 1]);
    }

    area.dependsOn = [...new Set(deps)];
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Build a GamePlan from config. Generates module areas, sorts by dependencies,
 * and produces the initial state file.
 */
export function buildGamePlan(config: HarnessConfig): GamePlan {
  // All modules in the 50-area scenario, ordered by tier
  const allModules: SubModuleId[] = [
    // Tier 0 — Foundation
    'arpg-character', 'input-handling', 'physics',
    // Tier 1 — Core Systems
    'arpg-animation', 'arpg-gas', 'models', 'audio', 'ui-hud',
    // Tier 2 — Combat & AI
    'arpg-combat', 'arpg-enemy-ai', 'ai-behavior', 'materials', 'animations',
    // Tier 3 — Economy & UI
    'arpg-inventory', 'arpg-loot', 'arpg-ui', 'dialogue-quests',
    // Tier 4 — Progression & World
    'arpg-progression', 'arpg-world', 'level-design', 'multiplayer',
    // Tier 5 — Persistence & Polish
    'arpg-save', 'save-load', 'arpg-polish',
    // Tier 6 — Packaging
    'packaging',
  ];

  const sorted = topologicalSortModules(allModules);

  // Build areas for each module in sorted order
  const allAreas: ModuleArea[] = [];

  if (config.areas) {
    // Custom areas already have dependsOn set — use them directly in order
    allAreas.push(...config.areas);
  } else {
    for (const moduleId of sorted) {
      const areas = buildAreasForModule(moduleId);
      allAreas.push(...areas);
    }
    wireAreaDependencies(allAreas);
  }

  const totalFeatures = allAreas.reduce((sum, a) => sum + a.features.length, 0);

  return {
    game: config.projectName,
    projectPath: config.projectPath,
    ueVersion: config.ueVersion,
    areas: allAreas,
    iteration: 0,
    totalFeatures,
    passingFeatures: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Pick the next area to work on based on dependency resolution.
 * Returns null if all areas are completed or blocked.
 */
export function pickNextArea(plan: GamePlan): ModuleArea | null {
  const completedIds = new Set(
    plan.areas.filter(a => a.status === 'completed').map(a => a.id),
  );

  for (const area of plan.areas) {
    if (area.status !== 'pending' && area.status !== 'failed') continue;

    const depsResolved = area.dependsOn.every(depId => completedIds.has(depId));
    if (!depsResolved) continue;

    return area;
  }

  return null;
}

/**
 * Update plan statistics after an iteration.
 */
export function updatePlanStats(plan: GamePlan): void {
  plan.passingFeatures = plan.areas.reduce(
    (sum, a) => sum + a.features.filter(f => f.status === 'pass').length,
    0,
  );
  plan.updatedAt = new Date().toISOString();
}
