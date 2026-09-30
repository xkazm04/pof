/**
 * Which class of SUBJECT a catalog's images depict (/diablo W04, decision D15).
 *
 * One universal Style DNA was appended to every image prompt of a canon, and for a creature it won
 * over the subject: W03's Diablo zombie rendered as a bare skeleton 4 of 5 times with the style on,
 * a flesh-covered zombie with it off. Environment cues (stone, cracks, decay, angular breaks) are
 * right for a cathedral and wrong for a body. A canon profile may therefore ship a Style DNA per
 * subject class (`CanonProfile.styleDnaByClass`); a catalog not listed here gets the base DNA.
 */
export type SubjectClass = 'creature' | 'environment' | 'item';

const CLASS_BY_CATALOG: Readonly<Record<string, SubjectClass>> = {
  bestiary: 'creature',
  characters: 'creature',
  'character-pipeline': 'creature',
  'zone-map': 'environment',
  'combat-map': 'environment',
  props: 'environment',
  materials: 'environment',
  items: 'item',
  'icon-sets': 'item',
  currencies: 'item',
  'crafting-recipes': 'item',
};

/** The subject class a catalog's images depict, or undefined (→ the base Style DNA). */
export function subjectClassOf(catalogId: string | null | undefined): SubjectClass | undefined {
  return catalogId ? CLASS_BY_CATALOG[catalogId] : undefined;
}

export const SUBJECT_CLASSES: readonly SubjectClass[] = ['creature', 'environment', 'item'];
