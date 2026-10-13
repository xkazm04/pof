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

describe('CombatSimulatorView — scenarioSignature normalization', () => {
  it('does not show a false scenario-mismatch warning when enemy groups are reordered or split across rows', () => {
    const baseScenario = {
      name: 'Baseline',
      playerLevel: 5,
      playerGear: { id: 'starter', name: 'Starter', bonuses: {} },
      playerAbilities: [{ id: 'ga-melee-attack' }, { id: 'ga-fireball' }],
      enemies: [
        { archetypeId: 'ranged-archer', count: 1, level: 5 },
        { archetypeId: 'melee-grunt', count: 3, level: 5 },
      ],
    };
    const candidateScenario = {
      name: 'Candidate',
      playerLevel: 5,
      playerGear: { id: 'starter', name: 'Starter', bonuses: {} },
      playerAbilities: [{ id: 'ga-fireball' }, { id: 'ga-melee-attack' }],
      enemies: [
        { archetypeId: 'melee-grunt', count: 1, level: 5 },
        { archetypeId: 'melee-grunt', count: 2, level: 5 },
        { archetypeId: 'ranged-archer', count: 1, level: 5 },
      ],
    };
    const prevBaseline = storeState.baselineResult;
    const prevComparison = storeState.comparison;
    const prevResult = storeState.result;
    try {
      storeState.baselineResult = {
        config: storeState.defaultConfig,
        scenario: baseScenario,
        summary: storeState.summary,
        durationMs: 40,
      };
      storeState.result = {
        config: storeState.defaultConfig,
        scenario: candidateScenario,
        summary: storeState.summary,
        durationMs: 45,
      };
      storeState.comparison = {
        baseline: storeState.baselineResult,
        candidate: storeState.result,
        deltas: {
          survivalRateDelta: 0, avgDurationDelta: 0, avgDPSDelta: 0, oneShotRateDelta: 0,
        },
        alertDiff: [],
      };

      const { rerender } = render(<CombatSimulatorView />);
      expect(screen.queryByText(/Scenario changed since the baseline was pinned/i)).toBeNull();

      // Actually changing enemy count must still trigger the mismatch banner.
      storeState.result = {
        config: storeState.defaultConfig,
        scenario: {
          ...candidateScenario,
          enemies: [{ archetypeId: 'melee-grunt', count: 4, level: 5 }],
        },
        summary: storeState.summary,
        durationMs: 45,
      };
      rerender(<CombatSimulatorView />);
      expect(screen.getByText(/Scenario changed since the baseline was pinned/i)).toBeTruthy();
    } finally {
      storeState.baselineResult = prevBaseline;
      storeState.comparison = prevComparison;
      storeState.result = prevResult;
    }
  });
});

describe('CombatSimulatorView — ScenarioBuilder ability selection parity', () => {
  it('counts only selected abilities present in available abilities and keeps Select all enabled when a catalog ability is unselected', () => {
    const prevAbilities = storeState.abilities;
    try {
      storeState.abilities = [
        { id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee', baseDamage: 10, cooldownSec: 1, manaCost: 0, range: 2, isAoE: false },
        { id: 'ga-custom-slash', name: 'Custom Slash', type: 'melee', baseDamage: 15, cooldownSec: 2, manaCost: 0, range: 2, isAoE: false },
      ];
      render(<CombatSimulatorView />);
      // Only 1 of the 2 available abilities ('ga-melee-attack') is in default selectedAbilities (which has 5 IDs)
      expect(screen.getByText('(1/2)')).toBeTruthy();

      // Even if 5 abilities are in the catalog (matching selectedAbilities.length === 5) with 1 unselected custom ability, Select all must remain enabled
      cleanup();
      storeState.abilities = [
        { id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee', baseDamage: 10, cooldownSec: 1, manaCost: 0, range: 2, isAoE: false },
        { id: 'ga-combo-finisher', name: 'Combo Finisher', type: 'melee', baseDamage: 20, cooldownSec: 3, manaCost: 0, range: 2, isAoE: false },
        { id: 'ga-dodge', name: 'Dodge', type: 'dodge', baseDamage: 0, cooldownSec: 4, manaCost: 0, range: 0, isAoE: false },
        { id: 'ga-fireball', name: 'Fireball', type: 'ranged', baseDamage: 25, cooldownSec: 3, manaCost: 10, range: 10, isAoE: false },
        { id: 'ga-custom-slash', name: 'Custom Slash', type: 'melee', baseDamage: 15, cooldownSec: 2, manaCost: 0, range: 2, isAoE: false },
      ];
      render(<CombatSimulatorView />);
      expect(screen.getByText('(4/5)')).toBeTruthy();
      const selectAllBtn = screen.getByRole('button', { name: 'Select all' }) as HTMLButtonElement;
      expect(selectAllBtn.disabled).toBe(false);
    } finally {
      storeState.abilities = prevAbilities;
    }
  });
});

describe('CombatSimulatorView — runnable scenario state coverage', () => {
  it('disables the Run button and shows an empty-selection hint when all catalog abilities are cleared or defaultConfig is missing', () => {
    const prevAbilities = storeState.abilities;
    const prevDefaultConfig = storeState.defaultConfig;
    try {
      storeState.abilities = [
        { id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee', baseDamage: 10, cooldownSec: 1, manaCost: 0, range: 2, isAoE: false },
      ];
      const { rerender } = render(<CombatSimulatorView />);
      const runBtn = screen.getByRole('button', { name: /Run 1000 Fights/i }) as HTMLButtonElement;
      expect(runBtn.disabled).toBe(false);

      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
      expect(screen.getByText(/Select at least one ability to run the simulation/i)).toBeTruthy();
      expect(runBtn.disabled).toBe(true);

      fireEvent.click(screen.getByRole('button', { name: 'Select all' }));
      expect(screen.queryByText(/Select at least one ability to run the simulation/i)).toBeNull();
      expect(runBtn.disabled).toBe(false);

      storeState.defaultConfig = null;
      rerender(<CombatSimulatorView />);
      expect(runBtn.disabled).toBe(true);
    } finally {
      storeState.abilities = prevAbilities;
      storeState.defaultConfig = prevDefaultConfig;
    }
  });
});

describe('CombatSimulatorView — FightReportCardPanel clipboard error handling and timer cleanup', () => {
  it('clears the copy feedback timer on unmount and resets Copied state if a subsequent clipboard write fails', async () => {
    const clearTimeoutSpy = vi.spyOn(window, 'clearTimeout');
    try {
      const { unmount } = render(<CombatSimulatorView />);
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      });

      // A subsequent failed copy must immediately clear Copied state rather than leaving stale success feedback
      writeText.mockRejectedValueOnce(new Error('Clipboard permission denied'));
      fireEvent.click(screen.getByRole('button', { name: 'Copied' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Copy' })).toBeTruthy();
      });

      // Trigger another copy and unmount while timer is active — unmount must clear the pending timeout
      writeText.mockResolvedValueOnce(undefined);
      fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
      });
      const callsBeforeUnmount = clearTimeoutSpy.mock.calls.length;
      unmount();
      expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThan(callsBeforeUnmount);
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });
});

describe('CombatSimulatorView — ScenarioBuilder and DistributionChart accessibility', () => {
  it('associates the Gear label, exposes aria-pressed on ability toggles, labels enemy remove buttons, and makes histogram bars keyboard-focusable', () => {
    const prevAbilities = storeState.abilities;
    try {
      storeState.abilities = [
        { id: 'ga-melee-attack', name: 'Melee Attack', type: 'melee', baseDamage: 10, cooldownSec: 1, manaCost: 0, range: 2, isAoE: false },
        { id: 'ga-custom-slash', name: 'Custom Slash', type: 'melee', baseDamage: 15, cooldownSec: 2, manaCost: 0, range: 2, isAoE: false },
      ];
      render(<CombatSimulatorView />);
      fireEvent.click(screen.getByRole('button', { name: 'Advanced' }));

      // Gear select is associated with its label
      const gearSelect = screen.getByLabelText('Gear') as HTMLSelectElement;
      expect(gearSelect.value).toBe('starter');

      // Ability toggle buttons expose aria-pressed
      const meleeBtn = screen.getByRole('button', { name: 'Melee Attack' });
      const customBtn = screen.getByRole('button', { name: 'Custom Slash' });
      expect(meleeBtn.getAttribute('aria-pressed')).toBe('true');
      expect(customBtn.getAttribute('aria-pressed')).toBe('false');

      // Adding a second enemy group exposes labeled remove buttons
      fireEvent.click(screen.getByRole('button', { name: '+ Add enemy group' }));
      expect(screen.getByRole('button', { name: 'Remove enemy group 1' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Remove enemy group 2' })).toBeTruthy();

      // Histogram bars in Advanced view expose accessible labels and tabIndex=0
      const [bar] = screen.getAllByLabelText('0-100: 5');
      expect(bar.getAttribute('tabindex')).toBe('0');
    } finally {
      storeState.abilities = prevAbilities;
    }
  });
});

import { formatNumber } from '@/components/modules/evaluator/CombatSimulatorView/helpers';

describe('CombatSimulatorView — TuningSlidersPanel reset affordance and formatNumber', () => {
  it('disables Reset when tuning matches defaultTuning and enables it when any slider diverges', () => {
    const prevTuning = storeState.tuning as TuningOverrides;
    try {
      const { rerender } = render(<CombatSimulatorView />);
      const resetBtn = screen.getByRole('button', { name: 'Reset' }) as HTMLButtonElement;
      expect(resetBtn.disabled).toBe(true);

      storeState.tuning = { ...prevTuning, playerDamageMul: 1.5 };
      rerender(<CombatSimulatorView />);
      expect(resetBtn.disabled).toBe(false);
    } finally {
      storeState.tuning = prevTuning;
    }
  });

  it('formats negative thousands/millions and non-finite values cleanly in formatNumber', () => {
    expect(formatNumber(-1500)).toBe('-1.5k');
    expect(formatNumber(-2500000)).toBe('-2.5M');
    expect(formatNumber(Number.NaN)).toBe('0');
  });
});
