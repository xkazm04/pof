import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import type {
  CombatSummary,
  ThreatBreakdown,
  TuningOverrides,
  CombatSimConfig,
} from '@/types/combat-simulator';

// ── Store mock: a selector over a static state object ────────────────────────
const { storeState } = vi.hoisted(() => {
  const tuning: TuningOverrides = {
    playerHealthMul: 1, playerDamageMul: 1, playerArmorMul: 1,
    enemyHealthMul: 1, enemyDamageMul: 1, critMultiplierMul: 1,
    armorEffectivenessWeight: 1, healingMul: 1,
  };
  const config: CombatSimConfig = { iterations: 1000, seed: 7, maxFightDurationSec: 30 };

  const threatBreakdown: ThreatBreakdown = {
    bySource: [{
      enemy: 'Stone Brute', ability: 'Charge Attack', abilityId: 'ga-enemy-charge',
      totalDamage: 800, damageShare: 0.6, killCount: 4, killShare: 0.4,
      nerfSuggestion: 'Primary killer — raise cooldown or lower baseDamage.',
    }],
    byEnemy: [{
      enemy: 'Stone Brute', totalDamage: 800, damageShare: 0.6,
      killCount: 4, killShare: 0.4, nerfSuggestion: 'Primary killer.',
    }],
    totalDeaths: 10,
    totalDamageTaken: 1000,
  };

  const summary: CombatSummary = {
    survivalRate: 0.7,
    avgFightDurationSec: 12,
    medianFightDurationSec: 11,
    avgDamageDealt: 500,
    avgDamageTaken: 300,
    avgPlayerHealthRemaining: 40,
    avgDPS: 42,
    avgEnemyDPS: 18,
    avgCritRate: 0.2,
    abilityHeatmap: { 'Melee Attack': 2.5 },
    damageDealtBuckets: [{ min: 0, max: 100, count: 5 }],
    damageTakenBuckets: [{ min: 0, max: 100, count: 5 }],
    durationBuckets: [{ min: 0, max: 20, count: 5 }],
    oneShotRate: 0,
    threatBreakdown,
  };

  const state: Record<string, unknown> = {
    enemies: [],
    abilities: [],
    gearLoadouts: [{ id: 'starter', name: 'Starter', bonuses: {} }],
    defaultTuning: tuning,
    defaultConfig: config,
    tuning,
    result: {
      config, scenario: { name: 'Lvl 5 vs 3x Grunt' }, durationMs: 50,
    },
    summary,
    alerts: [{
      severity: 'warning', type: 'one-shot',
      message: 'One-shot rate 8% exceeds 5% threshold',
      metric: 'oneShotRate', value: 0.08, threshold: 0.05,
    }],
    baselineResult: null,
    comparison: null,
    isLoading: false,
    isSimulating: false,
    simProgress: 0,
    error: null,
    fetchDefaults: vi.fn(),
    runSimulationStreaming: vi.fn().mockResolvedValue(undefined),
    setTuning: vi.fn(),
    pinBaseline: vi.fn(),
    clearBaseline: vi.fn(),
  };
  return { storeState: state };
});

vi.mock('@/stores/combatSimulatorStore', () => {
  const hook = (selector: (s: typeof storeState) => unknown) => selector(storeState);
  hook.getState = () => storeState;
  return { useCombatSimulatorStore: hook };
});

import { CombatSimulatorView } from '@/components/modules/evaluator/CombatSimulatorView';

const writeText = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});

afterEach(() => cleanup());

describe('CombatSimulatorView — Story Mode', () => {
  it('defaults to Story mode and shows the narrated Fight Report Card', () => {
    render(<CombatSimulatorView />);
    expect(screen.getByRole('button', { name: 'Story' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Advanced' }).getAttribute('aria-pressed')).toBe('false');

    // Plain-language headline + difficulty band, no jargon.
    expect(screen.getByText(/You usually win \(7 of 10 tries\)/)).toBeTruthy();
    expect(screen.getByText('Well Balanced')).toBeTruthy();
    // Top fix names the dominant killer in plain language.
    expect(screen.getByText(/Stone Brute.*Charge Attack.*4 of every 10 deaths/)).toBeTruthy();
  });

  it('hides the numeric panels in Story mode and reveals them in Advanced', () => {
    render(<CombatSimulatorView />);
    // Story mode: the jargon-heavy panels are tucked away.
    expect(screen.queryByText('Ability Usage Heatmap')).toBeNull();
    expect(screen.queryByText('Death Recap & Threat Breakdown')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

    // Advanced reveals the full numeric breakdown…
    expect(screen.getByText('Ability Usage Heatmap')).toBeTruthy();
    expect(screen.getByText('Death Recap & Threat Breakdown')).toBeTruthy();
    // …and the report card stays (it's the headline answer in both modes).
    expect(screen.getByText(/You usually win/)).toBeTruthy();
  });

  it('copies a shareable plain-text report to the clipboard', async () => {
    render(<CombatSimulatorView />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const text = writeText.mock.calls[0][0] as string;
    expect(text).toContain('Fight Report — Lvl 5 vs 3x Grunt');
    expect(text).toContain('You usually win (7 of 10 tries).');
    expect(text).toContain('A typical fight lasts about 12 seconds.');
  });
});

describe('CombatSimulatorView — accessible legends & non-color cues', () => {
  function renderAdvanced() {
    render(<CombatSimulatorView />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
  }

  it('keys the threat dual-bars with a swatch+text legend', () => {
    renderAdvanced();
    const legend = screen.getByRole('list', { name: 'Threat bar legend' });
    expect(within(legend).getByText('Kill share')).toBeTruthy();
    expect(within(legend).getByText('Damage share')).toBeTruthy();
  });

  it('keys the ability heatmap colors with a legend', () => {
    renderAdvanced();
    const legend = screen.getByRole('list', { name: 'Ability heatmap legend' });
    expect(within(legend).getByText('Used')).toBeTruthy();
    expect(within(legend).getByText('Under-used')).toBeTruthy();
  });

  it('annotates the longest heatmap bar with its value directly', () => {
    renderAdvanced();
    // 'Melee Attack' is the only (and therefore longest) bar → value sits inline.
    expect(screen.getByText('2.5')).toBeTruthy();
  });

  it('marks p50 + p95 on each of the three distribution charts', () => {
    renderAdvanced();
    expect(screen.getAllByText('p50')).toHaveLength(3);
    expect(screen.getAllByText('p95')).toHaveLength(3);
  });
});

describe('CombatSimulatorView — plain-language metric tooltips', () => {
  it('decodes a summary KPI’s jargon with an inline definition + example popover', () => {
    render(<CombatSimulatorView />);
    // The "Player DPS" KPI label is now an inline help trigger (visible in both modes).
    const trigger = screen.getByRole('button', { name: /^Player DPS:/ });
    expect(screen.queryByRole('tooltip')).toBeNull();
    fireEvent.focus(trigger);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Damage Per Second');
    expect(tip.textContent).toContain('Example:');
  });

  it('decodes the heatmap title and threat legend jargon in Advanced mode', () => {
    render(<CombatSimulatorView />);
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));
    // Heatmap title and "Kill share" legend entry expose plain-language tooltips…
    expect(screen.getByRole('button', { name: /^Ability Usage:/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Kill Share:/ })).toBeTruthy();
    // …while the legend's visible text (and its color key) is unchanged.
    const legend = screen.getByRole('list', { name: 'Threat bar legend' });
    expect(within(legend).getByText('Kill share')).toBeTruthy();
  });
});
