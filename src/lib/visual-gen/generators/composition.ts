/**
 * Prop-composition generation — small, believable clutter arrangements
 * (box stacks, dressed tables, debris piles) from a set of assets plus their
 * declared {@link PlacementAffordance}s.
 *
 * Sibling of the terrain / dungeon / vegetation generators, and deliberately
 * distinct from them: vegetation scatter answers "spread N species over an
 * area", this answers "arrange these props so they rest on each other the way
 * objects actually do". Bounds alone are not enough — a solver that only knows
 * sizes puts tables on paint cans. The affordances, plus a strict largest-first
 * pass and a footprint-must-fit support rule, are what buy believability.
 *
 * Pure and seeded: same config → same composition. Output is a transform
 * manifest an editor-side spawn script consumes; unplaceable instances are
 * reported with a reason rather than dropped silently.
 */
import { DEFAULT_AFFORDANCE, type PlacementAffordance } from './placement-tags';

export interface CompositionAsset {
  id: string;
  name?: string;
  /** Bounding-box extents in cm: [x, y, z]. */
  size: readonly [number, number, number];
  affordance?: PlacementAffordance;
}

export interface CompositionConfig {
  assets: CompositionAsset[];
  seed: number;
  /** Half-extent of the floor area in cm; floor props land within ±areaExtent. */
  areaExtent: number;
  /** Max random yaw applied to each prop, degrees. 0 = perfectly aligned. */
  jitterDegrees: number;
}

export interface PlacedProp {
  /** Unique instance id — `<assetId>_<n>`. */
  id: string;
  assetId: string;
  /** Composition-local centre, cm. `z` is the prop's BASE (its resting height). */
  x: number;
  y: number;
  z: number;
  yaw: number;
  /** 0 = on the floor, 1 = resting on a floor prop, and so on. */
  stackIndex: number;
  /** Instance id of the prop underneath, or null when floor-placed. */
  supportedBy: string | null;
}

export interface UnplacedProp {
  assetId: string;
  reason: string;
}

export interface CompositionResult {
  props: PlacedProp[];
  unplaced: UnplacedProp[];
}

export const DEFAULT_COMPOSITION_CONFIG: Omit<CompositionConfig, 'assets'> = {
  seed: 42,
  areaExtent: 300,
  jitterDegrees: 8,
};

/** Seeded RNG (mulberry32) — matches the vegetation generator. */
function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FLOOR_ATTEMPTS = 40;
/** Probability a `place_any` prop prefers a surface when one is available. */
const SURFACE_BIAS = 0.6;

interface Instance {
  id: string;
  asset: CompositionAsset;
  affordance: PlacementAffordance;
  footprint: number;
}

/** A placed prop plus the bookkeeping needed to accept props on top of it. */
interface Slot {
  prop: PlacedProp;
  size: readonly [number, number, number];
  affordance: PlacementAffordance;
  /** Items allowed in this vertical run INCLUDING its floor root. */
  rootMaxStack: number;
  /** Width of this prop's top surface already consumed by children, cm. */
  usedWidth: number;
}

function footprintOf(size: readonly [number, number, number]): number {
  return size[0] * size[1];
}

/** Expand `copies` into instances, largest footprint first. */
function buildInstances(assets: CompositionAsset[]): Instance[] {
  const out: Instance[] = [];
  for (const asset of assets) {
    const affordance = asset.affordance ?? DEFAULT_AFFORDANCE;
    for (let i = 0; i < Math.max(1, affordance.copies); i++) {
      out.push({
        id: `${asset.id}_${i}`,
        asset,
        affordance,
        footprint: footprintOf(asset.size),
      });
    }
  }
  return out.sort((a, b) => b.footprint - a.footprint || a.id.localeCompare(b.id));
}

function overlapsFloor(
  x: number,
  y: number,
  size: readonly [number, number, number],
  slots: Slot[],
): boolean {
  return slots.some(
    (s) =>
      s.prop.stackIndex === 0 &&
      Math.abs(x - s.prop.x) < (size[0] + s.size[0]) / 2 &&
      Math.abs(y - s.prop.y) < (size[1] + s.size[1]) / 2,
  );
}

/**
 * A support must be stackable, must leave room under its run's stack cap, must
 * be big enough to hold the prop, and must have unconsumed top surface. The
 * footprint test is what prevents the "large prop balanced on a thin surface"
 * failure a bounds-only pass produces.
 */
function findSupport(inst: Instance, slots: Slot[], rng: () => number): Slot | null {
  const candidates = slots.filter(
    (s) =>
      s.affordance.stackable &&
      s.prop.stackIndex + 1 < s.rootMaxStack &&
      footprintOf(s.size) >= inst.footprint &&
      s.size[0] - s.usedWidth >= inst.asset.size[0],
  );
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

/**
 * Generate a composition. Props are placed largest-first so the big pieces
 * establish the surfaces the smaller ones land on.
 */
export function generateComposition(config: CompositionConfig): CompositionResult {
  const { seed, areaExtent, jitterDegrees } = config;
  const rng = mulberry32(seed);
  const instances = buildInstances(config.assets);

  const slots: Slot[] = [];
  const unplaced: UnplacedProp[] = [];
  const jitter = () => (rng() - 0.5) * 2 * jitterDegrees;

  for (const inst of instances) {
    const { place, maxStack } = inst.affordance;
    const wantsSurface = place === 'surface' || (place === 'any' && rng() < SURFACE_BIAS);
    const support = wantsSurface ? findSupport(inst, slots, rng) : null;

    if (support) {
      // Lay children across the support's top surface left-to-right so a wide
      // support carries several props and a same-width one carries exactly one
      // (which then becomes the next rung of a vertical stack).
      const left = support.prop.x - support.size[0] / 2;
      const x = left + support.usedWidth + inst.asset.size[0] / 2;
      const depthPlay = Math.max(0, support.size[1] - inst.asset.size[1]);
      support.usedWidth += inst.asset.size[0];
      slots.push({
        prop: {
          id: inst.id,
          assetId: inst.asset.id,
          x,
          y: support.prop.y + (rng() - 0.5) * depthPlay,
          z: support.prop.z + support.size[2],
          yaw: jitter(),
          stackIndex: support.prop.stackIndex + 1,
          supportedBy: support.prop.id,
        },
        size: inst.asset.size,
        affordance: inst.affordance,
        rootMaxStack: support.rootMaxStack,
        usedWidth: 0,
      });
      continue;
    }

    if (place === 'surface') {
      unplaced.push({
        assetId: inst.asset.id,
        reason: 'place_surface, but no stackable surface with room was available',
      });
      continue;
    }

    let landed = false;
    for (let attempt = 0; attempt < FLOOR_ATTEMPTS; attempt++) {
      const x = (rng() - 0.5) * 2 * areaExtent;
      const y = (rng() - 0.5) * 2 * areaExtent;
      if (overlapsFloor(x, y, inst.asset.size, slots)) continue;
      slots.push({
        prop: {
          id: inst.id,
          assetId: inst.asset.id,
          x,
          y,
          z: 0,
          yaw: jitter(),
          stackIndex: 0,
          supportedBy: null,
        },
        size: inst.asset.size,
        affordance: inst.affordance,
        rootMaxStack: Math.max(1, maxStack),
        usedWidth: 0,
      });
      landed = true;
      break;
    }
    if (!landed) {
      unplaced.push({
        assetId: inst.asset.id,
        reason: `no free floor space within ±${areaExtent}cm after ${FLOOR_ATTEMPTS} attempts`,
      });
    }
  }

  return { props: slots.map((s) => s.prop), unplaced };
}

/**
 * Re-apply rotation jitter to an existing composition — the "nudge it until it
 * stops looking machine-placed" pass, repeatable with a new seed.
 */
export function randomizeRotations(
  props: PlacedProp[],
  degrees: number,
  seed: number,
): PlacedProp[] {
  const rng = mulberry32(seed);
  return props.map((p) => ({ ...p, yaw: (rng() - 0.5) * 2 * degrees }));
}
