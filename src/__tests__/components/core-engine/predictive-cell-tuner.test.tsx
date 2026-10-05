import { describe, it, expect, vi, afterEach } from 'vitest';
import type React from 'react';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import {
  runPredictiveBalance,
  DEFAULT_PREDICTIVE_CONFIG,
  type PredictiveBalanceConfig,
} from '@/lib/combat/predictive-balance';
import { ENEMY_ARCHETYPE_BY_ID } from '@/lib/combat/definitions';
import { HARDCODED_ENEMY_SOURCE } from '@/lib/combat/simulation-engine';
import { ResultsPanel } from '@/components/modules/core-engine/sub_character/simulator/predictive/ResultsPanel';
import { CellTuner } from '@/components/modules/core-engine/sub_character/simulator/predictive/CellTuner';
import { PredictiveBalanceSimulator } from '@/components/modules/core-engine/sub_character/simulator/predictive/PredictiveBalanceSimulator';

// Tune from the heatmap: cells are buttons, a clicked cell opens CellTuner, Solve
// runs on the sweep's yielding job ('eval k' + Cancel), Apply re-runs with the
// solved lever and diffs against the previous run, Undo restores it.

vi.mock('framer-motion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('framer-motion')>();
  return { ...actual, AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

// A two-level x two-encounter sweep with the Hollow Knight at Lv.10, at the shipped 200 iterations.
const SMALL: PredictiveBalanceConfig = {
  ...DEFAULT_PREDICTIVE_CONFIG,
  levelRange: [7, 10],
  levelStep: 3,
  enemyConfigs: [
    { archetypeId: 'melee-grunt', count: 3, levelOffset: 0 },
    { archetypeId: 'elite-knight', count: 1, levelOffset: 0 },
  ],
  sensitivityAttributes: [],
};

vi.mock('@/components/modules/core-engine/sub_character/simulator/predictive/data', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/modules/core-engine/sub_character/simulator/predictive/data')>();
  return {
    ...actual,
    DEFAULT_PREDICTIVE_CONFIG: {
      ...actual.DEFAULT_PREDICTIVE_CONFIG,
      levelRange: [7, 10],
      levelStep: 3,
      enemyConfigs: [
        { archetypeId: 'melee-grunt', count: 3, levelOffset: 0 },
        { archetypeId: 'elite-knight', count: 1, levelOffset: 0 },
      ],
      sensitivityAttributes: [],
    },
  };
});

vi.mock('@/components/modules/core-engine/sub_character/simulator/predictive/useBestiaryEnemies', async () => {
  const { ENEMY_ARCHETYPE_BY_ID: registry } = await import('@/lib/combat/definitions');
  const { HARDCODED_ENEMY_SOURCE: provenance } = await import('@/lib/combat/simulation-engine');
  return { useBestiaryEnemies: () => ({ registry, provenance, loading: false, error: null }) };
});

const FIXTURES = { registry: ENEMY_ARCHETYPE_BY_ID, provenance: HARDCODED_ENEMY_SOURCE };
const cellButtons = () => screen.queryAllByRole('button', { name: /% survival/ });

afterEach(() => cleanup());

describe('ResultsPanel renders from the report alone', () => {
  it('shows exactly report.heatmap.length survival cells with no live axes props', () => {
    const report = runPredictiveBalance({ ...SMALL, iterations: 40 });
    render(<ResultsPanel report={report} />);
    expect(cellButtons()).toHaveLength(report.heatmap.length);
  });
});

describe('CellTuner', () => {
  it('solves a lever for the clicked cell and applies it as config.tuning[lever]', async () => {
    const onApply = vi.fn();
    render(
      <CellTuner
        config={DEFAULT_PREDICTIVE_CONFIG}
        enemies={FIXTURES}
        cell={{ level: 10, encounterIndex: 3 }}
        label="1x Hollow Knight"
        onApply={onApply}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Lv.10 vs 1x Hollow Knight' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Lever'), { target: { value: 'enemyHealthMul' } });
    fireEvent.change(screen.getByLabelText('Target survival %'), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solve' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(false), { timeout: 10000 });
    expect(screen.getByRole('status').textContent).toContain('3.986');

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(onApply).toHaveBeenCalledTimes(1);
    const applied = onApply.mock.calls[0][0] as PredictiveBalanceConfig;
    expect(applied.tuning.enemyHealthMul).toBeCloseTo(3.986328125, 9);
    expect({ ...applied.tuning, enemyHealthMul: 1 }).toEqual(DEFAULT_PREDICTIVE_CONFIG.tuning);
  });

  it("shows 'eval k' and a Cancel while solving; Cancel applies nothing", async () => {
    const onApply = vi.fn();
    render(
      <CellTuner
        config={{ ...DEFAULT_PREDICTIVE_CONFIG, iterations: 1000 }}
        enemies={FIXTURES}
        cell={{ level: 10, encounterIndex: 3 }}
        label="1x Hollow Knight"
        onApply={onApply}
      />,
    );
    fireEvent.change(screen.getByLabelText('Lever'), { target: { value: 'enemyDamageMul' } });
    fireEvent.click(screen.getByRole('button', { name: 'Solve' }));

    await waitFor(() => expect(screen.getByText(/eval \d+/)).toBeTruthy(), { timeout: 10000 });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText(/eval \d+/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Solve' })).toBeTruthy();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryByText(/eval \d+/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
  });
});

describe('PredictiveBalanceSimulator — tune from the heatmap', () => {
  it('cell -> Solve -> Apply re-runs with the lever and shows deltas; Undo restores tuning and report', async () => {
    render(<PredictiveBalanceSimulator />);
    fireEvent.click(screen.getByRole('button', { name: /Run Simulation/ }));
    await waitFor(() => expect(cellButtons()).toHaveLength(4), { timeout: 10000 });

    // Stale-proof: editing the config after the run does not redraw the old report on new axes.
    const [, maxLevel] = screen.getAllByRole('spinbutton');
    fireEvent.change(maxLevel, { target: { value: '19' } });
    expect(cellButtons()).toHaveLength(4);
    fireEvent.change(maxLevel, { target: { value: '10' } });

    fireEvent.click(screen.getByRole('button', { name: 'Lv.10 vs 1x Hollow Knight: 100% survival' }));
    const tuner = screen.getByRole('region', { name: 'Tune Lv.10 vs 1x Hollow Knight' });
    fireEvent.change(within(tuner).getByLabelText('Lever'), { target: { value: 'enemyHealthMul' } });
    fireEvent.change(within(tuner).getByLabelText('Target survival %'), { target: { value: '80' } });
    fireEvent.click(within(tuner).getByRole('button', { name: 'Solve' }));
    await waitFor(() => expect(within(tuner).getByRole('button', { name: 'Apply' }).hasAttribute('disabled')).toBe(false), { timeout: 10000 });
    fireEvent.click(within(tuner).getByRole('button', { name: 'Apply' }));

    const tuned = await screen.findByRole('button', { name: /^Lv\.10 vs 1x Hollow Knight: 80% survival, -20 pts vs previous run$/ }, { timeout: 10000 });
    expect(tuned).toBeTruthy();
    expect(screen.getByText(/Enemy HP ×3\.986/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(screen.getByRole('button', { name: 'Lv.10 vs 1x Hollow Knight: 100% survival' })).toBeTruthy();
    expect(screen.queryByText(/Enemy HP ×/)).toBeNull();
    expect(cellButtons()).toHaveLength(4);
  });
});
