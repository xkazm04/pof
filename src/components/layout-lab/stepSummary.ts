import type { ArtifactVerdictRow } from '@/lib/pipeline-artifacts-db';
import type { AcceptanceStatus, AcceptanceTier } from '@/lib/catalog/acceptance/types';
import { isComparableHash, stepContentHash } from '@/lib/judge/contentHash';
import { driftHashOf } from './labContentDrift';

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
 * The drift hash is built from the content hash through `driftHashOf` — the SAME helper
 * `labContentHash` itself calls — so the rule still lives in one place.
 *
 * Both hashes are read from the STORED `content_hash` column when the row came from the
 * blob-free `listArtifactVerdicts` (no `data` fetched or re-hashed); a full row hashes its `data`.
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
 *
 * Takes a full row (`data` present — hashed, the ground truth) or a verdict read (`data` absent —
 * its comparable stored `contentHash`). A row with neither has no provable binding, and this
 * refuses rather than fingerprint `{}` for a blob nobody read.
 */
export function toStepSummary(a: ArtifactVerdictRow & { ueAssets?: string[] }): StepSummary {
  const contentHash = a.data ? stepContentHash(a.data) : isComparableHash(a.contentHash) ? a.contentHash! : null;
  if (!contentHash) throw new Error(`${a.catalogId}/${a.entityId}/${a.step}: stored content is unreadable and carries no content hash`);
  return {
    entityId: a.entityId,
    step: a.step,
    status: a.status,
    ...(a.tier ? { tier: a.tier } : {}),
    ...(a.reason ? { reason: a.reason } : {}),
    ...(a.updatedAt ? { updatedAt: a.updatedAt } : {}),
    contentHash,
    driftHash: driftHashOf(contentHash, a.ueAssets),
  };
}

/**
 * Lift a summary back into the row shape a GRADER consumes ({@link ArtifactVerdictRow}) — the
 * inverse of {@link toStepSummary}, kept beside it so the projection and its inverse cannot
 * drift apart.
 *
 * `catalogId` is re-attached from the fetch key: the wire shape omits it because every summary
 * in a response belongs to the catalog that was asked for, and the capability model keys its
 * evidence by `(catalog, entity, step)`.
 *
 * It carries NO `data` on purpose. That is the whole point of the projection — and the reason
 * `contentHash` rides along: with the binding on the row, `statusModel.judgedContentOfRow` can
 * check a verdict against the content on record without the blob it was computed from.
 */
export function summaryToVerdictRow(catalogId: string, s: StepSummary): ArtifactVerdictRow {
  return {
    catalogId,
    entityId: s.entityId,
    step: s.step,
    status: s.status,
    ...(s.tier ? { tier: s.tier } : {}),
    ...(s.reason ? { reason: s.reason } : {}),
    ...(s.updatedAt ? { updatedAt: s.updatedAt } : {}),
    contentHash: s.contentHash,
  };
}
