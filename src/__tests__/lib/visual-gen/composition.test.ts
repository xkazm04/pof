import { describe, it, expect } from 'vitest';
import {
  generateComposition,
  randomizeRotations,
  DEFAULT_COMPOSITION_CONFIG,
  type CompositionAsset,
  type CompositionConfig,
} from '@/lib/visual-gen/generators/composition';
import {
  AFFORDANCE_PRESETS,
  affordanceForSize,
  affordanceForSizeClass,
  classifyBySize,
  parseUeActorTags,
  toUeActorTags,
  DEFAULT_AFFORDANCE,
  type PlacementAffordance,
} from '@/lib/visual-gen/generators/placement-tags';

const table: CompositionAsset = {
  id: 'table',
  size: [160, 90, 75],
  affordance: { place: 'floor', stackable: true, copies: 1, maxStack: 2 },
};
const box: CompositionAsset = {
  id: 'box',
  size: [50, 40, 40],
  affordance: { place: 'any', stackable: true, copies: 3, maxStack: 3 },
};
const can: CompositionAsset = {
  id: 'can',
  size: [12, 12, 20],
  affordance: { place: 'surface', stackable: false, copies: 2, maxStack: 1 },
};

function config(assets: CompositionAsset[], over: Partial<CompositionConfig> = {}): CompositionConfig {
  return { ...DEFAULT_COMPOSITION_CONFIG, assets, ...over };
}

describe('placement-tags', () => {
  it('classifies props by their largest horizontal extent', () => {
    expect(classifyBySize([12, 12, 20])).toBe('small');
    expect(classifyBySize([50, 40, 40])).toBe('medium');
    expect(classifyBySize([160, 90, 75])).toBe('large');
  });

  it('derives a default affordance straight from mesh bounds', () => {
    expect(affordanceForSize([160, 90, 75])).toEqual(affordanceForSizeClass('large'));
    expect(affordanceForSize([12, 12, 20]).stackable).toBe(false);
  });

  it('keeps large props off other props and small props load-free', () => {
    expect(AFFORDANCE_PRESETS.large.place).toBe('floor');
    expect(AFFORDANCE_PRESETS.small.stackable).toBe(false);
  });

  it('round-trips through UE actor tags', () => {
    const a: PlacementAffordance = { place: 'surface', stackable: true, copies: 10, maxStack: 4 };
    const tags = toUeActorTags(a);
    expect(tags).toContain('place_surface');
    expect(tags).toContain('stack_true');
    expect(tags).toContain('copy_10');
    expect(tags).toContain('max_stack_4');
    expect(parseUeActorTags(tags)).toEqual(a);
  });

  it('does not confuse max_stack_N with the stack_ flag', () => {
    expect(parseUeActorTags(['place_floor', 'stack_false', 'max_stack_10'])).toEqual({
      place: 'floor',
      stackable: false,
      copies: 1,
      maxStack: 10,
    });
  });

  it('treats an untagged prop as the safe default', () => {
    expect(parseUeActorTags([])).toEqual(DEFAULT_AFFORDANCE);
    expect(parseUeActorTags(['unrelated_tag'])).toEqual(DEFAULT_AFFORDANCE);
  });

  it('ignores a malformed count tag rather than emitting NaN', () => {
    expect(parseUeActorTags(['copy_abc', 'max_stack_0']).copies).toBe(1);
    expect(parseUeActorTags(['copy_abc', 'max_stack_0']).maxStack).toBe(1);
  });
});

describe('generateComposition', () => {
  it('expands copies into one instance per copy', () => {
    const { props } = generateComposition(config([box]));
    expect(props).toHaveLength(3);
    expect(new Set(props.map((p) => p.id)).size).toBe(3);
  });

  it('is deterministic for a seed and varies across seeds', () => {
    const a = generateComposition(config([table, box, can]));
    const b = generateComposition(config([table, box, can]));
    const c = generateComposition(config([table, box, can], { seed: 7 }));
    expect(a).toEqual(b);
    expect(JSON.stringify(a.props)).not.toEqual(JSON.stringify(c.props));
  });

  it('never places a place_floor prop on top of anything', () => {
    const { props } = generateComposition(config([table, box, can]));
    for (const p of props.filter((x) => x.assetId === 'table')) {
      expect(p.supportedBy).toBeNull();
      expect(p.stackIndex).toBe(0);
      expect(p.z).toBe(0);
    }
  });

  it('only ever places a place_surface prop on a support', () => {
    const { props } = generateComposition(config([table, box, can]));
    const cans = props.filter((p) => p.assetId === 'can');
    expect(cans.length).toBeGreaterThan(0);
    for (const c of cans) expect(c.supportedBy).not.toBeNull();
  });

  it('reports a surface-only prop with a reason when nothing can carry it', () => {
    const { props, unplaced } = generateComposition(config([can]));
    expect(props).toHaveLength(0);
    expect(unplaced).toHaveLength(2);
    expect(unplaced[0].assetId).toBe('can');
    expect(unplaced[0].reason).toMatch(/place_surface/);
  });

  it('never rests a prop on a smaller footprint', () => {
    const { props } = generateComposition(config([table, box, can]));
    const byId = new Map(props.map((p) => [p.id, p]));
    const sizeOf = (assetId: string) =>
      [table, box, can].find((a) => a.id === assetId)!.size;
    for (const p of props) {
      if (!p.supportedBy) continue;
      const support = byId.get(p.supportedBy)!;
      const [sx, sy] = sizeOf(support.assetId);
      const [px, py] = sizeOf(p.assetId);
      expect(sx * sy).toBeGreaterThanOrEqual(px * py);
    }
  });

  it('rests a stacked prop exactly on its support top', () => {
    const { props } = generateComposition(config([table, box, can]));
    const byId = new Map(props.map((p) => [p.id, p]));
    const heightOf = (assetId: string) =>
      [table, box, can].find((a) => a.id === assetId)!.size[2];
    for (const p of props) {
      if (!p.supportedBy) continue;
      const support = byId.get(p.supportedBy)!;
      expect(p.z).toBeCloseTo(support.z + heightOf(support.assetId), 6);
    }
  });

  it('caps a run at the floor prop maxStack', () => {
    const pallet: CompositionAsset = {
      id: 'pallet',
      size: [120, 100, 15],
      affordance: { place: 'any', stackable: true, copies: 20, maxStack: 4 },
    };
    const { props } = generateComposition(config([pallet]));
    expect(props.length).toBeGreaterThan(4);
    expect(Math.max(...props.map((p) => p.stackIndex))).toBeLessThanOrEqual(3);
  });

  it('keeps floor props from overlapping each other', () => {
    const { props } = generateComposition(config([table, box], { areaExtent: 600 }));
    const sizeOf = (assetId: string) => [table, box].find((a) => a.id === assetId)!.size;
    const floor = props.filter((p) => p.stackIndex === 0);
    for (let i = 0; i < floor.length; i++) {
      for (let j = i + 1; j < floor.length; j++) {
        const a = floor[i];
        const b = floor[j];
        const [ax, ay] = sizeOf(a.assetId);
        const [bx, by] = sizeOf(b.assetId);
        const separated =
          Math.abs(a.x - b.x) >= (ax + bx) / 2 || Math.abs(a.y - b.y) >= (ay + by) / 2;
        expect(separated).toBe(true);
      }
    }
  });

  it('reports a reason when the floor area cannot fit a prop', () => {
    const { unplaced } = generateComposition(config([table, box], { areaExtent: 5 }));
    expect(unplaced.length).toBeGreaterThan(0);
    expect(unplaced.some((u) => /no free floor space/.test(u.reason))).toBe(true);
  });

  it('applies yaw jitter within the configured bound, and none at zero', () => {
    const { props } = generateComposition(config([table, box], { jitterDegrees: 8 }));
    for (const p of props) expect(Math.abs(p.yaw)).toBeLessThanOrEqual(8);
    const aligned = generateComposition(config([table, box], { jitterDegrees: 0 }));
    for (const p of aligned.props) expect(p.yaw).toBeCloseTo(0, 10);
  });

  it('treats an asset with no declared affordance as the safe default', () => {
    const untagged: CompositionAsset = { id: 'mystery', size: [30, 30, 30] };
    const { props } = generateComposition(config([untagged]));
    expect(props).toHaveLength(1);
    expect(props[0].supportedBy).toBeNull();
  });
});

describe('randomizeRotations', () => {
  it('re-rolls yaw only, within bounds', () => {
    const { props } = generateComposition(config([table, box, can]));
    const rolled = randomizeRotations(props, 15, 99);
    expect(rolled).toHaveLength(props.length);
    rolled.forEach((r, i) => {
      expect(r.x).toBe(props[i].x);
      expect(r.z).toBe(props[i].z);
      expect(Math.abs(r.yaw)).toBeLessThanOrEqual(15);
    });
  });

  it('is repeatable per seed', () => {
    const { props } = generateComposition(config([table, box]));
    expect(randomizeRotations(props, 15, 5)).toEqual(randomizeRotations(props, 15, 5));
  });
});
