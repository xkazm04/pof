/**
 * Damage-element vocabulary per canon profile (/diablo W03, decision D14).
 *
 * PoF's elements are fire / ice / lightning / chaos (ARPG-LAWS §4; `UARPGAttributeSet`'s
 * per-element resistance attributes). Diablo I has three: magic / fire / lightning (devilutionX
 * `monstdat.resistance` flags `RESIST_*` / `IMMUNE_*`). Grading a Diablo monster's Resistances
 * against PoF's four left it permanently pending on elements the game does not have, while its
 * real third element had no column at all.
 *
 * Kept free of imports so checkers can read it without pulling the canon seeds in.
 * `src/__tests__/catalog/canon/elements.test.ts` pins that every canon profile declares a set.
 */
/** Mirrors `DEFAULT_CANON_PROFILE` (profiles.ts) — pinned equal by the elements test. */
export const ELEMENTS_DEFAULT_PROFILE = 'pof';

export const ELEMENTS_BY_PROFILE: Readonly<Record<string, readonly string[]>> = {
  pof: ['fire', 'ice', 'lightning', 'chaos'],
  diablo1: ['magic', 'fire', 'lightning'],
};

/** The element set in force for a canon profile (the project's own when none is given). */
export function elementsOf(profileId?: string | null): readonly string[] {
  const set = ELEMENTS_BY_PROFILE[profileId ?? ELEMENTS_DEFAULT_PROFILE];
  if (!set) throw new Error(`canon profile "${profileId}" declares no element set (ELEMENTS_BY_PROFILE)`);
  return set;
}

/** The resistance key a Resistances step records for an element (`fire` → `fireRes`). */
export const resistanceKey = (element: string): string => `${element}Res`;
