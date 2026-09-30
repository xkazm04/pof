import { SPELL_SPECS_DATA } from '@/lib/catalog/reference/spellSpecsData';

export type SpellElement = 'fire' | 'lightning' | 'magic' | 'physical' | 'none';
export type SpellDelivery = 'projectile' | 'self' | 'nova' | 'wall' | 'utility' | 'summon' | 'chain' | 'area';
export type SpellDamage =
  | { kind: 'none' }
  | { kind: 'direct' | 'per-tick'; min: string; max: string };

export interface LawAllowance {
  value: number;
  reason: string;
}

export interface SpellSpecData {
  spell: string;
  lawId: `d1-spell-${string}-law`;
  lawBody: string;
  element: SpellElement;
  declaredElement?: SpellElement;
  delivery: SpellDelivery;
  effectKind: string;
  damage: SpellDamage;
  manaCost: string;
  durationTicks: string;
  missiles: readonly string[];
  specials: readonly string[];
  refs: readonly string[];
  notInLaw?: readonly LawAllowance[];
}

export type VanillaSpell = (typeof SPELL_SPECS_DATA)[number]['spell'];
export type SpellSpec = Omit<SpellSpecData, 'lawBody'>;

/** Symbols shared by the display formulas; evaluators in spellMath.ts implement these definitions. */
export const SPELL_FORMULA_LEGEND = {
  S: 'max(base learned spell level + item spell-level bonus, 0)',
  C: 'character level',
  M: 'Magic attribute',
  R: 'R(n) is uniform from 0 through n-1',
  Scale: 'repeat S times: x = x + trunc(x/8)',
  B: 'baseMana, except the 255 sentinel uses maxManaBaseInternal/64',
  D: 'vanilla class adjustment performed after the engine converts whole mana to fixed-point; result is displayed mana',
  nonnegative: 'max(value, 0)',
  levelsAboveFirst: 'max(S-1, 0)',
  maxRoll: 'maxRoll(n)=n-1',
} as const;

/** The 35 non-Hellfire SpellID rows, with executable formulas kept separate from table values. */
export const SPELL_SPECS: readonly SpellSpec[] = SPELL_SPECS_DATA.map((data) => {
  const spec = { ...data } as Partial<SpellSpecData>;
  delete spec.lawBody;
  return spec as SpellSpec;
});

const BY_NAME = new Map<string, SpellSpec>(SPELL_SPECS.map((spec) => [spec.spell, spec]));

export function spellSpec(spell: string): SpellSpec | undefined {
  return BY_NAME.get(spell);
}

/** Integer constants occurring in display formulas, including signed constants by magnitude. */
export function formulaIntegers(spec: SpellSpec): number[] {
  const formulas = [spec.manaCost, spec.durationTicks];
  if (spec.damage.kind !== 'none') formulas.push(spec.damage.min, spec.damage.max);
  return [...new Set(formulas.flatMap((formula) => [...formula.matchAll(/\d+/g)].map((match) => Number(match[0]))))];
}

export interface LawParityFailure {
  spell: string;
  lawId: string;
  missing: number[];
}

/** Every display-formula constant must be visible in prose or explicitly justified. */
export function spellLawParity(): LawParityFailure[] {
  return SPELL_SPECS_DATA.flatMap((data) => {
    const spec = SPELL_SPECS.find((candidate) => candidate.spell === data.spell)!;
    const inLaw = new Set([...data.lawBody.matchAll(/\d+/g)].map((match) => Number(match[0])));
    const allowed = new Set((spec.notInLaw ?? []).map((entry) => entry.value));
    const missing = formulaIntegers(spec).filter((value) => !inLaw.has(value) && !allowed.has(value));
    return missing.length ? [{ spell: spec.spell, lawId: spec.lawId, missing }] : [];
  });
}
