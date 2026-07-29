/**
 * Tag Audit — derive a gameplay-tag hygiene score from the delta between the
 * tags DECLARED in UE5 C++ source (`UE_DEFINE_GAMEPLAY_TAG_COMMENT`) and the
 * tags REFERENCED by authored ability rules/specs (an ability's ability /
 * cooldown / activation-owned / activation-blocked tag references).
 *
 * The score is the **agreement** between the two sets — the fraction of all
 * distinct tags (declared or referenced) that appear on BOTH sides:
 *
 *     matched    = declared ∩ referenced   (defined and used)
 *     undeclared = referenced \ declared   (used but never defined — a bug)
 *     orphaned   = declared \ referenced   (defined but never used — dead tag)
 *     score      = round( matched / (matched + undeclared + orphaned) × 100 )
 *
 * This is the Jaccard index of the two sets scaled to 0-100. It is fully
 * explainable: every point lost corresponds to a *named* undeclared or orphaned
 * tag listed in the breakdown. A perfect 100 means every declared tag is used
 * and every referenced tag is declared. Both discrepancy kinds weigh equally —
 * a missing definition and a dead declaration each cost one slot in the union.
 *
 * Empty on both sides (nothing to reconcile) scores 100 by vacuous truth; the
 * UI gates the "no live source parsed" case separately (see `TagAuditSection`)
 * and never calls this with an empty declared set to imply a real audit.
 *
 * This module is pure — no I/O, no React — so it is unit-testable and can run
 * on either side of the UE5 source-parse seam.
 */

import type { EnrichedAbilitySpec } from '@/lib/ability/spec';
import { toDottedTag, toDottedTags } from '@/lib/ability/tag-dialect';

export interface TagAuditBreakdown {
  /** Derived 0-100 hygiene score (rounded). */
  score: number;
  /** Tags both declared in source and referenced by a rule (sorted). */
  matched: string[];
  /** Tags referenced by a rule but never declared in source (sorted) — errors. */
  undeclared: string[];
  /** Tags declared in source but referenced by no rule (sorted) — dead tags. */
  orphaned: string[];
  /** Distinct declared-tag count (post de-dupe). */
  declaredCount: number;
  /** Distinct referenced-tag count (post de-dupe). */
  referencedCount: number;
  /**
   * The subset of referenced tags contributed by APP-authored `ability_specs`
   * (as opposed to the UE5 C++ ability rules). Sorted. Empty when the audit was
   * computed from UE source alone — which is exactly the blind spot this field
   * exists to make visible.
   */
  appReferenced: string[];
}

/**
 * Tags an app-authored {@link EnrichedAbilitySpec} references: every tag rule's
 * source/target plus each effect's granted tags, normalized to the dotted
 * dialect and de-duped. Pure — this is the app-side counterpart of the parser's
 * ability/cooldown/activation tag extraction.
 */
export function specTagReferences(specs: readonly EnrichedAbilitySpec[]): string[] {
  const raw: string[] = [];
  for (const spec of specs) {
    for (const rule of spec.tagRules ?? []) {
      raw.push(rule.sourceTag, rule.targetTag);
    }
    for (const effect of spec.effects ?? []) {
      raw.push(...(effect.grantedTags ?? []));
    }
  }
  return toDottedTags(raw).sort();
}

/**
 * De-dupe, trim, normalize to the dotted dialect, and drop empty entries —
 * tolerant of raw parser output AND of app-authored tags that still carry the
 * forge's C++ underscore spelling.
 */
function toTagSet(tags: readonly string[]): Set<string> {
  const set = new Set<string>();
  for (const raw of tags) {
    const tag = toDottedTag(raw ?? '');
    if (tag) set.add(tag);
  }
  return set;
}

/**
 * Compute the tag audit from declared tags (parsed source), the tags referenced
 * by the parsed UE5 ability rules, and — as a DISTINCT third source — the tags
 * referenced by app-authored `ability_specs` (see {@link specTagReferences}).
 * App tags join the referenced set (an app tag with no C++ declaration is a real
 * undeclared-tag bug) and are also reported separately as `appReferenced`, so
 * the breakdown never hides which side of the seam a tag came from.
 * Order-independent; duplicates collapse.
 */
export function computeTagAudit(
  parsedTags: readonly string[],
  authoredRules: readonly string[],
  appAuthoredTags: readonly string[] = [],
): TagAuditBreakdown {
  const declared = toTagSet(parsedTags);
  const appSet = toTagSet(appAuthoredTags);
  const referenced = toTagSet([...authoredRules, ...appSet]);

  const matched: string[] = [];
  const undeclared: string[] = [];
  const orphaned: string[] = [];

  for (const tag of referenced) {
    if (declared.has(tag)) matched.push(tag);
    else undeclared.push(tag);
  }
  for (const tag of declared) {
    if (!referenced.has(tag)) orphaned.push(tag);
  }

  const union = matched.length + undeclared.length + orphaned.length;
  const score = union === 0 ? 100 : Math.round((matched.length / union) * 100);

  return {
    score,
    matched: matched.sort(),
    undeclared: undeclared.sort(),
    orphaned: orphaned.sort(),
    declaredCount: declared.size,
    referencedCount: referenced.size,
    appReferenced: [...appSet].sort(),
  };
}
