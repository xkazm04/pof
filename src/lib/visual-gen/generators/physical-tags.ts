/**
 * Physical properties — what a prop is made of and what it weighs.
 *
 * Sibling of `placement-tags.ts` and deliberately separate from it: placement answers
 * "where may this prop go", this answers "how does it behave once it is there". Keeping
 * them apart means the solver's contract is untouched and an actor can carry either set,
 * both, or neither.
 *
 * Why it matters rather than being decoration: the `prop-placement-affordances-not-bounds`
 * gotcha's own recommended finish for piles and clutter is a PHYSICS SETTLE — "enable
 * simulate physics on the spawned actors, let them fall, then bake the resulting transforms
 * back and disable physics". A settle is undefined without a per-actor mass and a simulate
 * flag, so this is the missing input to a step PoF already tells itself to take.
 *
 * Mass is DERIVED — density x volume x solid fraction — not authored per prop. The numbers
 * are then reproducible and arguable instead of invented.
 */

export type PhysicsMaterial = 'wood' | 'metal' | 'stone' | 'fabric' | 'glass' | 'default';

export interface MaterialDensity {
  densityKgM3: number;
  /**
   * Fraction of the bounding volume that is actually material. Props are shells: a barrel
   * billed as a solid block of oak weighs ~600kg and no settle will ever move it
   * believably, which reads as a physics bug rather than a mass estimate.
   */
  solidFraction: number;
  rationale: string;
}

export const MATERIAL_DENSITIES: Record<PhysicsMaterial, MaterialDensity> = {
  wood: {
    densityKgM3: 700,
    solidFraction: 0.25,
    rationale:
      'Oak/pine sit near 700 kg/m3, but wooden props are overwhelmingly containers and frames — barrels, crates, tables — so only about a quarter of the bounding box is timber.',
  },
  metal: {
    densityKgM3: 7800,
    solidFraction: 0.15,
    rationale:
      'Steel is dense but metal props are sheet and tube: canisters, lanterns, tools. A solid reading would make every prop immovable, which is the opposite of the intent.',
  },
  stone: {
    densityKgM3: 2400,
    solidFraction: 1,
    rationale:
      'Masonry, rubble and statuary really are solid through, so the bounding volume is the material volume. Stone props end up heavy on purpose — they should not be shoved around by a settle.',
  },
  fabric: {
    densityKgM3: 300,
    solidFraction: 0.2,
    rationale:
      'Sacks, bedrolls and awnings are mostly trapped air. Light enough that a settle tosses them, which is the correct behaviour for cloth-class clutter.',
  },
  glass: {
    densityKgM3: 2500,
    solidFraction: 0.12,
    rationale:
      'Bottles and jars are thin-walled vessels; the glass itself is a small fraction of the silhouette, giving the light, tippy props a scene wants.',
  },
  default: {
    densityKgM3: 800,
    solidFraction: 0.25,
    rationale:
      'The unclassified fallback — a mid-density hollow object. Deliberately unremarkable so an unlabelled prop behaves plausibly instead of anomalously.',
  },
};

export interface PhysicalProperties {
  massKg: number;
  /** Whether the spawned actor simulates physics (and so participates in a settle). */
  simulate: boolean;
  material: PhysicsMaterial;
}

export const DEFAULT_PHYSICAL: PhysicalProperties = {
  massKg: 1,
  simulate: false,
  material: 'default',
};

/**
 * Above this the prop is treated as furniture: heavy enough that letting it simulate makes
 * a settle shove the room around instead of settling the clutter on top of it.
 */
const STATIC_ABOVE_KG = 25;

/** density x volume x solid fraction, in kg. Pure. */
export function massForSize(
  size: readonly [number, number, number],
  material: PhysicsMaterial = 'default',
): number {
  const m = MATERIAL_DENSITIES[material] ?? MATERIAL_DENSITIES.default;
  // cm → m, and a degenerate axis falls back to 1cm so a bad bound never yields zero mass.
  const volumeM3 = size.reduce<number>((acc, cm) => acc * (Math.max(Math.abs(cm), 1) / 100), 1);
  const kg = m.densityKgM3 * volumeM3 * m.solidFraction;
  return Number(Math.max(kg, 0.01).toFixed(2));
}

/** The physical contract for a prop with these bounds and this material. Pure. */
export function physicalForSize(
  size: readonly [number, number, number],
  material: PhysicsMaterial = DEFAULT_PHYSICAL.material,
): PhysicalProperties {
  const massKg = massForSize(size, material);
  return { massKg, simulate: massKg <= STATIC_ABOVE_KG, material };
}

/**
 * Emit the UE actor tags a spawn script reads. The vocabulary is disjoint from
 * `placement-tags`' (`place_` / `stack_` / `copy_` / `max_stack_`) so one actor can carry
 * both sets and each parser ignores the other's tags.
 */
export function toPhysicsActorTags(p: PhysicalProperties): string[] {
  return [`phys_${p.material}`, p.simulate ? 'sim_true' : 'sim_false', `mass_kg_${p.massKg}`];
}

const MATERIALS = Object.keys(MATERIAL_DENSITIES) as PhysicsMaterial[];

/**
 * Read the physical contract back off an actor's tags. An untagged or unknown-tagged actor
 * falls back to {@link DEFAULT_PHYSICAL} — static and light, the reading that changes
 * nothing about a scene that never asked for physics.
 */
export function parsePhysicsActorTags(tags: readonly string[]): PhysicalProperties {
  const list = tags.map((t) => t.trim().toLowerCase());
  const material = MATERIALS.find((m) => list.includes(`phys_${m}`)) ?? DEFAULT_PHYSICAL.material;
  const simulate = list.includes('sim_true')
    ? true
    : list.includes('sim_false')
      ? false
      : DEFAULT_PHYSICAL.simulate;
  const massTag = list.find((t) => t.startsWith('mass_kg_'));
  const mass = massTag ? Number.parseFloat(massTag.slice('mass_kg_'.length)) : NaN;
  return {
    massKg: Number.isFinite(mass) && mass > 0 ? mass : DEFAULT_PHYSICAL.massKg,
    simulate,
    material,
  };
}
