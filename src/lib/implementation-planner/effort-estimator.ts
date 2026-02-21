import type { SubModuleId } from '@/types/modules';
import { MODULE_FEATURE_DEFINITIONS, type FeatureDefinition } from '@/lib/feature-definitions';

export type EffortLevel = 'trivial' | 'small' | 'medium' | 'large';

export interface EffortEstimate {
  level: EffortLevel;
  /** Estimated time in minutes */
  minutes: number;
  /** Why this estimate */
  reason: string;
}

const EFFORT_VALUES: Record<EffortLevel, number> = {
  trivial: 15,
  small: 30,
  medium: 60,
  large: 120,
};

// Categories that tend toward higher effort
const HIGH_EFFORT_CATEGORIES = new Set([
  'Replication', 'Serialization', 'Streaming', 'Procedural',
  'PostProcess', 'Coordination', 'Migration', 'Automation',
  'Optimization', 'Performance',
]);

// Categories that tend toward lower effort
const LOW_EFFORT_CATEGORIES = new Set([
  'Data', 'Config', 'Tags', 'Actions', 'Debug',
  'Design', 'Settings',
]);

// Keywords in descriptions that suggest complexity
const COMPLEXITY_KEYWORDS = [
  'multi-phase', 'replicated', 'serializ', 'procedural',
  'async', 'thread', 'pipeline', 'framework', 'subsystem',
];

const SIMPLE_KEYWORDS = [
  'configure', 'setup', 'data asset', 'enum', 'settings',
  'placeholder', 'basic', 'simple',
];

/**
 * Estimate effort for a single feature based on heuristics.
 */
export function estimateEffort(
  moduleId: SubModuleId,
  featureName: string,
): EffortEstimate {
  const features = MODULE_FEATURE_DEFINITIONS[moduleId];
  if (!features) {
    return { level: 'medium', minutes: 60, reason: 'Unknown module' };
  }

  const feat = features.find((f) => f.featureName === featureName);
  if (!feat) {
    return { level: 'medium', minutes: 60, reason: 'Unknown feature' };
  }

  return estimateFromDefinition(feat);
}

function estimateFromDefinition(feat: FeatureDefinition): EffortEstimate {
  let score = 0; // Higher = more effort
  const reasons: string[] = [];

  // Dependency count (more deps = more integration work)
  const depCount = feat.dependsOn?.length ?? 0;
  if (depCount >= 3) {
    score += 2;
    reasons.push(`${depCount} deps`);
  } else if (depCount >= 1) {
    score += 1;
  }

  // Cross-module dependencies add complexity
  const crossModuleDeps = (feat.dependsOn ?? []).filter((d) => d.includes('::'));
  if (crossModuleDeps.length >= 2) {
    score += 2;
    reasons.push('cross-module');
  } else if (crossModuleDeps.length === 1) {
    score += 1;
  }

  // Category heuristics
  if (HIGH_EFFORT_CATEGORIES.has(feat.category)) {
    score += 2;
    reasons.push(feat.category);
  } else if (LOW_EFFORT_CATEGORIES.has(feat.category)) {
    score -= 1;
    reasons.push(`simple ${feat.category}`);
  }

  // Description analysis
  const descLower = feat.description.toLowerCase();
  for (const kw of COMPLEXITY_KEYWORDS) {
    if (descLower.includes(kw)) {
      score += 1;
      reasons.push(kw);
      break;
    }
  }
  for (const kw of SIMPLE_KEYWORDS) {
    if (descLower.includes(kw)) {
      score -= 1;
      reasons.push('simple');
      break;
    }
  }

  // Description length as proxy for complexity
  if (feat.description.length > 80) {
    score += 1;
  }

  // Map score to effort level
  let level: EffortLevel;
  if (score <= 0) level = 'trivial';
  else if (score <= 2) level = 'small';
  else if (score <= 4) level = 'medium';
  else level = 'large';

  return {
    level,
    minutes: EFFORT_VALUES[level],
    reason: reasons.length > 0 ? reasons.join(', ') : 'baseline',
  };
}

/**
 * Estimate total effort for a set of features.
 */
export function estimateTotalMinutes(
  features: Array<{ moduleId: SubModuleId; featureName: string }>,
): number {
  return features.reduce((sum, f) => {
    const est = estimateEffort(f.moduleId, f.featureName);
    return sum + est.minutes;
  }, 0);
}

export function formatEffortTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
