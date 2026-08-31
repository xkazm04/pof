import { describe, it, expect } from 'vitest';
import { gradeViewerAsset } from '@/components/modules/visual-gen/asset-viewer/assetGrade';
import type { AssetStats } from '@/components/modules/visual-gen/asset-viewer/assetStats';

/** `assetStats` builds the box as width=size.x, height=size.y, depth=size.z (three.js Y-up). */
const stats = (w: number, h: number, d: number): AssetStats =>
  ({ triangles: 10_000, boundingBox: { width: w, height: h, depth: d } }) as AssetStats;

describe('the viewer grades which way up an asset sits', () => {
  it('flags a character lying down — the class that honestly stands', () => {
    const g = gradeViewerAsset(stats(1.8, 0.5, 0.6), 'character', 1.8)!;
    expect(g.orientation.verdict).toBe('lying');
    expect(g.orientationLine).toMatch(/lying|side/i);
  });

  it('passes a character that stands', () => {
    expect(gradeViewerAsset(stats(0.5, 1.8, 0.6), 'character', 1.8)!.orientation.verdict).toBe('upright');
  });

  it('claims nothing for a prop, which may legitimately be flat or long', () => {
    expect(gradeViewerAsset(stats(1.0, 0.3, 1.0), 'prop')!.orientation.verdict).toBe('unmeasured');
  });

  it('still reports the measured axes when it claims nothing', () => {
    const g = gradeViewerAsset(stats(1.0, 0.3, 1.0), 'prop')!;
    expect(g.orientation.dominantAxis).toBe('x');
    expect(g.orientation.upExtentM).toBeCloseTo(0.3, 6);
  });

  it('carries the rotation that would fix it', () => {
    const g = gradeViewerAsset(stats(1.8, 0.5, 0.6), 'character', 1.8)!;
    expect(g.orientation.suggestedRotation).toEqual({ axis: 'z', degrees: 90 });
  });
});
