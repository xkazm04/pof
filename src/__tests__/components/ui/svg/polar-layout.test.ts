import { describe, it, expect } from 'vitest';
import { polarSvgLayout } from '@/components/ui/svg/polar-layout';

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
