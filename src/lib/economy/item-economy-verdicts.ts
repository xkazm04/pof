/** ── Item Economy Verdicts ─────────────────────────────────────────────── *
 * Maps a Monte Carlo item-economy run onto the five reward-curve decay
 * detectors (registry: game-economy-tuning#rarity-inflation-and-affix-
 * saturation-alerts). Each verdict carries its value, threshold, BASIS (seed,
 * horizon, agents behind the ratio) and the player-facing consequence.
 *
 * Law: unmeasured is not a pass. A finding inside the sampled range is always
 * reported; a clean detector only PASSES once the endgame window is sampled —
 * otherwise it is `unmeasured`, and runToCoverage() finds the horizon that
 * measures it. Pure: no store, no I/O.
 * ────────────────────────────────────────────────────────────────────────── */

import {
  runItemEconomySim,
  type ItemEconomyConfig,
  type ItemEconomyResult,
  type LevelBracketStats,
} from './item-economy-engine';

export const VERDICT_FAMILIES = [
  'power-plateau', 'rarity-obsolescence', 'modifier-saturation', 'rarity-inflation', 'upgrade-drought',
] as const;
export type VerdictFamily = (typeof VERDICT_FAMILIES)[number];
export type VerdictState = 'pass' | 'warn' | 'critical' | 'unmeasured';

export interface EconomyVerdict {
  family: VerdictFamily;
  label: string;
  state: VerdictState;
  /** Measured value; null when unmeasured */
  value: number | null;
  threshold: number;
  /** Level the value was measured at (worst level), null for pool-wide or unmeasured */
  level: number | null;
  basis: string;
  consequence: string;
}

/** A window of level brackets and how much of it the run actually sampled. */
export interface WindowCoverage {
  from: number;
  to: number;
  levelsSampled: number;
  levelsTotal: number;
  /** Agents whose final level reached the window floor */
  agentsReached: number;
  playerCount: number;
  measured: boolean;
}

/** Horizons (hours) runToCoverage walks, at the same seed, until the endgame is measured. */
export const HORIZON_LADDER: readonly number[] = [80, 160, 320, 640, 1280];

const LABELS: Record<VerdictFamily, string> = {
  'power-plateau': 'Power plateau',
  'rarity-obsolescence': 'Rarity obsolescence',
  'modifier-saturation': 'Modifier saturation',
  'rarity-inflation': 'Rarity inflation',
  'upgrade-drought': 'Upgrade drought',
};

const CONSEQUENCES: Record<VerdictFamily, string> = {
  'power-plateau': 'New drops look indistinguishable from equipped gear, so players stop inspecting loot and disengage.',
  'rarity-obsolescence': 'The top tier becomes the ordinary case and every tier beneath it is junk the player walks past.',
  'modifier-saturation': 'Items become variations on one roll; build diversity collapses and the pool is learned in an afternoon.',
  'rarity-inflation': 'Rare+ drops lose their signal as they grow common, so a rare drop no longer feels like an event.',
  'upgrade-drought': 'Players go whole levels without a gear upgrade and report feeling stuck, however many items drop.',
};

function windowCoverage(result: ItemEconomyResult, from: number, to: number): WindowCoverage {
  const inWindow = result.brackets.filter((b) => b.level >= from && b.level <= to);
  const levelsSampled = inWindow.filter((b) => b.agents > 0).length;
  const floor = result.brackets.find((b) => b.level === from);
  return {
    from, to, levelsSampled, levelsTotal: inWindow.length,
    agentsReached: floor?.agentsReached ?? 0,
    playerCount: result.config.playerCount,
    measured: inWindow.length > 0 && levelsSampled === inWindow.length,
  };
}

/** Early window Lv1-5 (as the engine's inflation ratio uses it). */
export function earlyCoverage(result: ItemEconomyResult): WindowCoverage {
  return windowCoverage(result, 1, Math.min(5, result.config.maxLevel));
}

/** Endgame window Lv(max-3)-max (as the engine's inflation ratio uses it). */
export function endgameCoverage(result: ItemEconomyResult): WindowCoverage {
  const { maxLevel } = result.config;
  return windowCoverage(result, Math.max(1, maxLevel - 3), maxLevel);
}

function describeWindow(name: string, c: WindowCoverage): string {
  return `${name} Lv${c.from}-${c.to}: ${c.agentsReached} of ${c.playerCount} agents reached`
    + ` (${c.levelsSampled}/${c.levelsTotal} levels sampled)`;
}

function runBasis(result: ItemEconomyResult): string {
  const { seed, maxHours, dropsPerHour } = result.config;
  return `seed ${seed}, ${maxHours} h horizon, ${dropsPerHour} drops/h`;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

/** A finding is reported whatever the coverage; a clean detector passes only once the endgame is sampled. */
function settle(
  family: VerdictFamily, found: boolean, severity: 'warn' | 'critical', endgame: WindowCoverage,
  value: number | null, threshold: number, level: number | null, basis: string,
): EconomyVerdict {
  const state: VerdictState = found ? severity : endgame.measured ? 'pass' : 'unmeasured';
  return {
    family, label: LABELS[family], state,
    value: state === 'unmeasured' ? null : value,
    threshold, level: state === 'unmeasured' ? null : level,
    basis, consequence: CONSEQUENCES[family],
  };
}

function sampled(result: ItemEconomyResult): LevelBracketStats[] {
  return result.brackets.filter((b) => b.agents > 0);
}

export function economyVerdicts(result: ItemEconomyResult): EconomyVerdict[] {
  const { maxLevel } = result.config;
  const early = earlyCoverage(result);
  const endgame = endgameCoverage(result);
  const run = runBasis(result);
  const endBasis = describeWindow('endgame', endgame);
  const measured = sampled(result);
  const top = measured.length ? measured[measured.length - 1].level : 0;
  const sampledRange = `sampled Lv1-${top}`;

  // Power plateau: worst level-over-level growth of average equipped power (from Lv3).
  let worstGrowth: number | null = null;
  let plateauLevel: number | null = null;
  for (let i = 1; i < measured.length; i++) {
    const prev = measured[i - 1], curr = measured[i];
    if (curr.level < 3 || prev.avgItemPower <= 0) continue;
    const g = (curr.avgItemPower - prev.avgItemPower) / prev.avgItemPower;
    if (worstGrowth === null || g < worstGrowth) { worstGrowth = g; plateauLevel = curr.level; }
  }
  const plateau = settle('power-plateau', worstGrowth !== null && worstGrowth < 0.02, 'warn', endgame,
    worstGrowth, 0.02, plateauLevel,
    `worst power gain per level ${worstGrowth === null ? 'n/a' : pct(worstGrowth)}`
      + `${plateauLevel ? ` at Lv${plateauLevel}` : ''}, ${sampledRange}; ${endBasis}; ${run}`);

  // Rarity obsolescence: top-tier (legendary) share across the endgame window.
  const endBrackets = measured.filter((b) => b.level >= endgame.from);
  let legendary = 0, legendaryLevel: number | null = null;
  for (const b of endBrackets) {
    if (b.rarityDistribution.legendary >= legendary) { legendary = b.rarityDistribution.legendary; legendaryLevel = b.level; }
  }
  const obsolete = settle('rarity-obsolescence', endgame.measured && legendary > 0.15, 'critical', endgame,
    legendary, 0.15, legendaryLevel,
    `legendary share of drops seen by agents at endgame; ${endBasis}; ${run}`);

  // Modifier saturation: largest single affix share of every affix rolled.
  const pool = Object.entries(result.globalAffixSaturation).sort(([, a], [, b]) => b - a);
  const [topStat, topShare] = pool[0] ?? ['none', 0];
  const saturation = settle('modifier-saturation', topShare > 0.2, 'warn', endgame,
    pool.length ? topShare : null, 0.2, null,
    `largest single affix "${topStat}" is ${pct(topShare)} of the rolled pool, ${sampledRange}; ${endBasis}; ${run}`);

  // Rarity inflation: rare+ share at endgame over early game (engine ratio), 3x warn / 5x critical.
  const both = early.measured && endgame.measured;
  const inflation = result.rarityInflation;
  const inflated = both && inflation > 3;
  const inflationVerdict = settle('rarity-inflation', inflated, inflation > 5 ? 'critical' : 'warn',
    both ? endgame : { ...endgame, measured: false },
    inflation, inflation > 5 ? 5 : 3, maxLevel,
    `rare+ share ${describeWindow('early', early)} vs ${endBasis}; ${run}`);

  // Upgrade drought: gear upgrades made AT each level per sampled agent (cap level excluded —
  // agents stop there, so it only samples the ding hour).
  let worstRate: number | null = null, droughtLevel: number | null = null, droughtLevels = 0;
  for (const b of measured) {
    if (b.level < 3 || b.level >= maxLevel) continue;
    const rate = b.gearReplacementCount / b.agents;
    if (rate < 0.5) droughtLevels++;
    if (worstRate === null || rate < worstRate) { worstRate = rate; droughtLevel = b.level; }
  }
  const drought = settle('upgrade-drought', worstRate !== null && worstRate < 0.5, 'warn', endgame,
    worstRate, 0.5, droughtLevel,
    `fewest upgrades per agent per level ${worstRate === null ? 'n/a' : worstRate.toFixed(2)}`
      + `${droughtLevel ? ` at Lv${droughtLevel}` : ''} (${droughtLevels} level(s) under 0.5), ${sampledRange}`
      + `; ${endBasis}; ${run}`);

  return [plateau, obsolete, saturation, inflationVerdict, drought];
}

export interface RunSummary {
  peakPower: number | null;
  midPower: number | null;
  /** null when the cap bracket was never sampled — never a measured-looking 0 */
  endgamePower: number | null;
  /** null unless both the early and endgame windows are sampled */
  rarityInflation: number | null;
  findings: number;
  criticalCount: number;
  unmeasuredCount: number;
  simTime: number;
}

export function summarizeRun(result: ItemEconomyResult): RunSummary {
  const verdicts = economyVerdicts(result);
  const power = (b: LevelBracketStats | undefined) => (b && b.agents > 0 ? b.avgItemPower : null);
  const measured = sampled(result);
  const inflationMeasured = earlyCoverage(result).measured && endgameCoverage(result).measured;
  return {
    peakPower: measured.length ? Math.max(...measured.map((b) => b.avgItemPower)) : null,
    midPower: power(result.brackets[Math.floor(result.brackets.length / 2)]),
    endgamePower: power(result.brackets[result.brackets.length - 1]),
    rarityInflation: inflationMeasured ? result.rarityInflation : null,
    findings: verdicts.filter((v) => v.state === 'warn' || v.state === 'critical').length,
    criticalCount: verdicts.filter((v) => v.state === 'critical').length,
    unmeasuredCount: verdicts.filter((v) => v.state === 'unmeasured').length,
    simTime: result.durationMs,
  };
}

export interface CoverageRun {
  horizon: number;
  result: ItemEconomyResult;
  verdicts: EconomyVerdict[];
}

/**
 * Re-run at the same seed on each ladder rung above the config's horizon and return the
 * SMALLEST horizon at which no verdict is unmeasured (the config itself if it already is).
 * null when even the top rung leaves the endgame unsampled.
 */
export function runToCoverage(
  config: ItemEconomyConfig, ladder: readonly number[] = HORIZON_LADDER,
): CoverageRun | null {
  const rungs = [config.maxHours, ...[...ladder].sort((a, b) => a - b).filter((h) => h > config.maxHours)];
  for (const horizon of rungs) {
    const result = runItemEconomySim({ ...config, maxHours: horizon });
    const verdicts = economyVerdicts(result);
    if (verdicts.every((v) => v.state !== 'unmeasured')) return { horizon, result, verdicts };
  }
  return null;
}
