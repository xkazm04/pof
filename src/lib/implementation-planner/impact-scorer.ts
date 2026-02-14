import {
  MODULE_FEATURE_DEFINITIONS,
  buildDependencyMap,
  type ResolvedDependency,
} from '@/lib/feature-definitions';

export interface ImpactScore {
  /** Number of features directly unblocked by implementing this feature */
  directUnblocks: number;
  /** Number of features transitively unblocked (full cascade) */
  transitiveUnblocks: number;
  /** Combined impact score (weighted) */
  score: number;
  /** Keys of features that this feature directly unblocks */
  directDependents: string[];
}

/**
 * Build a reverse dependency map: for each feature, which features depend on it.
 */
function buildReverseDependencyMap(): Map<string, string[]> {
  const reverse = new Map<string, string[]>();

  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      if (!reverse.has(key)) reverse.set(key, []);

      for (const depRef of feat.dependsOn ?? []) {
        const depKey = depRef.includes('::')
          ? depRef
          : `${moduleId}::${depRef}`;
        if (!reverse.has(depKey)) reverse.set(depKey, []);
        reverse.get(depKey)!.push(key);
      }
    }
  }

  return reverse;
}

/**
 * BFS count of features transitively unblocked if this feature is implemented.
 * Only counts features whose OTHER dependencies are all already implemented
 * or would be implemented in the cascade.
 */
function bfsTransitiveUnblocks(
  featureKey: string,
  reverseMap: Map<string, string[]>,
  implementedSet: Set<string>,
): { direct: string[]; transitive: Set<string> } {
  const depMap = buildDependencyMap();
  const newlyImplemented = new Set<string>([...implementedSet, featureKey]);
  const transitive = new Set<string>();
  const direct: string[] = [];
  const queue = [featureKey];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const dependents = reverseMap.get(current) ?? [];

    for (const dep of dependents) {
      if (transitive.has(dep) || newlyImplemented.has(dep)) continue;

      // Check if ALL dependencies of this dependent are now met
      const depInfo = depMap.get(dep);
      if (!depInfo) continue;

      const allDependenciesMet = depInfo.deps.every(
        (d) => newlyImplemented.has(d.key)
      );

      if (allDependenciesMet) {
        transitive.add(dep);
        newlyImplemented.add(dep);
        queue.push(dep);

        // Track direct unblocks (features that directly depend on the original feature)
        if (current === featureKey) {
          direct.push(dep);
        }
      }
    }
  }

  return { direct, transitive };
}

/**
 * Compute impact scores for all unimplemented features.
 * @param implementedKeys Set of feature keys that are already implemented
 */
export function computeImpactScores(
  implementedKeys: Set<string>,
): Map<string, ImpactScore> {
  const reverseMap = buildReverseDependencyMap();
  const scores = new Map<string, ImpactScore>();

  for (const [moduleId, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    for (const feat of features) {
      const key = `${moduleId}::${feat.featureName}`;
      if (implementedKeys.has(key)) continue;

      const { direct, transitive } = bfsTransitiveUnblocks(key, reverseMap, implementedKeys);

      scores.set(key, {
        directUnblocks: direct.length,
        transitiveUnblocks: transitive.size,
        score: direct.length * 2 + transitive.size,
        directDependents: direct,
      });
    }
  }

  return scores;
}
