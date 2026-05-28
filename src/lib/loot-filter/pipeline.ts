import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceTier } from '@/lib/catalog/acceptance/types';
import type { LifecycleState } from '@/lib/catalog/types';

/** Catalog id under which loot-filter rulesets are tracked in `pipeline_artifacts`. */
export const LOOT_FILTER_CATALOG_ID = 'loot-filter';

/** Pipeline step names (one artifact row each), in lifecycle order. */
export const STEP_GENERATE = 'datatable';
export const STEP_WIRE = 'wire';
export const STEP_VERIFY = 'verify';

/** Acceptance tier each step proves (data → wired-config → live-runtime). */
export const STEP_TIER: Record<string, AcceptanceTier> = {
  [STEP_GENERATE]: 'L0',
  [STEP_WIRE]: 'L2',
  [STEP_VERIFY]: 'L3',
};

/** Derive a ruleset's lifecycle from its persisted pipeline artifacts (the pipeline truth). */
export function deriveLifecycle(artifacts: PipelineArtifact[]): LifecycleState {
  const byStep = new Map(artifacts.map((a) => [a.step, a]));
  const passed = (step: string) => byStep.get(step)?.status === 'pass';
  if (passed(STEP_VERIFY)) return 'verified';
  if (passed(STEP_WIRE)) return 'wired';
  if (passed(STEP_GENERATE)) return 'generated';
  if (byStep.get(STEP_GENERATE)?.status === 'fail') return 'failed';
  return 'planned';
}
