/**
 * Shared builders for harness overhaul-area catalogs.
 *
 * Both ui-overhaul-areas.ts and content-overhaul-areas.ts describe cross-cutting
 * webapp overhaul work as `ModuleArea` records. The `feat()`/`area()` shapes were
 * byte-identical across both files except for the informational default `moduleId`,
 * so they live here once. Each catalog binds its own default moduleId via `makeArea`.
 */

import type { SubModuleId } from '@/types/modules';
import type { ModuleArea, PlannedFeature } from './types';

/** Wrap a feature name in a pending PlannedFeature record. */
export function feat(name: string): PlannedFeature {
  return { id: name, name, status: 'pending', quality: null, lastSession: null };
}

/**
 * Build an `area(id, label, description, features, dependsOn?)` helper bound to a
 * default `moduleId`. For these cross-cutting overhaul areas the moduleId is purely
 * informational, so each catalog picks a representative one.
 */
export function makeArea(moduleId: SubModuleId) {
  return function area(
    id: string,
    label: string,
    description: string,
    features: string[],
    dependsOn: string[] = [],
  ): ModuleArea {
    return {
      id,
      moduleId,
      label,
      description,
      checklistItemIds: [],
      featureNames: features,
      dependsOn,
      status: 'pending',
      features: features.map(feat),
    };
  };
}
