import type { PipelineArtifact } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import { stepContentHash } from '@/lib/judge/contentHash';
import { labContentHash } from './labContentDrift';

/**
 * The VERDICT-ONLY projection of a persisted pipeline artifact — what a whole-project
 * reader (the cross-catalog coach) actually consumes, with the produced `data` and
 * `ueAssets` blobs left on the server.
 *
 * ── Why this exists (measured, not assumed) ────────────────────────────────────
 * Opening the lab fans out one whole-catalog GET per registered catalog
 * (`useGlobalCoach` → `CATALOG_SECTIONS`, 36 of them) purely to rank a top-5 list. On the
 * real `~/.pof/pof.db` (817 artifacts across 33 catalogs) that is **7.41 MB** of JSON —
 * produce bodies write 10–60× what any View renders — and ~13 ms of main-thread
 * `JSON.parse` on first paint. The same rows projected through this type are **134 KB**
 * (56× smaller) and parse in under a millisecond.
 *
 * ── Why it carries two hashes ─────────────────────────────────────────────────
 * The coach does not only read a status: it also detects local-vs-server CONTENT drift and
 * binds judge verdicts to the content on record. Both are hash comparisons, so both survive
 * a blob-free payload — but only if the hashes come from the SAME functions the full path
 * uses. Nothing here invents a fingerprint rule:
 *  - `contentHash` is {@link stepContentHash} — the judge-verdict binding hash, fed straight
 *    into `JudgedContent.hash`;
 *  - `driftHash` is {@link labContentHash} — the lab's drift fingerprint (content + UE asset
 *    list), compared against the local artifact exactly as `contentDiverges` does.
 * They are emitted separately rather than reconstructed from one another, so this module
 * never encodes an assumption about either function's output format.
 *
 * A summary is a PROJECTION of the same rows, never a second source of truth: the status it
 * carries is the one the server persisted (and the POST route server-grades every write), and
 * anything that grades still goes through `resolveStepAcceptance`.
 */
export interface StepSummary {
  entityId: string;
  step: string;
  /** The persisted checker verdict (the server re-grades on every write). */
  status: AcceptanceStatus;
  tier?: AcceptanceTier;
  reason?: string;
  updatedAt?: string;
  /** `stepContentHash(data)` — binds a judge verdict to the content on record. */
  contentHash: string;
  /** `labContentHash(data, ueAssets)` — the local-vs-server content-drift fingerprint. */
  driftHash: string;
}

/**
 * Project one persisted artifact into its summary. THE one projection — the route and every
 * test read it from here, so a field can never be added to the wire shape without the
 * derivation that consumes it seeing the same rule.
 */
export function toStepSummary(a: PipelineArtifact): StepSummary {
  return {
    entityId: a.entityId,
    step: a.step,
    status: a.status,
    ...(a.tier ? { tier: a.tier } : {}),
    ...(a.reason ? { reason: a.reason } : {}),
    ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
    contentHash: stepContentHash(a.data),
    driftHash: labContentHash(a.data, a.ueAssets),
  };
}
