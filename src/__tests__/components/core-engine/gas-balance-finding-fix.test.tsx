import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { FindingFix } from '@/components/modules/core-engine/sub_ability/gas-balance/FindingFix';
import { SCENARIO_PRESETS } from '@/components/modules/core-engine/sub_ability/gas-balance/data';
import { runSimulation } from '@/components/modules/core-engine/sub_ability/gas-balance/simulation';
import { buildBalanceHealthReport } from '@/components/modules/core-engine/sub_ability/gas-balance/balanceHealth';
import type { SimScenario } from '@/components/modules/core-engine/sub_ability/gas-balance/data';

// A solvable finding gets a Solve button: one seeded solve per lever, a measured
// before/after per row, and Apply hands the applied scenario to the caller.

afterEach(cleanup);

const BOSS = SCENARIO_PRESETS.find(s => s.id === 'boss-fight')!;

function survivalFinding(scenario: SimScenario) {
  const report = buildBalanceHealthReport(runSimulation({ ...scenario, iterations: 500 }), scenario);
  return report.findings.find(f => f.id === 'survival')!;
}

describe('FindingFix', () => {
  it('Solve renders the measured multiplier and survival before → after; Apply hands over the applied scenario', async () => {
    const onApply = vi.fn();
    render(<FindingFix finding={survivalFinding(BOSS)} scenario={BOSS} onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', { name: /solve/i }));

    const row = await screen.findByTestId('fix-row-playerHealth', {}, { timeout: 20_000 });
    expect(row.textContent).toMatch(/×\d+\.\d\d/);
    expect(row.textContent).toMatch(/survival 0%\s*→\s*6\d%/);

    // The row shows the multiplier to 2 dp and carries the exact solve.
    const m = Number(row.getAttribute('data-multiplier'));
    expect(row.textContent).toContain(`×${m.toFixed(2)}`);
    expect(m).toBeGreaterThanOrEqual(5);
    expect(m).toBeLessThanOrEqual(6.5);

    fireEvent.click(within(row).getByRole('button', { name: /apply/i }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as SimScenario;
    expect(applied.player.maxHealth).toBe(Math.round(500 * m));
    expect(applied.enemies).toEqual(BOSS.enemies);
  });

  it('a finding no single stat can fix says so and offers no Solve', () => {
    render(
      <FindingFix
        finding={{ id: 'overkill', severity: 'info', title: 't', narrative: 'n', suggestion: 's' }}
        scenario={BOSS}
        onApply={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /solve/i })).toBeNull();
    expect(screen.getByText(/not solvable by a single stat/i)).toBeTruthy();
  });
});
