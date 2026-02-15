import { MODULE_FEATURE_DEFINITIONS, type FeatureDefinition } from './feature-definitions';

// ── Types ──

export interface OverlapPair {
  /** First module in the overlap */
  moduleA: string;
  /** Second module in the overlap */
  moduleB: string;
  /** Feature from module A */
  featureA: string;
  /** Feature from module B */
  featureB: string;
  /** Description from module A */
  descriptionA: string;
  /** Description from module B */
  descriptionB: string;
  /** Similarity score 0–1 */
  similarity: number;
  /** How the overlap was detected */
  reason: 'name_match' | 'description_similarity' | 'shared_category_keywords';
  /** Suggested owner module based on dependency analysis */
  suggestedOwner: string;
  /** Why this module is suggested */
  ownershipReason: string;
}

export interface ModuleOverlapSummary {
  moduleId: string;
  overlapCount: number;
  overlappingModules: string[];
  topOverlaps: OverlapPair[];
}

export interface OverlapReport {
  totalOverlaps: number;
  overlaps: OverlapPair[];
  moduleSummaries: ModuleOverlapSummary[];
  /** Timestamp of analysis */
  analyzedAt: number;
}

// ── Stop words for keyword extraction ──

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'be',
  'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
  'would', 'could', 'should', 'may', 'might', 'can', 'shall', 'not',
  'this', 'that', 'these', 'those', 'it', 'its', 'all', 'each', 'per',
  'any', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
  'nor', 'only', 'own', 'same', 'so', 'than', 'too', 'very',
]);

// ── Keyword extraction ──

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

// ── Jaccard similarity on keyword sets ──

function jaccardSimilarity(setA: Set<string>, setB: Set<string>): number {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection++;
  }
  const union = setA.size + setB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

// ── Fuzzy name match ──

function nameOverlapScore(nameA: string, nameB: string): number {
  const wordsA = new Set(extractKeywords(nameA));
  const wordsB = new Set(extractKeywords(nameB));
  return jaccardSimilarity(wordsA, wordsB);
}

// ── Dependency depth scoring ──

function computeDependencyDepths(moduleId: string): Map<string, number> {
  const features = MODULE_FEATURE_DEFINITIONS[moduleId] ?? [];
  const depths = new Map<string, number>();
  const featureNames = new Set(features.map((f) => f.featureName));

  function getDepth(featureName: string, visited: Set<string>): number {
    if (depths.has(featureName)) return depths.get(featureName)!;
    if (visited.has(featureName)) return 0;
    visited.add(featureName);

    const feat = features.find((f) => f.featureName === featureName);
    if (!feat?.dependsOn) {
      depths.set(featureName, 0);
      return 0;
    }

    let maxDepth = 0;
    for (const dep of feat.dependsOn) {
      // Only count same-module dependencies for depth
      if (!dep.includes('::') && featureNames.has(dep)) {
        maxDepth = Math.max(maxDepth, getDepth(dep, visited) + 1);
      }
    }
    depths.set(featureName, maxDepth);
    return maxDepth;
  }

  for (const f of features) {
    getDepth(f.featureName, new Set());
  }
  return depths;
}

// ── Count cross-module dependents ──

function countCrossModuleDependents(moduleId: string, featureName: string): number {
  let count = 0;
  const qualifiedName = `${moduleId}::${featureName}`;
  for (const [mid, features] of Object.entries(MODULE_FEATURE_DEFINITIONS)) {
    if (mid === moduleId) continue;
    for (const f of features) {
      if (f.dependsOn?.includes(qualifiedName)) {
        count++;
      }
    }
  }
  return count;
}

// ── Suggest owner based on heuristics ──

function suggestOwner(
  moduleA: string,
  featureA: FeatureDefinition,
  moduleB: string,
  featureB: FeatureDefinition,
): { owner: string; reason: string } {
  // Heuristic 1: Module with more cross-module dependents should own
  const depsA = countCrossModuleDependents(moduleA, featureA.featureName);
  const depsB = countCrossModuleDependents(moduleB, featureB.featureName);
  if (depsA > depsB) return { owner: moduleA, reason: `${depsA} other modules depend on this feature in ${moduleA}` };
  if (depsB > depsA) return { owner: moduleB, reason: `${depsB} other modules depend on this feature in ${moduleB}` };

  // Heuristic 2: Module where the feature has deeper dependency chain owns it
  const depthsA = computeDependencyDepths(moduleA);
  const depthsB = computeDependencyDepths(moduleB);
  const depthA = depthsA.get(featureA.featureName) ?? 0;
  const depthB = depthsB.get(featureB.featureName) ?? 0;
  if (depthA > depthB) return { owner: moduleA, reason: `Deeper dependency chain (depth ${depthA}) in ${moduleA}` };
  if (depthB > depthA) return { owner: moduleB, reason: `Deeper dependency chain (depth ${depthB}) in ${moduleB}` };

  // Heuristic 3: Feature name closer to module name
  const nameMatchA = nameOverlapScore(featureA.featureName, moduleA.replace(/-/g, ' '));
  const nameMatchB = nameOverlapScore(featureB.featureName, moduleB.replace(/-/g, ' '));
  if (nameMatchA > nameMatchB) return { owner: moduleA, reason: `Feature name aligns more with ${moduleA} module scope` };
  if (nameMatchB > nameMatchA) return { owner: moduleB, reason: `Feature name aligns more with ${moduleB} module scope` };

  // Default: module with more total features is likely more comprehensive
  const countA = MODULE_FEATURE_DEFINITIONS[moduleA]?.length ?? 0;
  const countB = MODULE_FEATURE_DEFINITIONS[moduleB]?.length ?? 0;
  if (countA >= countB) return { owner: moduleA, reason: `${moduleA} has broader feature scope (${countA} features)` };
  return { owner: moduleB, reason: `${moduleB} has broader feature scope (${countB} features)` };
}

// ── Main analysis ──

const NAME_THRESHOLD = 0.4;
const DESCRIPTION_THRESHOLD = 0.35;

export function analyzeOverlaps(): OverlapReport {
  const overlaps: OverlapPair[] = [];
  const moduleIds = Object.keys(MODULE_FEATURE_DEFINITIONS);
  const seen = new Set<string>();

  for (let i = 0; i < moduleIds.length; i++) {
    for (let j = i + 1; j < moduleIds.length; j++) {
      const moduleA = moduleIds[i];
      const moduleB = moduleIds[j];
      const featuresA = MODULE_FEATURE_DEFINITIONS[moduleA];
      const featuresB = MODULE_FEATURE_DEFINITIONS[moduleB];

      for (const fA of featuresA) {
        const kwA = new Set(extractKeywords(fA.description));
        const nameKwA = new Set(extractKeywords(fA.featureName));

        for (const fB of featuresB) {
          const pairKey = [moduleA, fA.featureName, moduleB, fB.featureName].sort().join('|');
          if (seen.has(pairKey)) continue;

          // Check name similarity
          const nameKwB = new Set(extractKeywords(fB.featureName));
          const nameSim = jaccardSimilarity(nameKwA, nameKwB);

          if (nameSim >= NAME_THRESHOLD) {
            seen.add(pairKey);
            const { owner, reason } = suggestOwner(moduleA, fA, moduleB, fB);
            overlaps.push({
              moduleA, moduleB,
              featureA: fA.featureName, featureB: fB.featureName,
              descriptionA: fA.description, descriptionB: fB.description,
              similarity: nameSim,
              reason: 'name_match',
              suggestedOwner: owner, ownershipReason: reason,
            });
            continue;
          }

          // Check description similarity
          const kwB = new Set(extractKeywords(fB.description));
          const descSim = jaccardSimilarity(kwA, kwB);

          if (descSim >= DESCRIPTION_THRESHOLD) {
            seen.add(pairKey);
            const { owner, reason } = suggestOwner(moduleA, fA, moduleB, fB);
            overlaps.push({
              moduleA, moduleB,
              featureA: fA.featureName, featureB: fB.featureName,
              descriptionA: fA.description, descriptionB: fB.description,
              similarity: descSim,
              reason: 'description_similarity',
              suggestedOwner: owner, ownershipReason: reason,
            });
            continue;
          }

          // Check shared category + keyword overlap (lower threshold combo)
          if (fA.category === fB.category && descSim >= 0.2) {
            seen.add(pairKey);
            const combinedSim = (descSim + 0.3) * 0.8; // Boost for shared category
            const { owner, reason } = suggestOwner(moduleA, fA, moduleB, fB);
            overlaps.push({
              moduleA, moduleB,
              featureA: fA.featureName, featureB: fB.featureName,
              descriptionA: fA.description, descriptionB: fB.description,
              similarity: combinedSim,
              reason: 'shared_category_keywords',
              suggestedOwner: owner, ownershipReason: reason,
            });
          }
        }
      }
    }
  }

  // Sort by similarity descending
  overlaps.sort((a, b) => b.similarity - a.similarity);

  // Build module summaries
  const summaryMap = new Map<string, { modules: Set<string>; overlaps: OverlapPair[] }>();
  for (const o of overlaps) {
    for (const mid of [o.moduleA, o.moduleB]) {
      if (!summaryMap.has(mid)) summaryMap.set(mid, { modules: new Set(), overlaps: [] });
      const entry = summaryMap.get(mid)!;
      entry.modules.add(mid === o.moduleA ? o.moduleB : o.moduleA);
      entry.overlaps.push(o);
    }
  }

  const moduleSummaries: ModuleOverlapSummary[] = Array.from(summaryMap.entries())
    .map(([moduleId, data]) => ({
      moduleId,
      overlapCount: data.overlaps.length,
      overlappingModules: Array.from(data.modules),
      topOverlaps: data.overlaps.slice(0, 5),
    }))
    .sort((a, b) => b.overlapCount - a.overlapCount);

  return {
    totalOverlaps: overlaps.length,
    overlaps,
    moduleSummaries,
    analyzedAt: Date.now(),
  };
}
