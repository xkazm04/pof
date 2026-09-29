import { TaskFactory, type FeatureReviewTask } from '@/lib/cli-task';
import { MODULE_FEATURE_DEFINITIONS } from '@/lib/feature-definitions';
import type { SubModuleId } from '@/types/modules';

/**
 * Asset Scout's one-click review: a feature-review CLITask over exactly the named
 * features of `moduleId` that are defined in MODULE_FEATURE_DEFINITIONS (in
 * definition order; unknown names are dropped). Returns null when none match, so a
 * caller never dispatches an empty review.
 */
export function scoutReviewTask(
  moduleId: string,
  featureNames: readonly string[],
  appOrigin: string,
  moduleLabel?: string,
): FeatureReviewTask | null {
  const wanted = new Set(featureNames);
  const defs = (MODULE_FEATURE_DEFINITIONS[moduleId as SubModuleId] ?? []).filter((d) => wanted.has(d.featureName));
  if (defs.length === 0) return null;
  const label = moduleLabel ?? moduleId;
  return TaskFactory.featureReview(moduleId as SubModuleId, label, defs, appOrigin, `${label} Review`);
}
