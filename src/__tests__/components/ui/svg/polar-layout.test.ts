import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { polarSvgLayout, ringPoints } from '@/components/ui/svg/polar-layout';
import { generateRingPoints } from '@/components/modules/game-systems/FlankAngleHeatmap/helpers';
import { ATTACK_DISTANCE } from '@/components/modules/game-systems/FlankAngleHeatmap/constants';

describe('polarSvgLayout', () => {
  it('derives center as half the size and radius from the padded box', () => {
    const l = polarSvgLayout(360, 40);
    expect(l.size).toBe(360);
    expect(l.center).toBe(180);
    expect(l.padding).toBe(40);
    // (360 - 40*2) / 2 = 140
    expect(l.radius).toBe(140);
  });

  it('matches the values each tactical viz previously hard-coded', () => {
    // FlankAngleHeatmap (360 / 40), SquadChoreographyEditor (380 / 50),
    // TacticalCoverAnalysis (380 / 44), PatrolPointsDistribution (320 / 20),
    // AttackRingVisualizer (340 / 50) — the exact blocks this helper replaces.
    const cases: Array<[number, number, number, number]> = [
      // [size, padding, expectedCenter, expectedRadius]
      [360, 40, 180, 140],
      [380, 50, 190, 140],
      [380, 44, 190, 146],
      [320, 20, 160, 140],
      [340, 50, 170, 120],
    ];
    for (const [size, padding, center, radius] of cases) {
      const l = polarSvgLayout(size, padding);
      expect(l.center).toBe(center);
      expect(l.radius).toBe(radius);
    }
  });

  it('equals the original inline formula for arbitrary inputs', () => {
    for (const size of [100, 257, 512]) {
      for (const padding of [0, 13, 60]) {
        const l = polarSvgLayout(size, padding);
        expect(l.center).toBe(size / 2);
        expect(l.radius).toBe((size - padding * 2) / 2);
      }
    }
  });
});

describe('ringPoints', () => {
  it('places n points at even angles from +x, offset by the centre (n=12 pinned)', () => {
    const pts = ringPoints(12, 100, 170);
    expect(pts).toHaveLength(12);
    pts.forEach((p, i) => {
      const a = (2 * Math.PI * i) / 12;
      expect(p.angle).toBeCloseTo(a, 12);
      expect(p.x).toBeCloseTo(170 + Math.cos(a) * 100, 10);
      expect(p.y).toBeCloseTo(170 + Math.sin(a) * 100, 10);
    });
    expect(pts[0]).toEqual({ x: 270, y: 170, angle: 0 });
  });

  it('is the one rule behind FlankAngleHeatmap (same x, y and angle for n=12)', () => {
    const heat = generateRingPoints(12, 0);
    const ring = ringPoints(12, ATTACK_DISTANCE);
    expect(heat.map(({ x, y, angle }) => ({ x, y, angle }))).toEqual(ring);
  });

  it('AttackRingVisualizer carries no inline ring loop of its own', () => {
    const src = readFileSync(
      join(__dirname, '../../../../components/modules/game-systems/AttackRingVisualizer/index.tsx'), 'utf8',
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(src).not.toMatch(/Math\.(cos|sin)/);
    expect(src).toMatch(/ringPoints\(/);
  });
});
