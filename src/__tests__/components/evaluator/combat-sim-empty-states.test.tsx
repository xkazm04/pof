import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { AbilityHeatmap } from '@/components/modules/evaluator/CombatSimulatorView/AbilityHeatmap';
import { ThreatBreakdownPanel } from '@/components/modules/evaluator/CombatSimulatorView/ThreatBreakdownPanel';
import { DistributionChart } from '@/components/modules/evaluator/CombatSimulatorView/DistributionChart';

afterEach(() => cleanup());

// A run that produced nothing to show must SAY so — a blank gap is indistinguishable
// from a render bug (data-viz: "chrome only renders around data", typed empty state).
describe('Advanced panels — typed empty states on an empty run', () => {
  it('AbilityHeatmap names its empty state instead of rendering nothing', () => {
    const { container } = render(<AbilityHeatmap heatmap={{}} />);
    expect(container.textContent).toContain('Ability Usage Heatmap');
    expect(container.textContent).toMatch(/no abilities were used/i);
  });

  it('ThreatBreakdownPanel names its empty state instead of rendering nothing', () => {
    const { container } = render(
      <ThreatBreakdownPanel breakdown={{ bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 }} />,
    );
    expect(container.textContent).toContain('Death Recap & Threat Breakdown');
    expect(container.textContent).toMatch(/no damage was taken/i);
  });

  it('DistributionChart names its empty state and draws no axis around nothing', () => {
    const { container } = render(<DistributionChart title="Damage Taken" buckets={[]} color="red" />);
    expect(container.textContent).toContain('Damage Taken');
    expect(container.textContent).toMatch(/no fights recorded/i);
    expect(container.querySelector('[role="img"]')).toBeNull();
  });
});
