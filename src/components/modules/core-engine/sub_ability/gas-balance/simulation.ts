import type {
  CombatantStats, EnemyConfig, SimScenario, SimResults,
  SimIterationResult, SensitivityPoint, SensitivityResult,
  LevelSweepPoint, LevelSweepConfig,
} from './data';

/* ── Attribute Scaling ────────────────────────────────────────────────── */

/** Apply attribute scaling: Strength->AttackPower (x2), Intelligence->MaxMana (x5) */
export function applyScaling(stats: CombatantStats): CombatantStats {
  return {
    ...stats,
    attackPower: stats.attackPower + stats.strength * 2,
    maxMana: stats.maxMana + stats.intelligence * 5,
  };
}

/* ── Damage Pipeline ──────────────────────────────────────────────────── */

/**
 * Damage pipeline per hit (mirrors UE5 DamageExecution):
 * 1. scaledDamage = baseDamage * (1 + attackPower / 100)
 * 2. armorReduction = targetArmor / (targetArmor + 100)
 * 3. afterArmor = scaledDamage * (1 - armorReduction)
 * 4. if crit: afterArmor * critDamage, else afterArmor
 */
function rollDamage(attacker: CombatantStats, targetArmor: number): { damage: number; isCrit: boolean } {
  const scaledDamage = attacker.baseDamage * (1 + attacker.attackPower / 100);
  const armorReduction = targetArmor / (targetArmor + 100);
  const afterArmor = scaledDamage * (1 - armorReduction);
  const isCrit = Math.random() < attacker.criticalChance;
  const damage = isCrit ? afterArmor * attacker.criticalDamage : afterArmor;
  return { damage, isCrit };
}

/* ── Single Iteration ─────────────────────────────────────────────────── */

/** Run one iteration: player attacks all enemies sequentially, enemies attack back */
export function runIteration(player: CombatantStats, enemies: EnemyConfig[]): SimIterationResult {
  const scaledPlayer = applyScaling(player);
  const allEnemies = enemies.flatMap(e =>
    Array.from({ length: e.count }, () => ({
      ...applyScaling(e.stats),
      currentHp: applyScaling(e.stats).maxHealth,
    }))
  );

  let playerHp = scaledPlayer.maxHealth;
  let totalDamage = 0;
  let totalHits = 0;
  let critHits = 0;
  let time = 0;
  const dt = 0.05;

  let playerNextAttack = 0;
  const enemyNextAttack = allEnemies.map(() => Math.random() * (1 / 0.5));

  while (time < 300) {
    if (time >= playerNextAttack) {
      const target = allEnemies.find(e => e.currentHp > 0);
      if (!target) break;
      const { damage, isCrit } = rollDamage(scaledPlayer, target.armor);
      target.currentHp -= damage;
      totalDamage += damage;
      totalHits++;
      if (isCrit) critHits++;
      playerNextAttack = time + (1 / scaledPlayer.attackSpeed);
    }

    for (let i = 0; i < allEnemies.length; i++) {
      const enemy = allEnemies[i];
      if (enemy.currentHp <= 0) continue;
      if (time >= enemyNextAttack[i]) {
        const { damage } = rollDamage(enemy, scaledPlayer.armor);
        playerHp -= damage;
        enemyNextAttack[i] = time + (1 / enemy.attackSpeed);
      }
    }

    const allDead = allEnemies.every(e => e.currentHp <= 0);
    if (allDead || playerHp <= 0) break;
    time += dt;
  }

  const overkill = allEnemies.reduce((sum, e) => sum + Math.max(0, -e.currentHp), 0);
  const allDead = allEnemies.every(e => e.currentHp <= 0);

  return { ttk: time, totalDamage, totalHits, critHits, overkill, playerSurvived: playerHp > 0 && allDead, playerHpRemaining: Math.max(0, playerHp) };
}

/* ── Statistics Helpers ────────────────────────────────────────────────── */

const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] ?? 0;
const stdDev = (arr: number[], avg: number) => Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);

/* ── Full Simulation ──────────────────────────────────────────────────── */

function computeResults(scenario: SimScenario, iterations: SimIterationResult[]): SimResults {
  const ttks = iterations.map(it => it.ttk).sort((a, b) => a - b);
  const dpsList = iterations.map(it => it.ttk > 0 ? it.totalDamage / it.ttk : 0).sort((a, b) => a - b);
  const ttkMean = mean(ttks);
  const scaledPlayer = applyScaling(scenario.player);
  const armorMitigation = scaledPlayer.armor / (scaledPlayer.armor + 100);
  const effectiveHp = scaledPlayer.maxHealth / (1 - armorMitigation);
  const totalCrits = iterations.reduce((s, it) => s + it.critHits, 0);
  const totalHitsAll = iterations.reduce((s, it) => s + it.totalHits, 0);

  return {
    scenarioId: scenario.id,
    iterations,
    ttkStats: {
      mean: ttkMean, median: percentile(ttks, 50), p10: percentile(ttks, 10),
      p90: percentile(ttks, 90), min: ttks[0] ?? 0, max: ttks[ttks.length - 1] ?? 0,
      stdDev: stdDev(ttks, ttkMean),
    },
    dpsStats: { mean: mean(dpsList), median: percentile(dpsList, 50), min: dpsList[0] ?? 0, max: dpsList[dpsList.length - 1] ?? 0 },
    critRate: totalHitsAll > 0 ? totalCrits / totalHitsAll : 0,
    survivalRate: iterations.filter(it => it.playerSurvived).length / iterations.length,
    effectiveHp, armorMitigation, timestamp: Date.now(),
  };
}

/** Run full Monte Carlo simulation */
export function runSimulation(scenario: SimScenario): SimResults {
  const iterations: SimIterationResult[] = [];
  for (let i = 0; i < scenario.iterations; i++) {
    iterations.push(runIteration(scenario.player, scenario.enemies));
  }
  return computeResults(scenario, iterations);
}

/** Finalize simulation results from pre-collected iterations (chunked runner) */
export function finalizeSimulation(scenario: SimScenario, iterations: SimIterationResult[]): SimResults {
  return computeResults(scenario, iterations);
}

/* ── Sensitivity Analysis ─────────────────────────────────────────────── */

export function runSensitivity(
  scenario: SimScenario,
  attribute: keyof CombatantStats,
  range: { min: number; max: number; steps: number },
): SensitivityResult {
  const points: SensitivityPoint[] = [];
  const step = (range.max - range.min) / range.steps;

  for (let i = 0; i <= range.steps; i++) {
    const value = range.min + step * i;
    const modified = { ...scenario, player: { ...scenario.player, [attribute]: value } };
    const result = runSimulation({ ...modified, iterations: Math.min(modified.iterations, 500) });
    points.push({ value, dps: result.dpsStats.mean, ttk: result.ttkStats.mean, ehp: result.effectiveHp });
  }

  let diminishingAt: number | null = null;
  if (points.length >= 3) {
    const initialRate = (points[1].dps - points[0].dps) / step;
    for (let i = 2; i < points.length; i++) {
      const rate = (points[i].dps - points[i - 1].dps) / step;
      if (initialRate > 0 && rate < initialRate * 0.5) {
        diminishingAt = points[i - 1].value;
        break;
      }
    }
  }

  return { attribute, points, diminishingAt };
}

/* ── Level Sweep ──────────────────────────────────────────────────────── */

function scalePlayerToLevel(base: CombatantStats, targetLevel: number): CombatantStats {
  const d = targetLevel - base.level;
  return {
    ...base, level: targetLevel,
    maxHealth: Math.max(100, base.maxHealth + d * 10),
    maxMana: Math.max(0, base.maxMana + d * 5),
    strength: Math.max(1, Math.round(base.strength + d * 1.2)),
    dexterity: Math.max(1, Math.round(base.dexterity + d * 0.8)),
    intelligence: Math.max(1, Math.round(base.intelligence + d * 0.6)),
    armor: Math.max(0, Math.round(base.armor + d * 1.5)),
    attackPower: Math.max(1, Math.round(base.attackPower + d * 2)),
    baseDamage: Math.max(10, Math.round(base.baseDamage + d * 1.5)),
    criticalChance: Math.min(0.8, Math.max(0, base.criticalChance + d * 0.003)),
    criticalDamage: base.criticalDamage,
    attackSpeed: Math.max(0.3, base.attackSpeed + d * 0.01),
  };
}

function scaleEnemyToLevel(base: CombatantStats, targetLevel: number): CombatantStats {
  const ratio = Math.max(0.2, targetLevel / Math.max(1, base.level));
  return {
    ...base, level: targetLevel,
    maxHealth: Math.max(50, Math.round(base.maxHealth * ratio)),
    armor: Math.max(0, Math.round(base.armor * ratio)),
    attackPower: Math.max(1, Math.round(base.attackPower * ratio)),
    baseDamage: Math.max(5, Math.round(base.baseDamage * ratio)),
    strength: Math.max(1, Math.round(base.strength * ratio)),
    dexterity: Math.max(1, Math.round(base.dexterity * ratio)),
    intelligence: Math.max(1, Math.round(base.intelligence * ratio)),
    criticalChance: base.criticalChance, criticalDamage: base.criticalDamage,
    attackSpeed: base.attackSpeed, maxMana: base.maxMana, name: base.name,
  };
}

function getEnemyLevel(playerLevel: number, baseEnemyLevel: number, config: LevelSweepConfig): number {
  switch (config.enemyScaling) {
    case 'fixed': return baseEnemyLevel;
    case 'match': return playerLevel;
    case 'offset': return Math.max(1, playerLevel + config.enemyLevelOffset);
  }
}

export function runLevelSweep(scenario: SimScenario, config: LevelSweepConfig): LevelSweepPoint[] {
  const points: LevelSweepPoint[] = [];
  for (let level = config.minLevel; level <= config.maxLevel; level++) {
    const scaledPlayer = scalePlayerToLevel(scenario.player, level);
    const scaledEnemies = scenario.enemies.map(e => ({
      ...e, stats: scaleEnemyToLevel(e.stats, getEnemyLevel(level, e.stats.level, config)),
    }));
    const result = runSimulation({ ...scenario, player: scaledPlayer, enemies: scaledEnemies, iterations: config.iterationsPerLevel });
    points.push({ level, ttk: result.ttkStats.mean, dps: result.dpsStats.mean, survivalRate: result.survivalRate, ehp: result.effectiveHp });
  }
  return points;
}

export function detectBreakpoints(points: LevelSweepPoint[]): { level: number; reason: string }[] {
  const breakpoints: { level: number; reason: string }[] = [];
  for (const p of points) {
    if (p.survivalRate < 0.1) breakpoints.push({ level: p.level, reason: 'Near-death (<10% survival)' });
    else if (p.survivalRate > 0.99 && p.ttk < 1.0) breakpoints.push({ level: p.level, reason: 'Trivial (>99% survival, <1s TTK)' });
    else if (p.ttk > 60) breakpoints.push({ level: p.level, reason: 'Stall (>60s TTK)' });
  }
  return breakpoints;
}

/* ── Histogram ────────────────────────────────────────────────────────── */

export interface HistogramBin { low: number; high: number; count: number }

export function buildHistogram(values: number[], buckets: number): { min: number; max: number; bins: HistogramBin[] } {
  if (values.length === 0) return { min: 0, max: 0, bins: [] };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min || 1;
  const binWidth = range / buckets;
  const bins = Array.from({ length: buckets }, (_, i) => ({ low: min + i * binWidth, high: min + (i + 1) * binWidth, count: 0 }));
  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), buckets - 1);
    bins[idx].count++;
  }
  return { min, max, bins };
}
