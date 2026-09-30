/**
 * Canon PROFILES — which world a produce prompt is written for.
 *
 * The canon used to be one corpus describing PoF's own game (post-Sundering dark fantasy,
 * painterly-realistic art). Replicating another game (the `/diablo` loop) needs that game's world
 * and art direction in its entities' prompts — and ONLY in theirs: the lab shows PoF and Diablo
 * entities side by side, so the profile is resolved PER ENTITY, never by a global switch that
 * would leak one world into the other's prompts.
 *
 * - A profile is a minted id (`pof`, `diablo1`), never a display name (registry: multi-project —
 *   identity survives renames).
 * - A rule belongs to exactly one profile (`ProjectRule.profile`, absent = `pof`), so each rule
 *   still has exactly one statement (registry: design-canon-as-executable-law).
 * - A profile may INHERIT named `pof` rules by id — engineering conventions that are true in any
 *   world (asset naming, source-of-truth, cross-catalog links). Inheritance is explicit and by id,
 *   not by category, because PoF's `project` category mixes engineering law with design law
 *   (`proj-balance` is a balance envelope, not a convention).
 */
import type { ProjectRule } from './types';
import { DIABLO1_CANON, DIABLO1_INHERITS_POF } from './profiles/diablo1';
import { DIABLO1_CREATURE_STYLE_DNA, DIABLO1_STYLE_DNA } from '@/lib/catalog/canon/profiles/diablo1Style';
import type { StyleDna } from '@/lib/visual-gen/style-dna';
import type { SubjectClass } from '@/lib/catalog/canon/subjectClass';

export const DEFAULT_CANON_PROFILE = 'pof';

export interface CanonProfile {
  id: string;
  title: string;
  /** `pof` rule ids this profile adopts unchanged. */
  inheritsPof: readonly string[];
  /** The profile's own shipped rules (seeded once per DB, like `CANON_SEED`). */
  seed: readonly ProjectRule[];
  /**
   * The profile's generation-ready style (/diablo W03, D13b) — used for its entities' images when
   * no Style DNA is bound to the profile in the DB (`styleDnaForProfile`). The project's own profile
   * has none here: its style is the DB's active Style DNA, as before.
   */
  styleDna?: StyleDna;
  /**
   * Per-subject-class variants of `styleDna` (/diablo W04, D15) — a class not listed falls back to
   * `styleDna`. A universal style carrying environment cues turned a creature's anatomy (W03).
   */
  styleDnaByClass?: Partial<Record<SubjectClass, StyleDna>>;
}

export const CANON_PROFILES: Readonly<Record<string, CanonProfile>> = {
  pof: { id: 'pof', title: 'Pillars of Fortune (own game)', inheritsPof: [], seed: [] },
  diablo1: {
    id: 'diablo1', title: 'Diablo I (1996) — reference replication', inheritsPof: DIABLO1_INHERITS_POF, seed: DIABLO1_CANON,
    styleDna: DIABLO1_STYLE_DNA,
    styleDnaByClass: { creature: DIABLO1_CREATURE_STYLE_DNA },
  },
};

export const profileOfRule = (r: Pick<ProjectRule, 'profile'>): string => r.profile ?? DEFAULT_CANON_PROFILE;

/**
 * The profile an entity's prompts are written for. Only an ingested entity carries one
 * (`provenance.canonProfile`, stamped from its reference source); everything else is PoF's.
 */
export function canonProfileOf(entity: { provenance?: { canonProfile?: string } } | null | undefined): string {
  return entity?.provenance?.canonProfile ?? DEFAULT_CANON_PROFILE;
}

/** The provenance fields a produce prompt cites for an ingested entity. */
export interface LabReference {
  sourceGame: string;
  sourceFile: string;
  sourceRow: string;
}

/**
 * Everything a `LabEntity` must carry from a stored entity beyond id/name/lifecycle/data — ONE helper
 * for all four constructors, so a new field cannot be dropped by one path (the LabEntity is exactly
 * where provenance used to be lost).
 */
export function labIdentityOf(entity: { provenance?: Partial<LabReference> & { canonProfile?: string } } | null | undefined): {
  canonProfile: string;
  reference?: LabReference;
} {
  const p = entity?.provenance;
  const reference = p?.sourceGame && p.sourceFile && p.sourceRow
    ? { sourceGame: p.sourceGame, sourceFile: p.sourceFile, sourceRow: p.sourceRow }
    : undefined;
  return { canonProfile: canonProfileOf(entity), ...(reference ? { reference } : {}) };
}

/**
 * The rules in force for a profile: its own, plus the `pof` rules it inherits by id.
 * An UNKNOWN profile throws — silently resolving it to no canon (or to PoF's) would put the
 * wrong world, or none, into a prompt and nothing would say so.
 */
export function rulesForProfile(rules: readonly ProjectRule[], profileId: string): ProjectRule[] {
  const profile = CANON_PROFILES[profileId];
  if (!profile) throw new Error(`Unknown canon profile "${profileId}" — registered: ${Object.keys(CANON_PROFILES).join(', ')}`);
  if (profileId === DEFAULT_CANON_PROFILE) return rules.filter((r) => profileOfRule(r) === DEFAULT_CANON_PROFILE);
  const inherited = new Set(profile.inheritsPof);
  return rules.filter((r) => {
    const p = profileOfRule(r);
    return p === profileId || (p === DEFAULT_CANON_PROFILE && inherited.has(r.id));
  });
}

/** Every shipped rule across profiles — the offline fallback and the one-time DB seeds. */
export function allShippedRules(pofSeed: readonly ProjectRule[]): ProjectRule[] {
  return [...pofSeed, ...Object.values(CANON_PROFILES).flatMap((p) => p.seed)];
}
