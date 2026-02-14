import {
  MODULE_FEATURE_DEFINITIONS,
  buildDependencyMap,
  type DependencyInfo,
  type ResolvedDependency,
} from '@/lib/feature-definitions';
import { computeImpactScores, type ImpactScore } from './impact-scorer';
import { estimateEffort, type EffortEstimate } from './effort-estimator';

// ---------- Types ----------

export interface PlanItem {
  /** Fully qualified key: "moduleId::featureName" */
  key: string;
  moduleId: string;
  featureName: string;
  category: string;
  description: string;
  /** Topological depth (0 = no deps, higher = deeper in chain) */
  depth: number;
  /** Impact score for prioritization */
  impact: ImpactScore;
  /** Estimated effort */
  effort: EffortEstimate;
  /** Direct dependencies (keys) */
  dependsOn: string[];
  /** Whether all dependencies are met (implemented or earlier in plan) */
  isReady: boolean;
  /** Current implementation status */
  status: string;
}

export interface ImplementationPlan {
  items: PlanItem[];
  totalFeatures: number;
  implementedCount: number;
  remainingCount: number;
  totalEffortMinutes: number;
}

export interface PlanFilter {
  moduleId?: string;
  maxEffort?: 'trivial' | 'small' | 'medium' | 'large';
  minImpact?: number;
}

// ---------- Topological sort ----------

/**
 * Kahn's algorithm for topological sort of unimplemented features.
 * Within each level, sorts by impact score (descending) for optimal ordering.
 */
function topologicalSort(
  unimplemented: Set<string>,
  depMap: Map<string, DependencyInfo>,
  impactScores: Map<string, ImpactScore>,
): Array<{ key: string; depth: number }> {
  // Build in-degree counts (only counting deps within unimplemented set)
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>(); // dep -> dependents

  for (const key of unimplemented) {
    inDegree.set(key, 0);
    if (!adjacency.has(key)) adjacency.set(key, []);
  }

  for (const key of unimplemented) {
    const info = depMap.get(key);
    if (!info) continue;
    let count = 0;
    for (const dep of info.deps) {
      if (unimplemented.has(dep.key)) {
        count++;
        if (!adjacency.has(dep.key)) adjacency.set(dep.key, []);
        adjacency.get(dep.key)!.push(key);
      }
    }
    inDegree.set(key, count);
  }

  // Collect nodes with in-degree 0 (ready to implement)
  const result: Array<{ key: string; depth: number }> = [];
  let currentLevel: string[] = [];

  for (const [key, degree] of inDegree) {
    if (degree === 0) currentLevel.push(key);
  }

  let depth = 0;

  while (currentLevel.length > 0) {
    // Sort within level by impact score (descending)
    currentLevel.sort((a, b) => {
      const scoreA = impactScores.get(a)?.score ?? 0;
      const scoreB = impactScores.get(b)?.score ?? 0;
      if (scoreB !== scoreA) return scoreB - scoreA;
      // Stable tiebreak: alphabetical
      return a.localeCompare(b);
    });

    for (const key of currentLevel) {
      result.push({ key, depth });
    }

    const nextLevel: string[] = [];
    for (const key of currentLevel) {
      for (const dependent of adjacency.get(key) ?? []) {
        const deg = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, deg);
        if (deg === 0) nextLevel.push(dependent);
      }
    }

    currentLevel = nextLevel;
    depth++;
  }

  return result;
}

// ---------- Plan generation ----------

/**
 * Generate an implementation plan: topologically sorted, impact-prioritized list
 * of all unimplemented features.
 */
export function generatePlan(
  statusMap: Map<string, string>,
  filter?: PlanFilter,
): ImplementationPlan {
  const depMap = buildDependencyMap();
  const implementedKeys = new Set<string>();
  let totalFeatures = 0;

  // Count totals and collect implemented
  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      totalFeatures++;
      const status = statusMap.get(key) ?? 'unknown';
      if (status === 'implemented') {
        implementedKeys.add(key);
      }
    }
  }

  // Build unimplemented set
  const unimplemented = new Set<string>();
  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      if (!implementedKeys.has(key)) {
        unimplemented.add(key);
      }
    }
  }

  // Impact scores
  const impactScores = computeImpactScores(implementedKeys);

  // Topological sort
  const sorted = topologicalSort(unimplemented, depMap, impactScores);

  // Build plan items
  let items: PlanItem[] = sorted.map(({ key, depth }) => {
    const [moduleId, ...rest] = key.split('::');
    const featureName = rest.join('::');
    const features = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
    const feat = features.find((f) => f.featureName === featureName);

    const info = depMap.get(key);
    const deps = (info?.deps ?? []).map((d) => d.key);

    // A feature is "ready" if all its deps are implemented
    const isReady = deps.every((d) => implementedKeys.has(d));

    return {
      key,
      moduleId,
      featureName,
      category: feat?.category ?? 'Unknown',
      description: feat?.description ?? '',
      depth,
      impact: impactScores.get(key) ?? { directUnblocks: 0, transitiveUnblocks: 0, score: 0, directDependents: [] },
      effort: estimateEffort(moduleId, featureName),
      dependsOn: deps,
      isReady,
      status: statusMap.get(key) ?? 'unknown',
    };
  });

  // Apply filters
  if (filter) {
    if (filter.moduleId) {
      items = items.filter((item) => item.moduleId === filter.moduleId);
    }
    if (filter.minImpact != null) {
      items = items.filter((item) => item.impact.score >= filter.minImpact!);
    }
    if (filter.maxEffort) {
      const effortOrder: Record<string, number> = { trivial: 0, small: 1, medium: 2, large: 3 };
      const maxOrd = effortOrder[filter.maxEffort];
      items = items.filter((item) => effortOrder[item.effort.level] <= maxOrd);
    }
  }

  const totalEffortMinutes = items.reduce((sum, item) => sum + item.effort.minutes, 0);

  return {
    items,
    totalFeatures,
    implementedCount: implementedKeys.size,
    remainingCount: unimplemented.size,
    totalEffortMinutes,
  };
}

/**
 * Get module labels for display.
 */
export function getModuleLabel(moduleId: string): string {
  const labels: Record<string, string> = {
    'arpg-character': 'Character',
    'arpg-animation': 'Animation',
    'arpg-gas': 'GAS',
    'arpg-combat': 'Combat',
    'arpg-enemy-ai': 'Enemy AI',
    'arpg-inventory': 'Inventory',
    'arpg-loot': 'Loot',
    'arpg-ui': 'UI/HUD',
    'arpg-progression': 'Progression',
    'arpg-world': 'World',
    'arpg-save': 'Save',
    'arpg-polish': 'Polish',
    'models': 'Models',
    'animations': 'Animations',
    'materials': 'Materials',
    'level-design': 'Level Design',
    'ui-hud': 'UI/HUD',
    'audio': 'Audio',
    'physics': 'Physics',
    'multiplayer': 'Multiplayer',
    'save-load': 'Save/Load',
    'input-handling': 'Input',
    'dialogue-quests': 'Dialogue',
    'ai-behavior': 'AI Behavior',
    'packaging': 'Packaging',
  };
  return labels[moduleId] ?? moduleId;
}
