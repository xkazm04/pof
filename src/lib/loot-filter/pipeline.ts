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

/** Content hash (FNV-1a, hex) of an exported DataTable json: the identity of what was generated. */
export function hashExportJson(json: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Hash of the json the recorded generate artifact exported (its `jsonHash`, else the hash of its
 * stored `json` for rows written before the hash existed); null when nothing was generated.
 */
export function generatedJsonHash(artifacts: PipelineArtifact[]): string | null {
  const gen = artifacts.find((a) => a.step === STEP_GENERATE && a.status === 'pass');
  if (!gen) return null;
  if (typeof gen.data?.jsonHash === 'string') return gen.data.jsonHash;
  return typeof gen.data?.json === 'string' ? hashExportJson(gen.data.json) : null;
}

/** A recorded export is stale when the ruleset's current json no longer hashes to what was generated. */
export function isExportStale(generatedHash: string | null, currentJson: string): boolean {
  return generatedHash !== null && generatedHash !== hashExportJson(currentJson);
}
