/**
 * Canon drift — the pure classifier between the SHIPPED canon (the profile seeds in code, corrected
 * wave after wave by the /diablo loop) and the `project_rules` rows the produce prompts cite.
 *
 * Provenance is what makes it decidable: every row written FROM shipped text records the hash of
 * that text (`shippedHash`). An operator upsert never touches it. So a row whose text still equals
 * its recorded offer is provably untouched and may FOLLOW a correction on its own, while a row
 * that moved away from its offer is an operator's edit and only ever ASKS. A legacy row (no
 * recorded offer) cannot be told apart from an edit, so it asks too — "when a number appears in two
 * places, one of them is wrong: decide which before you automate anything" (registry:
 * design-canon-as-executable-law).
 *
 * Closed vocabulary (registry: hash-pinned-translation-pipeline#drift-classification):
 * - fresh       row text equals the shipped text (stamped if its recorded hash is stale/absent)
 * - follow      row untouched since its recorded offer, shipped moved — auto-applied
 * - edited      operator edit, shipped unmoved since the offer — no finding
 * - conflict    operator edit AND shipped moved — asks
 * - unrecorded  legacy row, no recorded offer, differs from shipped — asks, never auto-written
 * - missing     shipped, never offered, absent — offered as Add
 * - orphaned    a seed id no longer shipped — surfaced; removal is the existing explicit Delete
 * An id that was offered and then deleted gets no verdict: a deleted rule never returns.
 */
import type { ProjectRule } from './types';
import { contentHash } from '@/lib/catalog/reference/hash';

const DEFAULT_PROFILE = 'pof';

export type DriftVerdict = 'fresh' | 'follow' | 'edited' | 'conflict' | 'unrecorded' | 'missing' | 'orphaned';
/** The verdicts that need an operator's decision. */
export type FindingVerdict = Extract<DriftVerdict, 'conflict' | 'unrecorded' | 'missing' | 'orphaned'>;
export const FINDING_VERDICTS: readonly FindingVerdict[] = ['unrecorded', 'conflict', 'missing', 'orphaned'];

/** A project_rules row with its provenance: the hash of the shipped text it was last written from. */
export interface CanonRow extends ProjectRule { shippedHash: string | null }

export interface CanonPlanEntry {
  id: string;
  profile: string;
  verdict: DriftVerdict;
  row?: CanonRow;
  shipped?: ProjectRule;
  /** The hash of the shipped text the row was last written from (null = never recorded). */
  recordedHash: string | null;
  /** The hash of the text that ships NOW (null = no longer shipped). */
  currentHash: string | null;
}

export interface CanonSyncPlan {
  entries: CanonPlanEntry[];
  /** `follow` rules — safe to write with no human step. */
  autoApply: ProjectRule[];
  /** `fresh` rows whose recorded hash is absent or stale — provenance-only write, text untouched. */
  stamp: { id: string; hash: string }[];
  /** Entries that ask the operator. */
  findings: CanonPlanEntry[];
}

/** What the review UI shows per finding (both texts, so the operator decides on the words). */
export interface CanonFinding {
  id: string;
  profile: string;
  verdict: FindingVerdict;
  title: string;
  dbBody: string | null;
  shippedBody: string | null;
  recordedHash: string | null;
  currentHash: string | null;
}

/** An adopt that can still be undone (its replaced row is archived). */
export interface AdoptedRecord { id: string; profile: string; adoptedAt: string; priorBody: string | null }

export interface CanonDrift {
  total: number;
  /** profile → verdict → findings. */
  byProfile: Record<string, Partial<Record<FindingVerdict, CanonFinding[]>>>;
  adopted: AdoptedRecord[];
}

/** The hash of a rule's canon TEXT — every field an adopt writes; never id or timestamps. */
export function canonTextHash(rule: Pick<ProjectRule, 'category' | 'scope' | 'title' | 'body' | 'refs' | 'profile'>): string {
  return contentHash({
    category: rule.category, scope: rule.scope, title: rule.title, body: rule.body,
    refs: rule.refs ?? [], profile: rule.profile ?? DEFAULT_PROFILE,
  });
}

const isFinding = (v: DriftVerdict): v is FindingVerdict => (FINDING_VERDICTS as readonly string[]).includes(v);

/**
 * Classify every shipped rule and every seed-derived row into one action. `offered` is the set of
 * ids the DB was ever offered (the profiles' recorded `.ids` sets).
 */
export function planCanonSync(shipped: readonly ProjectRule[], rows: readonly CanonRow[], offered: ReadonlySet<string>): CanonSyncPlan {
  const rowById = new Map(rows.map((r) => [r.id, r]));
  const shippedIds = new Set(shipped.map((s) => s.id));
  const entries: CanonPlanEntry[] = [];

  for (const s of shipped) {
    const row = rowById.get(s.id);
    const currentHash = canonTextHash(s);
    const base = { id: s.id, profile: s.profile ?? DEFAULT_PROFILE, shipped: s, currentHash };
    if (!row) {
      if (!offered.has(s.id)) entries.push({ ...base, verdict: 'missing', recordedHash: null });
      continue;
    }
    const recordedHash = row.shippedHash;
    const rowHash = canonTextHash(row);
    const verdict: DriftVerdict = rowHash === currentHash ? 'fresh'
      : recordedHash === null ? 'unrecorded'
        : rowHash === recordedHash ? 'follow'
          : recordedHash === currentHash ? 'edited' : 'conflict';
    entries.push({ ...base, row, recordedHash, verdict });
  }

  for (const row of rows) {
    if (shippedIds.has(row.id) || (row.shippedHash === null && !offered.has(row.id))) continue;
    entries.push({ id: row.id, profile: row.profile ?? DEFAULT_PROFILE, row, verdict: 'orphaned', recordedHash: row.shippedHash, currentHash: null });
  }

  return {
    entries,
    autoApply: entries.filter((e) => e.verdict === 'follow').map((e) => e.shipped!),
    stamp: entries.filter((e) => e.verdict === 'fresh' && e.recordedHash !== e.currentHash).map((e) => ({ id: e.id, hash: e.currentHash! })),
    findings: entries.filter((e) => isFinding(e.verdict)),
  };
}

/** Group the plan's findings by profile, then verdict — the shape GET ?view=drift returns. */
export function toCanonDrift(findings: readonly CanonPlanEntry[], adopted: AdoptedRecord[]): CanonDrift {
  const byProfile: CanonDrift['byProfile'] = {};
  for (const e of findings) {
    const verdict = e.verdict as FindingVerdict;
    const f: CanonFinding = {
      id: e.id, profile: e.profile, verdict, title: e.shipped?.title ?? e.row?.title ?? e.id,
      dbBody: e.row?.body ?? null, shippedBody: e.shipped?.body ?? null,
      recordedHash: e.recordedHash, currentHash: e.currentHash,
    };
    ((byProfile[e.profile] ??= {})[verdict] ??= []).push(f);
  }
  return { total: findings.length, byProfile, adopted };
}
