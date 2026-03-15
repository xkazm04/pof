'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Play, BarChart3, Target, Shield, Swords, Heart, Zap,
  Plus, Trash2, RotateCcw, TrendingUp, TrendingDown,
  Activity, Crosshair, Users, ChevronRight,
  AlertTriangle, Settings2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  STATUS_SUCCESS, STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_ORANGE, ACCENT_EMERALD,
  MODULE_COLORS, OPACITY_15, OPACITY_20,
} from '@/lib/chart-colors';
import { SurfaceCard } from '@/components/ui/SurfaceCard';
import { SectionLabel } from './_shared';

const ACCENT = MODULE_COLORS.systems;

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION DATA MODEL
   ══════════════════════════════════════════════════════════════════════════ */

interface CombatantStats {
  name: string;
  level: number;
  maxHealth: number;
  maxMana: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  armor: number;
  attackPower: number;
  criticalChance: number;   // 0–1
  criticalDamage: number;   // multiplier e.g. 1.5
  baseDamage: number;
  attackSpeed: number;      // attacks per second
}

interface EnemyConfig {
  id: string;
  stats: CombatantStats;
  count: number;
}

interface SimScenario {
  id: string;
  name: string;
  player: CombatantStats;
  enemies: EnemyConfig[];
  iterations: number;
}

interface SimIterationResult {
  ttk: number;           // time-to-kill in seconds
  totalDamage: number;
  totalHits: number;
  critHits: number;
  overkill: number;
  playerSurvived: boolean;
  playerHpRemaining: number;
}

interface SimResults {
  scenarioId: string;
  iterations: SimIterationResult[];
  ttkStats: { mean: number; median: number; p10: number; p90: number; min: number; max: number; stdDev: number };
  dpsStats: { mean: number; median: number; min: number; max: number };
  critRate: number;       // actual crit rate observed
  survivalRate: number;
  effectiveHp: number;    // player EHP considering armor
  armorMitigation: number; // % damage reduced by armor
  timestamp: number;
}

interface SensitivityPoint {
  value: number;
  dps: number;
  ttk: number;
  ehp: number;
}

interface SensitivityResult {
  attribute: string;
  points: SensitivityPoint[];
  diminishingAt: number | null; // value where returns start diminishing
}

/* ── Presets ───────────────────────────────────────────────────────────── */

const DEFAULT_PLAYER: CombatantStats = {
  name: 'Player',
  level: 15,
  maxHealth: 500,
  maxMana: 200,
  strength: 30,
  dexterity: 20,
  intelligence: 15,
  armor: 20,
  attackPower: 70,       // base 10 + Str*2 = 70
  criticalChance: 0.15,
  criticalDamage: 1.5,
  baseDamage: 50,
  attackSpeed: 1.2,
};

const ENEMY_PRESETS: Record<string, CombatantStats> = {
  skeleton: {
    name: 'Skeleton Warrior',
    level: 12,
    maxHealth: 150,
    maxMana: 0,
    strength: 15,
    dexterity: 10,
    intelligence: 5,
    armor: 10,
    attackPower: 30,
    criticalChance: 0.05,
    criticalDamage: 1.5,
    baseDamage: 25,
    attackSpeed: 0.8,
  },
  golem: {
    name: 'Stone Golem',
    level: 18,
    maxHealth: 800,
    maxMana: 0,
    strength: 40,
    dexterity: 5,
    intelligence: 3,
    armor: 60,
    attackPower: 50,
    criticalChance: 0,
    criticalDamage: 1.0,
    baseDamage: 45,
    attackSpeed: 0.5,
  },
  mage: {
    name: 'Dark Mage',
    level: 16,
    maxHealth: 200,
    maxMana: 300,
    strength: 8,
    dexterity: 12,
    intelligence: 35,
    armor: 5,
    attackPower: 80,
    criticalChance: 0.2,
    criticalDamage: 2.0,
    baseDamage: 60,
    attackSpeed: 0.7,
  },
  boss: {
    name: 'Dungeon Boss',
    level: 20,
    maxHealth: 2500,
    maxMana: 500,
    strength: 50,
    dexterity: 25,
    intelligence: 30,
    armor: 40,
    attackPower: 100,
    criticalChance: 0.15,
    criticalDamage: 2.0,
    baseDamage: 80,
    attackSpeed: 0.6,
  },
};

const SCENARIO_PRESETS: SimScenario[] = [
  {
    id: 'trash-pack',
    name: 'Trash Pack (3× Skeletons)',
    player: { ...DEFAULT_PLAYER },
    enemies: [{ id: 'e1', stats: { ...ENEMY_PRESETS.skeleton }, count: 3 }],
    iterations: 2000,
  },
  {
    id: 'mixed-pack',
    name: 'Mixed Pack (2× Skeleton + 1× Mage)',
    player: { ...DEFAULT_PLAYER },
    enemies: [
      { id: 'e1', stats: { ...ENEMY_PRESETS.skeleton }, count: 2 },
      { id: 'e2', stats: { ...ENEMY_PRESETS.mage }, count: 1 },
    ],
    iterations: 2000,
  },
  {
    id: 'boss-fight',
    name: 'Boss Encounter',
    player: { ...DEFAULT_PLAYER },
    enemies: [{ id: 'e1', stats: { ...ENEMY_PRESETS.boss }, count: 1 }],
    iterations: 2000,
  },
];

/* ══════════════════════════════════════════════════════════════════════════
   SIMULATION ENGINE — Monte Carlo damage pipeline
   ══════════════════════════════════════════════════════════════════════════ */

/** Apply attribute scaling: Strength→AttackPower (×2), Intelligence→MaxMana (×5) */
function applyScaling(stats: CombatantStats): CombatantStats {
  return {
    ...stats,
    attackPower: stats.attackPower + stats.strength * 2,
    maxMana: stats.maxMana + stats.intelligence * 5,
  };
}

/**
 * Damage pipeline per hit (mirrors UE5 DamageExecution):
 * 1. scaledDamage = baseDamage × (1 + attackPower / 100)
 * 2. armorReduction = targetArmor / (targetArmor + 100)
 * 3. afterArmor = scaledDamage × (1 - armorReduction)
 * 4. if crit: afterArmor × critDamage, else afterArmor
 */
function rollDamage(attacker: CombatantStats, targetArmor: number): { damage: number; isCrit: boolean } {
  const scaledDamage = attacker.baseDamage * (1 + attacker.attackPower / 100);
  const armorReduction = targetArmor / (targetArmor + 100);
  const afterArmor = scaledDamage * (1 - armorReduction);

  const isCrit = Math.random() < attacker.criticalChance;
  const damage = isCrit ? afterArmor * attacker.criticalDamage : afterArmor;

  return { damage, isCrit };
}

/** Run one iteration: player attacks all enemies sequentially, enemies attack back */
function runIteration(player: CombatantStats, enemies: EnemyConfig[]): SimIterationResult {
  const scaledPlayer = applyScaling(player);

  // Flatten enemies
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
  const dt = 0.05; // simulation timestep (50ms)

  let playerNextAttack = 0;
  const enemyNextAttack = allEnemies.map(() => Math.random() * (1 / 0.5)); // stagger start

  while (time < 300) { // 5 minute max
    // Player attacks next alive enemy
    if (time >= playerNextAttack) {
      const target = allEnemies.find(e => e.currentHp > 0);
      if (!target) break; // all dead

      const { damage, isCrit } = rollDamage(scaledPlayer, target.armor);
      target.currentHp -= damage;
      totalDamage += damage;
      totalHits++;
      if (isCrit) critHits++;
      playerNextAttack = time + (1 / scaledPlayer.attackSpeed);
    }

    // Enemies attack player
    for (let i = 0; i < allEnemies.length; i++) {
      const enemy = allEnemies[i];
      if (enemy.currentHp <= 0) continue;
      if (time >= enemyNextAttack[i]) {
        const { damage } = rollDamage(enemy, scaledPlayer.armor);
        playerHp -= damage;
        enemyNextAttack[i] = time + (1 / enemy.attackSpeed);
      }
    }

    // Check end conditions
    const allDead = allEnemies.every(e => e.currentHp <= 0);
    if (allDead || playerHp <= 0) break;

    time += dt;
  }

  const overkill = allEnemies.reduce((sum, e) => sum + Math.max(0, -e.currentHp), 0);
  const allDead = allEnemies.every(e => e.currentHp <= 0);

  return {
    ttk: time,
    totalDamage,
    totalHits,
    critHits,
    overkill,
    playerSurvived: playerHp > 0 && allDead,
    playerHpRemaining: Math.max(0, playerHp),
  };
}

/** Run full Monte Carlo simulation */
function runSimulation(scenario: SimScenario): SimResults {
  const iterations: SimIterationResult[] = [];

  for (let i = 0; i < scenario.iterations; i++) {
    iterations.push(runIteration(scenario.player, scenario.enemies));
  }

  const ttks = iterations.map(it => it.ttk).sort((a, b) => a - b);
  const dpsList = iterations.map(it => it.ttk > 0 ? it.totalDamage / it.ttk : 0).sort((a, b) => a - b);

  const mean = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const percentile = (arr: number[], p: number) => arr[Math.floor(arr.length * p / 100)] ?? 0;
  const stdDev = (arr: number[], avg: number) => Math.sqrt(arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length);

  const ttkMean = mean(ttks);

  // Effective HP: HP / (1 - armorReduction)
  const scaledPlayer = applyScaling(scenario.player);
  const armorMitigation = scaledPlayer.armor / (scaledPlayer.armor + 100);
  const effectiveHp = scaledPlayer.maxHealth / (1 - armorMitigation);

  const totalCrits = iterations.reduce((s, it) => s + it.critHits, 0);
  const totalHitsAll = iterations.reduce((s, it) => s + it.totalHits, 0);

  return {
    scenarioId: scenario.id,
    iterations,
    ttkStats: {
      mean: ttkMean,
      median: percentile(ttks, 50),
      p10: percentile(ttks, 10),
      p90: percentile(ttks, 90),
      min: ttks[0] ?? 0,
      max: ttks[ttks.length - 1] ?? 0,
      stdDev: stdDev(ttks, ttkMean),
    },
    dpsStats: {
      mean: mean(dpsList),
      median: percentile(dpsList, 50),
      min: dpsList[0] ?? 0,
      max: dpsList[dpsList.length - 1] ?? 0,
    },
    critRate: totalHitsAll > 0 ? totalCrits / totalHitsAll : 0,
    survivalRate: iterations.filter(it => it.playerSurvived).length / iterations.length,
    effectiveHp,
    armorMitigation,
    timestamp: Date.now(),
  };
}

/** Run sensitivity analysis for a single attribute */
function runSensitivity(
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
    points.push({
      value,
      dps: result.dpsStats.mean,
      ttk: result.ttkStats.mean,
      ehp: result.effectiveHp,
    });
  }

  // Detect diminishing returns: where marginal DPS gain drops below 50% of initial rate
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

/* ══════════════════════════════════════════════════════════════════════════
   LEVEL SWEEP ENGINE — runs simulation across player levels 1–50
   ══════════════════════════════════════════════════════════════════════════ */

interface LevelSweepPoint {
  level: number;
  ttk: number;
  dps: number;
  survivalRate: number;
  ehp: number;
}

interface LevelSweepConfig {
  minLevel: number;
  maxLevel: number;
  enemyScaling: 'fixed' | 'match' | 'offset';
  enemyLevelOffset: number;
  iterationsPerLevel: number;
}

const DEFAULT_SWEEP_CONFIG: LevelSweepConfig = {
  minLevel: 1,
  maxLevel: 50,
  enemyScaling: 'match',
  enemyLevelOffset: 0,
  iterationsPerLevel: 300,
};

/** Scale player stats per level using the same curves as ARPGPlayerCharacter */
function scalePlayerToLevel(base: CombatantStats, targetLevel: number): CombatantStats {
  const levelDiff = targetLevel - base.level;
  const hpPerLevel = 10;
  const manaPerLevel = 5;
  const strPerLevel = 1.2;
  const dexPerLevel = 0.8;
  const intPerLevel = 0.6;
  const armorPerLevel = 1.5;
  const atkPowPerLevel = 2;
  const baseDmgPerLevel = 1.5;

  return {
    ...base,
    level: targetLevel,
    maxHealth: Math.max(100, base.maxHealth + levelDiff * hpPerLevel),
    maxMana: Math.max(0, base.maxMana + levelDiff * manaPerLevel),
    strength: Math.max(1, Math.round(base.strength + levelDiff * strPerLevel)),
    dexterity: Math.max(1, Math.round(base.dexterity + levelDiff * dexPerLevel)),
    intelligence: Math.max(1, Math.round(base.intelligence + levelDiff * intPerLevel)),
    armor: Math.max(0, Math.round(base.armor + levelDiff * armorPerLevel)),
    attackPower: Math.max(1, Math.round(base.attackPower + levelDiff * atkPowPerLevel)),
    baseDamage: Math.max(10, Math.round(base.baseDamage + levelDiff * baseDmgPerLevel)),
    criticalChance: Math.min(0.8, Math.max(0, base.criticalChance + levelDiff * 0.003)),
    criticalDamage: base.criticalDamage,
    attackSpeed: Math.max(0.3, base.attackSpeed + levelDiff * 0.01),
  };
}

/** Scale enemy stats proportionally to a target level */
function scaleEnemyToLevel(base: CombatantStats, targetLevel: number): CombatantStats {
  const ratio = Math.max(0.2, targetLevel / Math.max(1, base.level));
  return {
    ...base,
    level: targetLevel,
    maxHealth: Math.max(50, Math.round(base.maxHealth * ratio)),
    armor: Math.max(0, Math.round(base.armor * ratio)),
    attackPower: Math.max(1, Math.round(base.attackPower * ratio)),
    baseDamage: Math.max(5, Math.round(base.baseDamage * ratio)),
    strength: Math.max(1, Math.round(base.strength * ratio)),
    dexterity: Math.max(1, Math.round(base.dexterity * ratio)),
    intelligence: Math.max(1, Math.round(base.intelligence * ratio)),
    criticalChance: base.criticalChance,
    criticalDamage: base.criticalDamage,
    attackSpeed: base.attackSpeed,
    maxMana: base.maxMana,
    name: base.name,
  };
}

/** Compute enemy level based on sweep config */
function getEnemyLevel(playerLevel: number, baseEnemyLevel: number, config: LevelSweepConfig): number {
  switch (config.enemyScaling) {
    case 'fixed': return baseEnemyLevel;
    case 'match': return playerLevel;
    case 'offset': return Math.max(1, playerLevel + config.enemyLevelOffset);
  }
}

/** Run level sweep across a range of player levels */
function runLevelSweep(scenario: SimScenario, config: LevelSweepConfig): LevelSweepPoint[] {
  const points: LevelSweepPoint[] = [];

  for (let level = config.minLevel; level <= config.maxLevel; level++) {
    const scaledPlayer = scalePlayerToLevel(scenario.player, level);
    const scaledEnemies: EnemyConfig[] = scenario.enemies.map(e => ({
      ...e,
      stats: scaleEnemyToLevel(e.stats, getEnemyLevel(level, e.stats.level, config)),
    }));

    const sweepScenario: SimScenario = {
      ...scenario,
      player: scaledPlayer,
      enemies: scaledEnemies,
      iterations: config.iterationsPerLevel,
    };

    const result = runSimulation(sweepScenario);
    points.push({
      level,
      ttk: result.ttkStats.mean,
      dps: result.dpsStats.mean,
      survivalRate: result.survivalRate,
      ehp: result.effectiveHp,
    });
  }

  return points;
}

/** Detect balance breakpoint zones where metrics go out of bounds */
function detectBreakpoints(points: LevelSweepPoint[]): { level: number; reason: string }[] {
  const breakpoints: { level: number; reason: string }[] = [];
  for (const p of points) {
    if (p.survivalRate < 0.1) {
      breakpoints.push({ level: p.level, reason: 'Near-death (<10% survival)' });
    } else if (p.survivalRate > 0.99 && p.ttk < 1.0) {
      breakpoints.push({ level: p.level, reason: 'Trivial (>99% survival, <1s TTK)' });
    } else if (p.ttk > 60) {
      breakpoints.push({ level: p.level, reason: 'Stall (>60s TTK)' });
    }
  }
  return breakpoints;
}

/* ══════════════════════════════════════════════════════════════════════════
   HISTOGRAM HELPERS
   ══════════════════════════════════════════════════════════════════════════ */

function buildHistogram(values: number[], buckets: number): { min: number; max: number; bins: { low: number; high: number; count: number }[] } {
  if (values.length === 0) return { min: 0, max: 0, bins: [] };
  const sorted = [...values].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const range = max - min || 1;
  const binWidth = range / buckets;

  const bins = Array.from({ length: buckets }, (_, i) => ({
    low: min + i * binWidth,
    high: min + (i + 1) * binWidth,
    count: 0,
  }));

  for (const v of values) {
    const idx = Math.min(Math.floor((v - min) / binWidth), buckets - 1);
    bins[idx].count++;
  }

  return { min, max, bins };
}

/* ══════════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ══════════════════════════════════════════════════════════════════════════ */

/** Compact stat input */
function StatInput({ label, value, onChange, min, max, step, icon: Icon, color, unit, hint }: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  icon?: typeof Heart;
  color: string;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5 group">
      {Icon && <Icon className="w-3 h-3 flex-shrink-0" style={{ color }} />}
      <span className="text-2xs text-text-muted w-16 truncate">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 accent-current cursor-pointer"
        style={{ color }}
      />
      <div className="w-14 text-right flex-shrink-0">
        <span className="text-2xs font-mono" style={{ color }}>
          {step && step < 1 ? value.toFixed(2) : value}{unit ?? ''}
        </span>
        {hint && <div className="text-2xs font-mono text-text-muted opacity-60 leading-tight">{hint}</div>}
      </div>
    </div>
  );
}

/** Histogram chart with custom tooltip + crosshair */
function HistogramChart({ bins, maxCount, color, formatRange, barHeight = 64 }: {
  bins: { low: number; high: number; count: number }[];
  maxCount: number;
  color: string;
  formatRange: (bin: { low: number; high: number; count: number }) => string;
  barHeight?: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative" onMouseLeave={() => setHoveredIdx(null)}>
      <div className="flex items-end gap-px" style={{ height: barHeight }}>
        {bins.map((bin, i) => {
          const pct = maxCount > 0 ? (bin.count / maxCount) * 100 : 0;
          const isHovered = hoveredIdx === i;
          return (
            <div
              key={i}
              className="flex-1 min-w-[3px] h-full flex items-end relative cursor-crosshair"
              onMouseEnter={() => setHoveredIdx(i)}
            >
              <motion.div
                className="w-full rounded-t-sm transition-opacity duration-100"
                style={{
                  backgroundColor: color,
                  height: `${pct}%`,
                  minHeight: bin.count > 0 ? 1 : 0,
                  opacity: hoveredIdx !== null && !isHovered ? 0.5 : 1,
                }}
                initial={{ height: 0 }}
                animate={{ height: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
              {/* Crosshair line */}
              {isHovered && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-px w-px pointer-events-none"
                  style={{ height: barHeight, backgroundColor: `${color}80` }}
                />
              )}
            </div>
          );
        })}
      </div>
      {/* Custom tooltip */}
      {hoveredIdx !== null && bins[hoveredIdx] && (
        <div
          className="absolute z-20 pointer-events-none"
          style={{
            left: `${((hoveredIdx + 0.5) / bins.length) * 100}%`,
            bottom: barHeight + 6,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className="px-2 py-1 rounded-md text-2xs font-mono whitespace-nowrap shadow-lg"
            style={{
              backgroundColor: 'var(--surface-deep)',
              border: `1px solid ${color}60`,
              color: 'var(--text)',
            }}
          >
            <span style={{ color }}>{formatRange(bins[hoveredIdx])}</span>
            <span className="text-text-muted ml-1.5">n={bins[hoveredIdx].count}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Stat badge with value */
function StatBadge({ label, value, color, unit, icon: Icon }: {
  label: string;
  value: string | number;
  color: string;
  unit?: string;
  icon?: typeof Heart;
}) {
  return (
    <div className="flex flex-col items-center px-2 py-1.5 rounded-md" style={{ backgroundColor: `${color}${OPACITY_15}` }}>
      <div className="flex items-center gap-1">
        {Icon && <Icon className="w-3 h-3" style={{ color }} />}
        <span className="text-xs font-bold font-mono" style={{ color }}>{value}{unit ?? ''}</span>
      </div>
      <span className="text-2xs text-text-muted mt-0.5">{label}</span>
    </div>
  );
}

/** Sensitivity curve chart (SVG) */
function SensitivityChart({ result, width, height, color }: {
  result: SensitivityResult;
  width: number;
  height: number;
  color: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const pts = result.points;
  if (pts.length < 2) return null;

  const xMin = pts[0].value;
  const xMax = pts[pts.length - 1].value;
  const yMin = Math.min(...pts.map(p => p.dps));
  const yMax = Math.max(...pts.map(p => p.dps));
  const yRange = yMax - yMin || 1;

  const pad = { l: 40, r: 8, t: 8, b: 20 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const toX = (v: number) => pad.l + ((v - xMin) / (xMax - xMin || 1)) * w;
  const toY = (v: number) => pad.t + h - ((v - yMin) / yRange) * h;

  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.value).toFixed(1)} ${toY(p.dps).toFixed(1)}`).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const dist = Math.abs(toX(pts[i].value) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  const hp = hoveredIdx !== null ? pts[hoveredIdx] : null;
  const hx = hp ? toX(hp.value) : 0;
  const tooltipOnRight = hp ? hx < width / 2 : true;

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + h * (1 - f);
        const v = yMin + yRange * f;
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="var(--color-border)" strokeOpacity={0.3} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-2xs fill-text-muted">{v.toFixed(0)}</text>
          </g>
        );
      })}
      {/* DPS curve */}
      <path d={path} fill="none" stroke={color} strokeWidth={2} />
      {/* Points */}
      {pts.map((p, i) => (
        <circle key={i} cx={toX(p.value)} cy={toY(p.dps)} r={hoveredIdx === i ? 5 : 2.5} fill={color} opacity={hoveredIdx === i ? 1 : 0.8} />
      ))}
      {/* Hover crosshair + tooltip */}
      {hp && (
        <g>
          <line
            x1={hx} y1={pad.t} x2={hx} y2={pad.t + h}
            stroke={color} strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.6}
          />
          <foreignObject
            x={tooltipOnRight ? hx + 8 : hx - 118}
            y={Math.min(toY(hp.dps) - 10, pad.t + h - 68)}
            width={110}
            height={68}
          >
            <div className="bg-surface-1 border border-border rounded px-2 py-1.5 text-2xs font-mono shadow-lg" style={{ borderColor: `${color}40` }}>
              <div className="font-bold mb-0.5" style={{ color }}>{result.attribute}: {hp.value.toFixed(0)}</div>
              <div className="text-text-muted">DPS: <span className="text-text">{hp.dps.toFixed(1)}</span></div>
              <div className="text-text-muted">TTK: <span className="text-text">{hp.ttk.toFixed(2)}s</span></div>
              <div className="text-text-muted">EHP: <span className="text-text">{hp.ehp.toFixed(0)}</span></div>
            </div>
          </foreignObject>
        </g>
      )}
      {/* Diminishing returns marker */}
      {result.diminishingAt !== null && (
        <g>
          <line
            x1={toX(result.diminishingAt)} y1={pad.t}
            x2={toX(result.diminishingAt)} y2={pad.t + h}
            stroke={STATUS_WARNING} strokeDasharray="4 3" strokeWidth={1.5}
          />
          <text x={toX(result.diminishingAt)} y={pad.t - 2} textAnchor="middle" className="text-2xs" fill={STATUS_WARNING}>
            DR
          </text>
        </g>
      )}
      {/* X axis labels */}
      {[pts[0], pts[Math.floor(pts.length / 2)], pts[pts.length - 1]].map((p, i) => (
        <text key={i} x={toX(p.value)} y={height - 2} textAnchor="middle" className="text-2xs fill-text-muted">
          {p.value.toFixed(0)}
        </text>
      ))}
    </svg>
  );
}

/** Level Sweep multi-line SVG chart */
function LevelSweepChart({ points, breakpoints, width, height }: {
  points: LevelSweepPoint[];
  breakpoints: { level: number; reason: string }[];
  width: number;
  height: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  if (points.length < 2) return null;

  const pad = { l: 44, r: 12, t: 12, b: 24 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  const xMin = points[0].level;
  const xMax = points[points.length - 1].level;
  const toX = (level: number) => pad.l + ((level - xMin) / (xMax - xMin || 1)) * w;

  // Normalize each metric to 0–1 for overlay
  const ttkMax = Math.max(...points.map(p => p.ttk), 1);
  const dpsMax = Math.max(...points.map(p => p.dps), 1);
  const ehpMax = Math.max(...points.map(p => p.ehp), 1);

  const metrics: { key: keyof LevelSweepPoint; label: string; color: string; normalize: (v: number) => number; format: (v: number) => string }[] = [
    { key: 'ttk', label: 'TTK', color: ACCENT_CYAN, normalize: (v) => v / ttkMax, format: (v) => `${v.toFixed(1)}s` },
    { key: 'dps', label: 'DPS', color: ACCENT_ORANGE, normalize: (v) => v / dpsMax, format: (v) => v.toFixed(0) },
    { key: 'survivalRate', label: 'Survival', color: STATUS_SUCCESS, normalize: (v) => v, format: (v) => `${(v * 100).toFixed(0)}%` },
    { key: 'ehp', label: 'EHP', color: ACCENT_EMERALD, normalize: (v) => v / ehpMax, format: (v) => v.toFixed(0) },
  ];

  const toY = (normalized: number) => pad.t + h - normalized * h;

  const buildPath = (metric: typeof metrics[0]) =>
    points.map((p, i) => {
      const x = toX(p.level).toFixed(1);
      const y = toY(metric.normalize(p[metric.key] as number)).toFixed(1);
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
    }).join(' ');

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    let closest = 0;
    let closestDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(toX(points[i].level) - mouseX);
      if (dist < closestDist) { closestDist = dist; closest = i; }
    }
    setHoveredIdx(closest);
  };

  const hp = hoveredIdx !== null ? points[hoveredIdx] : null;
  const hx = hp ? toX(hp.level) : 0;
  const tooltipOnRight = hp ? hx < width / 2 : true;

  // Find breakpoint level ranges for shading
  const breakpointLevels = new Set(breakpoints.map(b => b.level));

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className="overflow-visible"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoveredIdx(null)}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(f => {
        const y = pad.t + h * (1 - f);
        return (
          <g key={f}>
            <line x1={pad.l} y1={y} x2={width - pad.r} y2={y} stroke="var(--color-border)" strokeOpacity={0.2} />
            <text x={pad.l - 4} y={y + 3} textAnchor="end" className="text-2xs fill-text-muted">
              {(f * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* Breakpoint danger zones */}
      {points.map((p, i) => {
        if (!breakpointLevels.has(p.level)) return null;
        const x = toX(p.level);
        const bw = w / (xMax - xMin || 1);
        return (
          <rect
            key={`bp-${i}`}
            x={x - bw / 2}
            y={pad.t}
            width={bw}
            height={h}
            fill={STATUS_ERROR}
            fillOpacity={0.08}
          />
        );
      })}

      {/* Metric curves */}
      {metrics.map(metric => (
        <path
          key={metric.key}
          d={buildPath(metric)}
          fill="none"
          stroke={metric.color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      ))}

      {/* Hover crosshair */}
      {hp && (
        <g>
          <line
            x1={hx} y1={pad.t} x2={hx} y2={pad.t + h}
            stroke="var(--color-text-muted)" strokeDasharray="3 3" strokeWidth={1} strokeOpacity={0.5}
          />
          {/* Dots on each curve */}
          {metrics.map(metric => (
            <circle
              key={metric.key}
              cx={hx}
              cy={toY(metric.normalize(hp[metric.key] as number))}
              r={3.5}
              fill={metric.color}
              stroke="var(--surface-deep)"
              strokeWidth={1.5}
            />
          ))}
          {/* Tooltip */}
          <foreignObject
            x={tooltipOnRight ? hx + 10 : hx - 140}
            y={Math.min(pad.t + 10, pad.t + h - 90)}
            width={130}
            height={88}
          >
            <div className="bg-surface-1 border border-border rounded px-2 py-1.5 text-2xs font-mono shadow-lg">
              <div className="font-bold text-text mb-0.5">Level {hp.level}</div>
              {metrics.map(m => (
                <div key={m.key} className="flex justify-between">
                  <span style={{ color: m.color }}>{m.label}:</span>
                  <span className="text-text">{m.format(hp[m.key] as number)}</span>
                </div>
              ))}
            </div>
          </foreignObject>
        </g>
      )}

      {/* X axis labels */}
      {Array.from({ length: 6 }, (_, i) => {
        const level = Math.round(xMin + (xMax - xMin) * (i / 5));
        return (
          <text key={i} x={toX(level)} y={height - 4} textAnchor="middle" className="text-2xs fill-text-muted">
            {level}
          </text>
        );
      })}

      {/* Breakpoint markers on top */}
      {breakpoints.slice(0, 5).map((bp, i) => (
        <g key={`bpm-${i}`}>
          <line
            x1={toX(bp.level)} y1={pad.t}
            x2={toX(bp.level)} y2={pad.t + h}
            stroke={STATUS_ERROR} strokeDasharray="2 2" strokeWidth={1} strokeOpacity={0.6}
          />
        </g>
      ))}
    </svg>
  );
}

/** Collapsible panel */
function CollapsibleSection({ title, icon: Icon, color, defaultOpen, children }: {
  title: string;
  icon: typeof Heart;
  color: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <SurfaceCard level={2} className="relative overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-left">
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
          <ChevronRight className="w-3.5 h-3.5 text-text-muted" />
        </motion.div>
        <Icon className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs font-semibold text-text">{title}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </SurfaceCard>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   SCENARIO EDITOR
   ══════════════════════════════════════════════════════════════════════════ */

function ScenarioEditor({ scenario, onChange }: { scenario: SimScenario; onChange: (s: SimScenario) => void }) {
  const updatePlayer = useCallback((partial: Partial<CombatantStats>) => {
    onChange({ ...scenario, player: { ...scenario.player, ...partial } });
  }, [scenario, onChange]);

  const addEnemy = useCallback((preset: string) => {
    const stats = ENEMY_PRESETS[preset];
    if (!stats) return;
    onChange({
      ...scenario,
      enemies: [...scenario.enemies, { id: `e-${Date.now()}`, stats: { ...stats }, count: 1 }],
    });
  }, [scenario, onChange]);

  const removeEnemy = useCallback((id: string) => {
    onChange({ ...scenario, enemies: scenario.enemies.filter(e => e.id !== id) });
  }, [scenario, onChange]);

  const updateEnemy = useCallback((id: string, partial: Partial<EnemyConfig>) => {
    onChange({
      ...scenario,
      enemies: scenario.enemies.map(e => e.id === id ? { ...e, ...partial } : e),
    });
  }, [scenario, onChange]);

  const updateEnemyStats = useCallback((id: string, partial: Partial<CombatantStats>) => {
    onChange({
      ...scenario,
      enemies: scenario.enemies.map(e => e.id === id ? { ...e, stats: { ...e.stats, ...partial } } : e),
    });
  }, [scenario, onChange]);

  return (
    <div className="space-y-2.5">
      {/* Player Stats */}
      <CollapsibleSection title="Player Stats" icon={Swords} color={ACCENT_CYAN} defaultOpen>
        <div className="space-y-1.5">
          <StatInput label="Level" value={scenario.player.level} onChange={v => updatePlayer({ level: v })} min={1} max={50} icon={TrendingUp} color={ACCENT_VIOLET} />
          <StatInput label="Max HP" value={scenario.player.maxHealth} onChange={v => updatePlayer({ maxHealth: v })} min={100} max={5000} step={50} icon={Heart} color={STATUS_ERROR} />
          <StatInput label="Strength" value={scenario.player.strength} onChange={v => updatePlayer({ strength: v })} min={1} max={100} icon={Swords} color={ACCENT_ORANGE}
            hint={`+${scenario.player.strength * 2} AtkPow`} />
          <StatInput label="Dexterity" value={scenario.player.dexterity} onChange={v => updatePlayer({ dexterity: v })} min={1} max={100} icon={Crosshair} color={ACCENT_EMERALD} />
          <StatInput label="Intelligence" value={scenario.player.intelligence} onChange={v => updatePlayer({ intelligence: v })} min={1} max={100} icon={Zap} color={ACCENT_VIOLET} />
          <StatInput label="Armor" value={scenario.player.armor} onChange={v => updatePlayer({ armor: v })} min={0} max={200} icon={Shield} color={MODULE_COLORS.core}
            hint={`${(scenario.player.armor / (scenario.player.armor + 100) * 100).toFixed(1)}% mit`} />
          <StatInput label="Atk Power" value={scenario.player.attackPower} onChange={v => updatePlayer({ attackPower: v })} min={1} max={300} icon={Swords} color={STATUS_ERROR}
            hint={`Σ${scenario.player.attackPower + scenario.player.strength * 2} eff`} />
          <StatInput label="Base Dmg" value={scenario.player.baseDamage} onChange={v => updatePlayer({ baseDamage: v })} min={10} max={200} icon={Target} color={ACCENT_ORANGE} />
          <StatInput label="Crit %" value={scenario.player.criticalChance} onChange={v => updatePlayer({ criticalChance: v })} min={0} max={1} step={0.01} icon={Crosshair} color={STATUS_WARNING} unit=""
            hint={`+${(scenario.player.criticalChance * (scenario.player.criticalDamage - 1) * 100).toFixed(0)}% DPS`} />
          <StatInput label="Crit Mult" value={scenario.player.criticalDamage} onChange={v => updatePlayer({ criticalDamage: v })} min={1} max={4} step={0.1} icon={TrendingUp} color={STATUS_WARNING} unit="x"
            hint={`+${(scenario.player.criticalChance * (scenario.player.criticalDamage - 1) * 100).toFixed(0)}% DPS`} />
          <StatInput label="Atk Speed" value={scenario.player.attackSpeed} onChange={v => updatePlayer({ attackSpeed: v })} min={0.1} max={5} step={0.1} icon={Activity} color={ACCENT_CYAN} unit="/s" />
        </div>
      </CollapsibleSection>

      {/* Enemies */}
      <CollapsibleSection title={`Enemies (${scenario.enemies.reduce((s, e) => s + e.count, 0)} total)`} icon={Users} color={STATUS_ERROR} defaultOpen>
        <div className="space-y-2">
          {scenario.enemies.map(enemy => (
            <SurfaceCard key={enemy.id} level={3} className="p-2 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-text">{enemy.stats.name}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-2xs text-text-muted">×</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={enemy.count}
                    onChange={e => updateEnemy(enemy.id, { count: Math.max(1, Number(e.target.value)) })}
                    className="w-10 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center"
                  />
                  <button onClick={() => removeEnemy(enemy.id)} className="p-0.5 rounded hover:bg-surface-deep transition-colors" title="Remove">
                    <Trash2 className="w-3 h-3 text-text-muted hover:text-red-400" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
                <StatInput label="HP" value={enemy.stats.maxHealth} onChange={v => updateEnemyStats(enemy.id, { maxHealth: v })} min={50} max={5000} step={50} color={STATUS_ERROR} />
                <StatInput label="Armor" value={enemy.stats.armor} onChange={v => updateEnemyStats(enemy.id, { armor: v })} min={0} max={200} color={MODULE_COLORS.core} />
                <StatInput label="Atk Pow" value={enemy.stats.attackPower} onChange={v => updateEnemyStats(enemy.id, { attackPower: v })} min={1} max={200} color={ACCENT_ORANGE} />
                <StatInput label="Base Dmg" value={enemy.stats.baseDamage} onChange={v => updateEnemyStats(enemy.id, { baseDamage: v })} min={5} max={200} color={ACCENT_ORANGE} />
              </div>
            </SurfaceCard>
          ))}

          {/* Add enemy */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-2xs text-text-muted">Add:</span>
            {Object.entries(ENEMY_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => addEnemy(key)}
                className="text-2xs px-2 py-0.5 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors"
              >
                <Plus className="w-2.5 h-2.5 inline mr-0.5" />{preset.name}
              </button>
            ))}
          </div>
        </div>
      </CollapsibleSection>

      {/* Iterations */}
      <div className="flex items-center gap-2 px-1">
        <Settings2 className="w-3 h-3 text-text-muted" />
        <span className="text-2xs text-text-muted">Iterations:</span>
        <input
          type="number"
          min={100}
          max={10000}
          step={100}
          value={scenario.iterations}
          onChange={e => onChange({ ...scenario, iterations: Math.max(100, Number(e.target.value)) })}
          className="w-20 bg-surface-deep border border-border/40 rounded px-1.5 py-0.5 text-2xs font-mono text-text"
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   RESULTS DASHBOARD
   ══════════════════════════════════════════════════════════════════════════ */

function ResultsDashboard({ results, scenario }: { results: SimResults; scenario: SimScenario }) {
  const [showSensitivity, setShowSensitivity] = useState(false);
  const [sensitivityResults, setSensitivityResults] = useState<SensitivityResult[]>([]);
  const [runningSensitivity, setRunningSensitivity] = useState(false);

  // Level sweep state
  const [sweepConfig, setSweepConfig] = useState<LevelSweepConfig>({ ...DEFAULT_SWEEP_CONFIG });
  const [sweepPoints, setSweepPoints] = useState<LevelSweepPoint[] | null>(null);
  const [sweepBreakpoints, setSweepBreakpoints] = useState<{ level: number; reason: string }[]>([]);
  const [runningSweep, setRunningSweep] = useState(false);
  const [showSweep, setShowSweep] = useState(false);

  const ttkHist = useMemo(
    () => buildHistogram(results.iterations.map(it => it.ttk), 25),
    [results.iterations]
  );

  const dpsHist = useMemo(
    () => buildHistogram(results.iterations.map(it => it.ttk > 0 ? it.totalDamage / it.ttk : 0), 25),
    [results.iterations]
  );

  const maxBin = Math.max(...ttkHist.bins.map(b => b.count), 1);
  const maxDpsBin = Math.max(...dpsHist.bins.map(b => b.count), 1);

  const runLevelSweepAnalysis = useCallback(() => {
    setRunningSweep(true);
    requestAnimationFrame(() => {
      const pts = runLevelSweep(scenario, sweepConfig);
      const bps = detectBreakpoints(pts);
      setSweepPoints(pts);
      setSweepBreakpoints(bps);
      setRunningSweep(false);
      setShowSweep(true);
    });
  }, [scenario, sweepConfig]);

  const runSensitivityAnalysis = useCallback(() => {
    setRunningSensitivity(true);
    // Use requestAnimationFrame to avoid blocking UI
    requestAnimationFrame(() => {
      const attrs: { key: keyof CombatantStats; min: number; max: number }[] = [
        { key: 'strength', min: 5, max: 100 },
        { key: 'armor', min: 0, max: 200 },
        { key: 'criticalChance', min: 0, max: 0.8 },
        { key: 'attackPower', min: 10, max: 300 },
        { key: 'baseDamage', min: 10, max: 200 },
      ];
      const newResults = attrs.map(a =>
        runSensitivity(scenario, a.key, { min: a.min, max: a.max, steps: 12 })
      );
      setSensitivityResults(newResults);
      setRunningSensitivity(false);
      setShowSensitivity(true);
    });
  }, [scenario]);

  // Armor breakpoint analysis
  const armorBreakpoints = useMemo(() => {
    const points: { armor: number; mitigation: number; ehp: number }[] = [];
    for (let a = 0; a <= 200; a += 10) {
      const mit = a / (a + 100);
      const ehp = scenario.player.maxHealth / (1 - mit);
      points.push({ armor: a, mitigation: mit, ehp });
    }
    return points;
  }, [scenario.player.maxHealth]);

  return (
    <div className="space-y-2.5">
      {/* Summary Stats Bar */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel icon={BarChart3} label="Simulation Summary" color={ACCENT} />
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mt-2">
          <StatBadge label="Mean TTK" value={results.ttkStats.mean.toFixed(1)} unit="s" color={ACCENT_CYAN} icon={Target} />
          <StatBadge label="Mean DPS" value={results.dpsStats.mean.toFixed(0)} color={ACCENT_ORANGE} icon={Swords} />
          <StatBadge label="Crit Rate" value={`${(results.critRate * 100).toFixed(1)}%`} color={STATUS_WARNING} icon={Crosshair} />
          <StatBadge label="Survival" value={`${(results.survivalRate * 100).toFixed(0)}%`} color={results.survivalRate > 0.5 ? STATUS_SUCCESS : STATUS_ERROR} icon={Heart} />
          <StatBadge label="EHP" value={results.effectiveHp.toFixed(0)} color={ACCENT_EMERALD} icon={Shield} />
          <StatBadge label="Armor Mit." value={`${(results.armorMitigation * 100).toFixed(1)}%`} color={MODULE_COLORS.core} icon={Shield} />
        </div>
      </SurfaceCard>

      {/* TTK Distribution */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel icon={Activity} label="TTK Distribution (Time-to-Kill)" color={ACCENT_CYAN} />
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          {results.iterations.length.toLocaleString()} iterations — Median: {results.ttkStats.median.toFixed(2)}s, P10: {results.ttkStats.p10.toFixed(2)}s, P90: {results.ttkStats.p90.toFixed(2)}s
        </p>
        <HistogramChart
          bins={ttkHist.bins}
          maxCount={maxBin}
          color={ACCENT_CYAN}
          formatRange={(b) => `${b.low.toFixed(1)}–${b.high.toFixed(1)}s`}
          barHeight={80}
        />
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-text-muted">{ttkHist.min.toFixed(1)}s</span>
          <span className="text-2xs text-text-muted">{ttkHist.max.toFixed(1)}s</span>
        </div>
        {/* TTK Percentile markers */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          {[
            { label: 'Min', value: results.ttkStats.min, color: STATUS_SUCCESS },
            { label: 'P10', value: results.ttkStats.p10, color: ACCENT_EMERALD },
            { label: 'Median', value: results.ttkStats.median, color: ACCENT_CYAN },
            { label: 'P90', value: results.ttkStats.p90, color: STATUS_WARNING },
            { label: 'Max', value: results.ttkStats.max, color: STATUS_ERROR },
          ].map(m => (
            <span key={m.label} className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${m.color}${OPACITY_15}`, color: m.color }}>
              {m.label}: {m.value.toFixed(2)}s
            </span>
          ))}
          <span className="text-2xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${ACCENT_VIOLET}${OPACITY_15}`, color: ACCENT_VIOLET }}>
            StdDev: {results.ttkStats.stdDev.toFixed(2)}s
          </span>
        </div>
      </SurfaceCard>

      {/* DPS Distribution */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel icon={TrendingUp} label="DPS Distribution" color={ACCENT_ORANGE} />
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Mean: {results.dpsStats.mean.toFixed(0)}, Median: {results.dpsStats.median.toFixed(0)}, Range: {results.dpsStats.min.toFixed(0)}–{results.dpsStats.max.toFixed(0)}
        </p>
        <HistogramChart
          bins={dpsHist.bins}
          maxCount={maxDpsBin}
          color={ACCENT_ORANGE}
          formatRange={(b) => `${b.low.toFixed(0)}–${b.high.toFixed(0)} DPS`}
          barHeight={64}
        />
        <div className="flex justify-between mt-1">
          <span className="text-2xs text-text-muted">{dpsHist.min.toFixed(0)}</span>
          <span className="text-2xs text-text-muted">{dpsHist.max.toFixed(0)}</span>
        </div>
      </SurfaceCard>

      {/* Armor Breakpoints */}
      <SurfaceCard level={2} className="p-3">
        <SectionLabel icon={Shield} label="Armor Breakpoint Analysis" color={MODULE_COLORS.core} />
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Formula: mitigation = armor / (armor + 100). Shows diminishing returns on damage reduction.
        </p>
        {(() => {
          const playerArmor = scenario.player.armor;
          const playerMit = playerArmor / (playerArmor + 100);
          const threshold50Armor = 100; // armor/(armor+100) = 0.5 when armor = 100
          return (
            <>
              <div className="overflow-x-auto">
                <div className="relative flex items-end gap-0.5 min-w-[400px]">
                  {armorBreakpoints.map(bp => {
                    const hPct = bp.mitigation * 100;
                    const isCurrent = bp.armor === Math.round(playerArmor / 10) * 10;
                    const is50 = bp.armor === threshold50Armor;
                    return (
                      <div key={bp.armor} className="flex flex-col items-center flex-1 min-w-[16px] relative" title={`${bp.armor} Armor → ${(bp.mitigation * 100).toFixed(1)}% mitigation, ${bp.ehp.toFixed(0)} EHP`}>
                        <div className="w-full h-12 flex items-end relative">
                          <div
                            className="w-full rounded-t-sm"
                            style={{
                              backgroundColor: isCurrent ? STATUS_SUCCESS : is50 ? STATUS_WARNING : MODULE_COLORS.core,
                              height: `${hPct}%`,
                              opacity: isCurrent ? 1 : is50 ? 0.85 : 0.5 + bp.mitigation * 0.5,
                            }}
                          />
                        </div>
                        {bp.armor % 40 === 0 && <span className="text-2xs text-text-muted mt-0.5">{bp.armor}</span>}
                      </div>
                    );
                  })}
                  {/* Current armor marker line */}
                  <div
                    className="absolute bottom-0 pointer-events-none"
                    style={{
                      left: `${(Math.min(playerArmor, 200) / 200) * 100}%`,
                      height: '100%',
                    }}
                  >
                    <div className="absolute bottom-0 w-px h-full" style={{ backgroundColor: STATUS_SUCCESS }} />
                    <div
                      className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-2xs font-mono font-bold px-1 rounded"
                      style={{ color: STATUS_SUCCESS, backgroundColor: `${STATUS_SUCCESS}15` }}
                    >
                      {playerArmor} → {(playerMit * 100).toFixed(1)}%
                    </div>
                  </div>
                  {/* 50% threshold marker line */}
                  <div
                    className="absolute bottom-0 pointer-events-none"
                    style={{
                      left: `${(threshold50Armor / 200) * 100}%`,
                      height: '100%',
                    }}
                  >
                    <div className="absolute bottom-0 w-px h-full opacity-70" style={{ backgroundColor: STATUS_WARNING, borderLeft: `1px dashed ${STATUS_WARNING}` }} />
                    <div
                      className="absolute -top-5 -translate-x-1/2 whitespace-nowrap text-2xs font-mono px-1 rounded"
                      style={{ color: STATUS_WARNING, backgroundColor: `${STATUS_WARNING}15` }}
                    >
                      50% @{threshold50Armor}
                    </div>
                  </div>
                </div>
              </div>
              {/* Key breakpoints + current */}
              <div className="grid grid-cols-5 gap-2 mt-2">
                <div className="text-center">
                  <div className="text-2xs font-mono font-bold" style={{ color: STATUS_SUCCESS }}>You: {playerArmor}</div>
                  <div className="text-xs font-bold text-text">{(playerMit * 100).toFixed(1)}%</div>
                  <div className="text-2xs text-text-muted">current</div>
                </div>
                {[25, 50, 100, 200].map(a => {
                  const mit = a / (a + 100);
                  const is50 = a === threshold50Armor;
                  return (
                    <div key={a} className="text-center">
                      <div className="text-2xs font-mono" style={{ color: is50 ? STATUS_WARNING : MODULE_COLORS.core }}>{a} Armor</div>
                      <div className="text-xs font-bold text-text">{(mit * 100).toFixed(1)}%</div>
                      <div className="text-2xs text-text-muted">{is50 ? '50% threshold' : 'mitigation'}</div>
                    </div>
                  );
                })}
              </div>
            </>
          );
        })()}
      </SurfaceCard>

      {/* Sensitivity Analysis */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center justify-between">
          <SectionLabel icon={TrendingDown} label="Attribute Sensitivity Analysis" color={ACCENT_VIOLET} />
          <button
            onClick={runSensitivityAnalysis}
            disabled={runningSensitivity}
            className="text-2xs px-2 py-1 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            {runningSensitivity ? 'Running...' : 'Run Analysis'}
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Sweeps each attribute across its range (500 iterations per point) to identify diminishing returns and optimal breakpoints.
        </p>

        {showSensitivity && sensitivityResults.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 mt-2">
            {sensitivityResults.map(sr => {
              const colors: Record<string, string> = {
                strength: ACCENT_ORANGE,
                armor: MODULE_COLORS.core,
                criticalChance: STATUS_WARNING,
                attackPower: STATUS_ERROR,
                baseDamage: ACCENT_CYAN,
              };
              const c = colors[sr.attribute] ?? ACCENT;
              return (
                <SurfaceCard key={sr.attribute} level={3} className="p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-2xs font-bold capitalize" style={{ color: c }}>{sr.attribute}</span>
                    {sr.diminishingAt !== null && (
                      <span className="text-2xs flex items-center gap-0.5" style={{ color: STATUS_WARNING }}>
                        <AlertTriangle className="w-3 h-3" />
                        DR at {sr.diminishingAt.toFixed(0)}
                      </span>
                    )}
                  </div>
                  <SensitivityChart result={sr} width={200} height={80} color={c} />
                  <div className="text-2xs text-text-muted text-center mt-0.5">DPS vs {sr.attribute}</div>
                </SurfaceCard>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* Level Scaling Curve Sweep */}
      <SurfaceCard level={2} className="p-3">
        <div className="flex items-center justify-between">
          <SectionLabel icon={TrendingUp} label="Level Scaling Curve Sweep" color={ACCENT_VIOLET} />
          <button
            onClick={runLevelSweepAnalysis}
            disabled={runningSweep}
            className="text-2xs px-2 py-1 rounded-md border border-border/40 hover:border-border text-text-muted hover:text-text transition-colors disabled:opacity-50"
          >
            {runningSweep ? 'Sweeping...' : 'Run Sweep'}
          </button>
        </div>
        <p className="text-2xs text-text-muted mt-0.5 mb-2">
          Simulates combat across player levels {sweepConfig.minLevel}–{sweepConfig.maxLevel}, plotting TTK, DPS, survival rate, and EHP as continuous curves. Red zones indicate balance breakpoints.
        </p>

        {/* Sweep config */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Level Range</label>
            <div className="flex items-center gap-1">
              <input
                type="number" min={1} max={49}
                value={sweepConfig.minLevel}
                onChange={e => setSweepConfig(c => ({ ...c, minLevel: Math.max(1, Math.min(c.maxLevel - 1, Number(e.target.value))) }))}
                className="w-12 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center"
              />
              <span className="text-2xs text-text-muted">–</span>
              <input
                type="number" min={2} max={50}
                value={sweepConfig.maxLevel}
                onChange={e => setSweepConfig(c => ({ ...c, maxLevel: Math.max(c.minLevel + 1, Math.min(50, Number(e.target.value))) }))}
                className="w-12 bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center"
              />
            </div>
          </div>
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Enemy Scaling</label>
            <select
              value={sweepConfig.enemyScaling}
              onChange={e => setSweepConfig(c => ({ ...c, enemyScaling: e.target.value as LevelSweepConfig['enemyScaling'] }))}
              className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs text-text"
            >
              <option value="match">Match Player</option>
              <option value="fixed">Fixed Level</option>
              <option value="offset">Level Offset</option>
            </select>
          </div>
          {sweepConfig.enemyScaling === 'offset' && (
            <div>
              <label className="text-2xs text-text-muted block mb-0.5">Level Offset</label>
              <input
                type="number" min={-20} max={20}
                value={sweepConfig.enemyLevelOffset}
                onChange={e => setSweepConfig(c => ({ ...c, enemyLevelOffset: Number(e.target.value) }))}
                className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center"
              />
            </div>
          )}
          <div>
            <label className="text-2xs text-text-muted block mb-0.5">Iter/Level</label>
            <input
              type="number" min={50} max={2000} step={50}
              value={sweepConfig.iterationsPerLevel}
              onChange={e => setSweepConfig(c => ({ ...c, iterationsPerLevel: Math.max(50, Number(e.target.value)) }))}
              className="w-full bg-surface-deep border border-border/40 rounded px-1 py-0.5 text-2xs font-mono text-text text-center"
            />
          </div>
        </div>

        {showSweep && sweepPoints && sweepPoints.length > 0 && (
          <div className="space-y-3">
            {/* Legend */}
            <div className="flex items-center gap-3 flex-wrap">
              {[
                { label: 'TTK', color: ACCENT_CYAN },
                { label: 'DPS', color: ACCENT_ORANGE },
                { label: 'Survival %', color: STATUS_SUCCESS },
                { label: 'EHP', color: ACCENT_EMERALD },
              ].map(m => (
                <div key={m.label} className="flex items-center gap-1">
                  <div className="w-3 h-0.5 rounded" style={{ backgroundColor: m.color }} />
                  <span className="text-2xs" style={{ color: m.color }}>{m.label}</span>
                </div>
              ))}
              {sweepBreakpoints.length > 0 && (
                <div className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" style={{ color: STATUS_ERROR }} />
                  <span className="text-2xs" style={{ color: STATUS_ERROR }}>
                    {sweepBreakpoints.length} breakpoint{sweepBreakpoints.length !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Chart */}
            <div className="overflow-x-auto">
              <LevelSweepChart
                points={sweepPoints}
                breakpoints={sweepBreakpoints}
                width={Math.max(600, (sweepConfig.maxLevel - sweepConfig.minLevel) * 14)}
                height={180}
              />
            </div>

            {/* Breakpoint details */}
            {sweepBreakpoints.length > 0 && (
              <div className="space-y-1">
                <span className="text-2xs font-semibold" style={{ color: STATUS_ERROR }}>Balance Breakpoints:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                  {sweepBreakpoints.slice(0, 9).map((bp, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 px-2 py-1 rounded text-2xs font-mono"
                      style={{ backgroundColor: `${STATUS_ERROR}${OPACITY_15}` }}
                    >
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: STATUS_ERROR }} />
                      <span className="text-text">Lv.{bp.level}</span>
                      <span className="text-text-muted">{bp.reason}</span>
                    </div>
                  ))}
                  {sweepBreakpoints.length > 9 && (
                    <span className="text-2xs text-text-muted px-2 py-1">+{sweepBreakpoints.length - 9} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Summary stats table */}
            <div className="overflow-x-auto">
              <table className="w-full text-2xs font-mono">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left text-text-muted py-1 px-1">Level</th>
                    <th className="text-right py-1 px-1" style={{ color: ACCENT_CYAN }}>TTK</th>
                    <th className="text-right py-1 px-1" style={{ color: ACCENT_ORANGE }}>DPS</th>
                    <th className="text-right py-1 px-1" style={{ color: STATUS_SUCCESS }}>Survival</th>
                    <th className="text-right py-1 px-1" style={{ color: ACCENT_EMERALD }}>EHP</th>
                  </tr>
                </thead>
                <tbody>
                  {sweepPoints.filter((_, i) => i % Math.max(1, Math.floor(sweepPoints.length / 10)) === 0 || i === sweepPoints.length - 1).map(p => {
                    const isBp = sweepBreakpoints.some(bp => bp.level === p.level);
                    return (
                      <tr key={p.level} className="border-b border-border/10" style={isBp ? { backgroundColor: `${STATUS_ERROR}${OPACITY_15}` } : undefined}>
                        <td className="py-0.5 px-1 text-text">{p.level}</td>
                        <td className="py-0.5 px-1 text-right" style={{ color: ACCENT_CYAN }}>{p.ttk.toFixed(1)}s</td>
                        <td className="py-0.5 px-1 text-right" style={{ color: ACCENT_ORANGE }}>{p.dps.toFixed(0)}</td>
                        <td className="py-0.5 px-1 text-right" style={{ color: p.survivalRate > 0.5 ? STATUS_SUCCESS : STATUS_ERROR }}>
                          {(p.survivalRate * 100).toFixed(0)}%
                        </td>
                        <td className="py-0.5 px-1 text-right" style={{ color: ACCENT_EMERALD }}>{p.ehp.toFixed(0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════════════════════════════ */

export function GASBalanceSimulator() {
  const [scenario, setScenario] = useState<SimScenario>(() => ({
    ...SCENARIO_PRESETS[0],
    id: `custom-${Date.now()}`,
  }));
  const [results, setResults] = useState<SimResults | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>('trash-pack');
  const runIdRef = useRef(0);

  const loadPreset = useCallback((presetId: string) => {
    const preset = SCENARIO_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    setScenario({
      ...preset,
      id: `custom-${Date.now()}`,
      player: { ...preset.player },
      enemies: preset.enemies.map(e => ({ ...e, stats: { ...e.stats } })),
    });
    setSelectedPreset(presetId);
    setResults(null);
  }, []);

  const runSim = useCallback(() => {
    setIsRunning(true);
    const runId = ++runIdRef.current;

    // Run async to not block UI
    requestAnimationFrame(() => {
      const simResults = runSimulation(scenario);
      if (runIdRef.current === runId) {
        setResults(simResults);
        setIsRunning(false);
      }
    });
  }, [scenario]);

  const totalEnemies = scenario.enemies.reduce((s, e) => s + e.count, 0);
  const totalEnemyHp = scenario.enemies.reduce((s, e) => s + e.stats.maxHealth * e.count, 0);

  return (
    <div className="space-y-2.5">
      {/* Header */}
      <SurfaceCard level={2} className="p-3 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-40 h-40 blur-3xl rounded-full pointer-events-none" style={{ backgroundColor: `${ACCENT}10` }} />
        <SectionLabel icon={BarChart3} label="Monte Carlo Balance Simulator" color={ACCENT} />
        <p className="text-2xs text-text-muted mt-1">
          Simulate thousands of combat encounters using the full GAS damage pipeline (Strength→AttackPower scaling, armor/(armor+100) reduction, crit rolls, health depletion).
          Identify TTK distributions, DPS curves, effective HP, and attribute sensitivity breakpoints.
        </p>

        {/* Scenario Presets */}
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-2xs text-text-muted">Presets:</span>
          {SCENARIO_PRESETS.map(p => (
            <button
              key={p.id}
              onClick={() => loadPreset(p.id)}
              className="text-2xs px-2 py-0.5 rounded-md border transition-colors"
              style={{
                borderColor: selectedPreset === p.id ? ACCENT : 'var(--color-border)',
                backgroundColor: selectedPreset === p.id ? `${ACCENT}${OPACITY_15}` : 'transparent',
                color: selectedPreset === p.id ? ACCENT : 'var(--color-text-muted)',
              }}
            >
              {p.name}
            </button>
          ))}
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-2.5">
        {/* Left: Scenario Editor */}
        <div className="space-y-2.5">
          <ScenarioEditor scenario={scenario} onChange={setScenario} />

          {/* Run Button */}
          <button
            onClick={runSim}
            disabled={isRunning || scenario.enemies.length === 0}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              backgroundColor: `${ACCENT}${OPACITY_20}`,
              color: ACCENT,
              border: `1px solid ${ACCENT}40`,
            }}
          >
            {isRunning ? (
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                <RotateCcw className="w-4 h-4" />
              </motion.div>
            ) : (
              <Play className="w-4 h-4" />
            )}
            {isRunning
              ? `Simulating ${scenario.iterations.toLocaleString()} iterations...`
              : `Run ${scenario.iterations.toLocaleString()} Iterations`
            }
          </button>

          {/* Quick scenario summary */}
          <SurfaceCard level={3} className="p-2 text-2xs text-text-muted space-y-0.5">
            <div>Player: Lv.{scenario.player.level} — {scenario.player.maxHealth} HP, {scenario.player.attackPower} AtkPow</div>
            <div>Enemies: {totalEnemies} targets, {totalEnemyHp} total HP</div>
            <div>Scaling: AtkPow +Str×2 = {scenario.player.attackPower + scenario.player.strength * 2}</div>
            <div>Armor Mit: {((scenario.player.armor / (scenario.player.armor + 100)) * 100).toFixed(1)}%</div>
          </SurfaceCard>
        </div>

        {/* Right: Results */}
        <div>
          {results ? (
            <ResultsDashboard results={results} scenario={scenario} />
          ) : (
            <SurfaceCard level={2} className="p-8 text-center">
              <div className="flex flex-col items-center gap-2 text-text-muted">
                <BarChart3 className="w-8 h-8 opacity-30" />
                <p className="text-sm">Configure a scenario and run the simulation</p>
                <p className="text-2xs">Results will show TTK distributions, DPS curves, armor breakpoints, and sensitivity analysis</p>
              </div>
            </SurfaceCard>
          )}
        </div>
      </div>
    </div>
  );
}
