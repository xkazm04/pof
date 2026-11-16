import { describe, it, expect } from 'vitest';
import { generateComposition } from '@/lib/visual-gen/generators/composition';

describe('a support must hold the prop in depth as well as width', () => {
  it('does not rest a deep prop on a long thin shelf with a bigger footprint', () => {
    const r = generateComposition({
      seed: 1, areaExtent: 500, jitterDegrees: 0,
      assets: [
        { id: 'plank', size: [200, 10, 5], affordance: { place: 'floor', stackable: true, copies: 1, maxStack: 2 } },
        { id: 'box', size: [50, 30, 30], affordance: { place: 'surface', stackable: false, copies: 1, maxStack: 1 } },
      ],
    });
    expect(r.props.find((p) => p.assetId === 'box')).toBeUndefined();
    expect(r.unplaced.map((u) => u.assetId)).toEqual(['box']);
  });
  it('still rests a prop that fits both ways', () => {
    const r = generateComposition({
      seed: 1, areaExtent: 500, jitterDegrees: 0,
      assets: [
        { id: 'table', size: [200, 100, 80], affordance: { place: 'floor', stackable: true, copies: 1, maxStack: 2 } },
        { id: 'box', size: [50, 30, 30], affordance: { place: 'surface', stackable: false, copies: 1, maxStack: 1 } },
      ],
    });
    expect(r.props.find((p) => p.assetId === 'box')?.supportedBy).toBe('table_0');
  });
});
