import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { SensitivityChart } from '@/components/modules/core-engine/sub_character/simulator/predictive/SensitivityChart';
import { SurvivalCurveChart } from '@/components/modules/core-engine/sub_character/simulator/predictive/SurvivalCurveChart';
import type { SensitivityCurve, SurvivalCurvePoint } from '@/components/modules/core-engine/sub_character/simulator/predictive/data';

afterEach(cleanup);

const svgName = (container: HTMLElement) => {
  const svg = container.querySelector('svg');
  return { role: svg?.getAttribute('role'), label: svg?.getAttribute('aria-label') ?? '' };
};

describe('predictive charts — each SVG is a named image, not an anonymous drawing', () => {
  it('names the sensitivity chart with its attribute and survival span', () => {
    const curve = {
      attribute: 'armor',
      points: [
        { value: 10, survivalRate: 0.4, avgTTK: 10 },
        { value: 50, survivalRate: 0.9, avgTTK: 12 },
      ],
      diminishingAt: null,
    } as unknown as SensitivityCurve;
    const { container } = render(<SensitivityChart curve={curve} width={220} height={120} color="var(--text)" />);
    const { role, label } = svgName(container);
    expect(role).toBe('img');
    expect(label).toContain('armor');
    expect(label).toContain('40%');
    expect(label).toContain('90%');
  });

  it('names the survival-curve chart with its encounters and level span', () => {
    const pts = (a: number, b: number): SurvivalCurvePoint[] =>
      [{ level: 1, survivalRate: a, avgTTK: 5, avgDPS: 10 }, { level: 30, survivalRate: b, avgTTK: 5, avgDPS: 10 }] as SurvivalCurvePoint[];
    const { container } = render(
      <SurvivalCurveChart curves={{ '3x Grunt': pts(0.2, 1), '1x Brute': pts(0.1, 0.8) }} width={480} height={180} />,
    );
    const { role, label } = svgName(container);
    expect(role).toBe('img');
    expect(label).toContain('Lv.1');
    expect(label).toContain('Lv.30');
    expect(label).toContain('3x Grunt');
    expect(label).toContain('1x Brute');
  });
});
