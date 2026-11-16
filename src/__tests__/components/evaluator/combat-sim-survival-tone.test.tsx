import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { CombatSummary, TuningOverrides, CombatSimConfig } from '@/types/combat-simulator';
import { survivalTone, difficultyBand } from '@/lib/balance/encounter-bands';

// The survival readout's colour and the Fight Report Card's band are two readers of
// one law (`@/lib/balance/encounter-bands`): "never restate a cut inline in a reader".
// A ring that reads "good" green while the card says "Too Easy" is the defect.

const { storeState } = vi.hoisted(() => {
  const tuning: TuningOverrides = {
    playerHealthMul: 1, playerDamageMul: 1, playerArmorMul: 1,
    enemyHealthMul: 1, enemyDamageMul: 1, critMultiplierMul: 1,
    armorEffectivenessWeight: 1, healingMul: 1,
  };
  const config: CombatSimConfig = { iterations: 1000, seed: 7, maxFightDurationSec: 30 };
  const state: Record<string, unknown> = {
    enemies: [], abilities: [],
    gearLoadouts: [{ id: 'starter', name: 'Starter', bonuses: {} }],
    defaultTuning: tuning, defaultConfig: config, tuning,
    result: null, summary: null, alerts: [], baselineResult: null, comparison: null,
    isLoading: false, isSimulating: false, simProgress: 0, error: null,
    fetchDefaults: vi.fn(), runSimulationStreaming: vi.fn().mockResolvedValue(undefined),
    setTuning: vi.fn(), pinBaseline: vi.fn(), clearBaseline: vi.fn(),
  };
  return { storeState: state };
});

vi.mock('@/stores/combatSimulatorStore', () => {
  const hook = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  hook.getState = () => storeState;
  return { useCombatSimulatorStore: hook };
});

import { CombatSimulatorView } from '@/components/modules/evaluator/CombatSimulatorView';

afterEach(() => cleanup());

function rgbOf(hex: string): string {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

function summaryAt(rate: number): CombatSummary {
  return {
    survivalRate: rate, avgFightDurationSec: 12, medianFightDurationSec: 11, avgDamageDealt: 500,
    avgDamageTaken: 300, avgPlayerHealthRemaining: 40, avgDPS: 42, avgEnemyDPS: 18, avgCritRate: 0.2,
    abilityHeatmap: {}, damageDealtBuckets: [], damageTakenBuckets: [], durationBuckets: [], oneShotRate: 0,
    threatBreakdown: { bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 },
  } as CombatSummary;
}

describe('survival readout colour follows the shared encounter-band law', () => {
  // One rate inside each region where the old inline 0.7 / 0.4 cuts disagreed with the bands.
  for (const rate of [0.95, 0.65, 0.38]) {
    it(`rate ${rate} (${difficultyBand(rate)}) renders in survivalTone`, () => {
      storeState.summary = summaryAt(rate);
      render(<CombatSimulatorView />);
      const value = screen.getByText(`${(rate * 100).toFixed(1)}%`) as HTMLElement;
      expect(value.style.color).toBe(rgbOf(survivalTone(rate)));
    });
  }
});
