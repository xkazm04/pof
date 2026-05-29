/**
 * Persist an Observation to pipeline_artifacts so a Verdict can cite its evidence.
 * The actual DB writer is injected (testable); the production caller passes the
 * real pipeline_artifacts insert.
 */
import type { Observation } from './types';

export interface ObservationKey {
  catalogId: string;
  entityId: string;
  step: string;
}

export type ArtifactWriter = (key: ObservationKey, obs: Observation) => Promise<string>;

export async function recordObservation(
  key: ObservationKey,
  obs: Observation,
  writer: ArtifactWriter,
): Promise<string> {
  const ref = await writer(key, obs);
  obs.artifactRef = ref;
  return ref;
}
