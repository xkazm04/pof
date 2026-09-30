/**
 * The step-binding door (SERVER-ONLY — reads `pipeline_artifacts`).
 *
 * Every verdict writer answers the same question: WHICH content did this verdict read? Judge
 * verdicts and craft gauges used to answer it two ways at two write seams — the judge route
 * fingerprinted the artifact (`stepContentHash`), the craft route recorded only the row's write
 * time. Write time is not content: drains, static-verify and packaging-verify all re-upsert
 * IDENTICAL data and still bump `updated_at`, so a timestamp-bound gauge read stale the moment a
 * gate touched the row. Both routes now stamp through this one function, so a future verdict
 * writer binds the same way without opting in.
 *
 * `updatedAt` is returned beside the hash because a hash-less (legacy) verdict still needs its
 * timestamp anchor, and so does a reader that cannot prove a hash.
 */
import { getArtifact } from '@/lib/pipeline-artifacts-db';
import { stepContentHash } from './contentHash';

export interface StepBinding {
  /** `stepContentHash(artifact.data)` — THE fingerprint rule (`contentHash.ts`). */
  contentHash: string;
  /** The artifact row's `updated_at` when the binding was read. */
  updatedAt?: string;
}

/**
 * The binding for the ONE artifact on record at (catalog, entity, step), read by primary key.
 * `null` when the step has no artifact — never a fabricated binding (`stepContentHash(undefined)`
 * would fingerprint `{}`).
 */
export function currentStepBinding(catalogId: string, entityId: string, step: string): StepBinding | null {
  const art = getArtifact(catalogId, entityId, step);
  if (!art) return null;
  return { contentHash: stepContentHash(art.data), ...(art.updatedAt ? { updatedAt: art.updatedAt } : {}) };
}
