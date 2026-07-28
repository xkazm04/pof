/**
 * Placement affordances — the per-prop rules that make generated set dressing
 * look deliberate instead of bounding-box random.
 *
 * A generated prop set carries no information about WHERE it belongs, so a
 * dressing pass that only knows each mesh's bounds stacks tables on paint cans.
 * The fix is a tiny declared contract per asset: may it sit on the floor, on
 * another prop, or either; may anything rest on it; how many copies; how high
 * it may stack.
 *
 * The tag vocabulary is round-trippable to real UE actor tags
 * (`place_floor` / `stack_true` / `copy_3` / `max_stack_10`), so a prop that has
 * been authored in-editor can be read back, and a generated composition can be
 * written out for an editor-side spawn script to consume.
 */

export type PlacementRule = 'floor' | 'surface' | 'any';
export type PropSizeClass = 'large' | 'medium' | 'small';

export interface PlacementAffordance {
  /** Where the prop may be placed. */
  place: PlacementRule;
  /** May other props rest on top of this one. */
  stackable: boolean;
  /** How many instances of this asset the composition spawns. */
  copies: number;
  /**
   * Tallest vertical run this prop may root, counted INCLUDING itself — a
   * `maxStack` of 2 on a table means the table plus one layer of props on it.
   * Only the floor-level prop's value applies to a run.
   */
  maxStack: number;
}

export interface AffordancePreset extends PlacementAffordance {
  sizeClass: PropSizeClass;
  label: string;
  rationale: string;
}

/**
 * Defaults matched to the large → medium → small authoring pass: decide the big
 * pieces first, then what may sit on them, then treat small props as the final
 * layer that nothing rests on.
 */
export const AFFORDANCE_PRESETS: Record<PropSizeClass, AffordancePreset> = {
  large: {
    sizeClass: 'large',
    label: 'Large prop (table, crate stack, shelving)',
    place: 'floor',
    stackable: true,
    copies: 1,
    maxStack: 2,
    rationale:
      'Large pieces read as furniture — they belong on the ground and carry other props. Placing one on top of a smaller prop is the single most common tell of an automated composition.',
  },
  medium: {
    sizeClass: 'medium',
    label: 'Medium prop (cardboard box, container, pallet)',
    place: 'any',
    stackable: true,
    copies: 3,
    maxStack: 3,
    rationale:
      'Mid-size props are the stacking layer: believable on the floor and on furniture, and believable under other props. Copies default above 1 because clusters read better than singles.',
  },
  small: {
    sizeClass: 'small',
    label: 'Small prop (can, bottle, cable, documents)',
    place: 'any',
    stackable: false,
    copies: 3,
    maxStack: 1,
    rationale:
      'Small clutter is the final layer — it may go anywhere, but nothing should balance on a spray can or a coiled cable.',
  },
};

/** Largest horizontal extent (cm) below which a prop is small / medium. */
const SMALL_MAX_CM = 40;
const MEDIUM_MAX_CM = 120;

/** Classify by footprint so a generated mesh's bounds pick a sane default. */
export function classifyBySize(size: readonly [number, number, number]): PropSizeClass {
  const footprint = Math.max(size[0], size[1]);
  if (footprint <= SMALL_MAX_CM) return 'small';
  if (footprint <= MEDIUM_MAX_CM) return 'medium';
  return 'large';
}

export function affordanceForSizeClass(sizeClass: PropSizeClass): PlacementAffordance {
  const { place, stackable, copies, maxStack } = AFFORDANCE_PRESETS[sizeClass];
  return { place, stackable, copies, maxStack };
}

/** Default affordance derived straight from a generated mesh's bounds. */
export function affordanceForSize(size: readonly [number, number, number]): PlacementAffordance {
  return affordanceForSizeClass(classifyBySize(size));
}

export const DEFAULT_AFFORDANCE: PlacementAffordance = {
  place: 'any',
  stackable: false,
  copies: 1,
  maxStack: 1,
};

/** Emit the UE actor tags an editor-side spawn script reads. */
export function toUeActorTags(a: PlacementAffordance): string[] {
  return [
    `place_${a.place}`,
    a.stackable ? 'stack_true' : 'stack_false',
    `copy_${a.copies}`,
    `max_stack_${a.maxStack}`,
  ];
}

const PLACE_RULES: PlacementRule[] = ['floor', 'surface', 'any'];

function readCount(tags: string[], prefix: string, fallback: number): number {
  // `max_stack_` must win over `stack_` — check the longest prefix first.
  const hit = tags.find((t) => t.startsWith(prefix));
  if (!hit) return fallback;
  const n = Number.parseInt(hit.slice(prefix.length), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read affordances back off an actor's tags. Unknown or missing tags fall back
 * to {@link DEFAULT_AFFORDANCE} — an untagged prop is treated as placeable
 * anywhere and load-bearing for nothing, which is the safe reading.
 */
export function parseUeActorTags(tags: readonly string[]): PlacementAffordance {
  const list = tags.map((t) => t.trim().toLowerCase());
  const place = PLACE_RULES.find((r) => list.includes(`place_${r}`)) ?? DEFAULT_AFFORDANCE.place;
  const stackable = list.includes('stack_true')
    ? true
    : list.includes('stack_false')
      ? false
      : DEFAULT_AFFORDANCE.stackable;
  return {
    place,
    stackable,
    copies: readCount(list, 'copy_', DEFAULT_AFFORDANCE.copies),
    maxStack: readCount(list, 'max_stack_', DEFAULT_AFFORDANCE.maxStack),
  };
}
