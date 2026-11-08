/**
 * Structural integrity of EVERY shipped canon rule, across all profiles.
 *
 * `validateRuleDraft` refuses an operator upsert whose scope names no registered catalog (a law
 * nobody's prompt cites), but the SHIPPED seeds never pass through it: they are written straight
 * into `project_rules` by the one-time seed + canon sync. Only the diablo1 profile pinned its scopes
 * and ids; PoF's own `CANON_SEED` (68 rules) did not, and nothing checked that ids stay unique
 * ACROSS profiles — `project_rules` is keyed by id, so a collision makes one profile's law
 * silently replace another's.
 */
import { describe, it, expect } from 'vitest';
import '@/lib/catalog/pipelines/registry.generated';
import { allCatalogPipelines } from '@/lib/catalog/pipeline-registry';
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { CANON_PROFILES, allShippedRules } from '@/lib/catalog/canon/profiles';
import { validateRuleDraft } from '@/lib/catalog/canon/validation';
import type { ProjectRule } from '@/lib/catalog/canon/types';

const pipelines = allCatalogPipelines();
const shipped = allShippedRules(CANON_SEED);

/** Every shipped rule the route's own upsert check would refuse, with its reason. */
function refusedShipped(rules: readonly ProjectRule[]): string[] {
  return rules.flatMap((r) => {
    const v = validateRuleDraft(r, pipelines);
    return v.ok ? [] : [`${r.id}: ${v.error}`];
  });
}

function duplicateIds(rules: readonly ProjectRule[]): string[] {
  const seen = new Set<string>();
  return rules.filter((r) => (seen.has(r.id) ? true : (seen.add(r.id), false))).map((r) => r.id);
}

describe('shipped canon integrity (all profiles)', () => {
  it('the checks bite on an unknown scope and on a cross-profile id collision', () => {
    const bad: ProjectRule = { ...CANON_SEED[0], scope: 'no-such-catalog' };
    expect(refusedShipped([bad])).toHaveLength(1);
    const collision: ProjectRule = { ...CANON_SEED[0], profile: 'diablo1' };
    expect(duplicateIds([...shipped, collision])).toEqual([CANON_SEED[0].id]);
  });

  it('covers PoF and every registered profile seed', () => {
    const expected = CANON_SEED.length + Object.values(CANON_PROFILES).reduce((n, p) => n + p.seed.length, 0);
    expect(shipped).toHaveLength(expected);
    expect(CANON_SEED.length).toBeGreaterThan(50);
  });

  it('every shipped rule passes the same check an operator upsert must (scope reaches a prompt)', () => {
    expect(refusedShipped(shipped)).toEqual([]);
  });

  it('rule ids are unique across ALL profiles (project_rules is keyed by id)', () => {
    expect(duplicateIds(shipped)).toEqual([]);
  });

  it("PoF's own seed carries no profile tag; each profile seed carries exactly its own", () => {
    expect(CANON_SEED.filter((r) => r.profile !== undefined).map((r) => r.id)).toEqual([]);
    for (const p of Object.values(CANON_PROFILES)) {
      expect(p.seed.filter((r) => r.profile !== p.id).map((r) => r.id)).toEqual([]);
    }
  });
});
