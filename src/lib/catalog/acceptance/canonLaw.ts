/**
 * Canon-LAW invariants are graded only where the law exists (/diablo W02, operator decision:
 * "explicit 'ungraded' now, derive laws per wave").
 *
 * A content invariant enforces a threshold parsed from a canon rule (`proj-balance`,
 * `arpg-monster-rarity`, …). Those rules are PoF's own design law. Under another canon profile
 * (an ingested Diablo entity) the law may not exist — and grading Diablo content against PoF's
 * numbers would pass or fail it for being Diablo, not for being wrong. So a law-backed checker asks
 * the context which profile the entity is written for and, where that profile carries no such law,
 * returns an explicit UNGRADED verdict: `pending` (it is not verified, and not known to be wrong)
 * with a greppable reason naming the missing law. It is never a silent pass (registry:
 * unmeasured-is-not-a-pass), and each one is an adjustment the loop can count and close.
 *
 * World-neutral invariants (arithmetic reconciliation, declared bands) carry no law and grade
 * under every profile — they are not wrapped.
 */
import { CANON_SEED } from '@/lib/catalog/canon/canon-seed';
import { DEFAULT_CANON_PROFILE, allShippedRules, rulesForProfile } from '@/lib/catalog/canon/profiles';
import { markContentInvariant } from './contentInvariant';
import { UNGRADED_MARKER } from './markers';
import type { AcceptanceResult, Checker } from './types';

const CANON_LAW = Symbol.for('pof.canonLaw');

/** Is `lawId` a rule in force for `profileId`? Read from the SHIPPED canon — the same source the thresholds are parsed from. */
export function lawInForce(profileId: string, lawId: string): boolean {
  if (profileId === DEFAULT_CANON_PROFILE) return true;
  return rulesForProfile(allShippedRules(CANON_SEED), profileId).some((r) => r.id === lawId);
}

/** The law a checker enforces, if it is a canon-law checker. */
export function canonLawOf(checker: Checker): string | undefined {
  return (checker as unknown as Record<symbol, string | undefined>)[CANON_LAW];
}

export function ungradedByProfile(label: string, lawId: string, profileId: string): AcceptanceResult {
  return {
    label, tier: 'L0', status: 'pending',
    detail: `ungraded under canon profile "${profileId}"`,
    reason: `${UNGRADED_MARKER}: content invariant "${lawId}" is PoF law and is not law under canon profile `
      + `"${profileId}" — there is no threshold to grade this against yet (derive it from the reference).`,
  };
}

/** Wrap a law-backed invariant so it grades only where its law is in force for the entity's profile. */
export function canonLawChecker(lawId: string, label: string, checker: Checker): Checker {
  const wrapped: Checker = (data, ctx) => {
    const profile = ctx?.canonProfile ?? DEFAULT_CANON_PROFILE;
    return lawInForce(profile, lawId) ? checker(data, ctx) : ungradedByProfile(label, lawId, profile);
  };
  Object.defineProperty(wrapped, CANON_LAW, { value: lawId, enumerable: false });
  return markContentInvariant(wrapped);
}
