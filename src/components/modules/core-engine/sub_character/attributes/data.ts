import {
  Zap, Shield, Swords, Target,
} from 'lucide-react';
import {
  STATUS_WARNING, STATUS_ERROR,
  ACCENT_CYAN, ACCENT_VIOLET, ACCENT_EMERALD,
} from '@/lib/chart-colors';

/* ── UE5 Constants (from ARPGPlayerCharacter.h) ───────────────────────────── */

export const UE5 = {
  maxLevel: 50,
  attributePointsPerLevel: 3,
  baseHP: 100,
  baseMana: 50,
  baseAttackPower: 10,
  baseCritChance: 0.05,
  baseCritDamage: 1.5,
  healthPerLevel: 10,
  manaPerLevel: 5,
  attackPowerPerSTR: 2.0,
  critChancePerDEX: 0.005,
  maxManaPerINT: 5.0,
} as const;

export const TOTAL_POINTS = (UE5.maxLevel - 1) * UE5.attributePointsPerLevel; // 147

/* ── Optimization Targets ─────────────────────────────────────────────────── */

export type OptTarget = 'max-dps' | 'max-ehp' | 'balanced' | 'crit-mana' | 'custom';

export interface OptPreset {
  id: OptTarget;
  label: string;
  description: string;
  icon: typeof Swords;
  color: string;
  weights: OptWeights;
}

export interface OptWeights {
  dps: number;
  ehp: number;
  mana: number;
}

export const OPT_PRESETS: OptPreset[] = [
  { id: 'max-dps', label: 'Max DPS', description: 'Maximize raw damage per second', icon: Swords, color: STATUS_ERROR, weights: { dps: 1.0, ehp: 0.0, mana: 0.0 } },
  { id: 'max-ehp', label: 'Max EHP', description: 'Maximize effective hit points', icon: Shield, color: ACCENT_EMERALD, weights: { dps: 0.0, ehp: 1.0, mana: 0.0 } },
  { id: 'balanced', label: 'Balanced', description: 'Equal weight on DPS and survivability', icon: Target, color: STATUS_WARNING, weights: { dps: 0.5, ehp: 0.3, mana: 0.2 } },
  { id: 'crit-mana', label: 'Crit + Mana', description: 'Maximize crit chance and mana pool', icon: Zap, color: ACCENT_VIOLET, weights: { dps: 0.3, ehp: 0.0, mana: 0.7 } },
];

export const ACCENT = ACCENT_CYAN;

/* ── Attribute Color Map ──────────────────────────────────────────────────── */

export const ATTR_COLORS = {
  str: STATUS_ERROR,
  dex: ACCENT_EMERALD,
  int: ACCENT_CYAN,
} as const;

/* ── Build Calculation ────────────────────────────────────────────────────── */

export interface Allocation {
  str: number;
  dex: number;
  int: number;
}

export interface BuildStats {
  attackPower: number;
  critChance: number;
  critDamage: number;
  maxHP: number;
  maxMana: number;
  effectiveDPS: number;
  effectiveHP: number;
  manaPool: number;
}

export function calcStats(alloc: Allocation, level: number): BuildStats {
  const attackPower = UE5.baseAttackPower + alloc.str * UE5.attackPowerPerSTR;
  const critChance = Math.min(UE5.baseCritChance + alloc.dex * UE5.critChancePerDEX, 1.0);
  const critDamage = UE5.baseCritDamage;
  const maxHP = UE5.baseHP + level * UE5.healthPerLevel;
  const maxMana = UE5.baseMana + level * UE5.manaPerLevel + alloc.int * UE5.maxManaPerINT;

  const effectiveDPS = attackPower * (1 + critChance * (critDamage - 1));
  const effectiveHP = maxHP;
  const manaPool = maxMana;

  return { attackPower, critChance, critDamage, maxHP, maxMana, effectiveDPS, effectiveHP, manaPool };
}

export function objectiveScore(stats: BuildStats, weights: OptWeights): number {
  const dpsNorm = stats.effectiveDPS / 300;
  const ehpNorm = stats.effectiveHP / 600;
  const manaNorm = stats.manaPool / 1000;
  return weights.dps * dpsNorm + weights.ehp * ehpNorm + weights.mana * manaNorm;
}

/** Brute-force optimizer: iterate all possible STR/DEX/INT allocations that sum to totalPoints. */
export function optimize(totalPoints: number, level: number, weights: OptWeights): Allocation {
  let best: Allocation = { str: 0, dex: 0, int: 0 };
  let bestScore = -Infinity;

  for (let s = 0; s <= totalPoints; s++) {
    for (let d = 0; d <= totalPoints - s; d++) {
      const i = totalPoints - s - d;
      const stats = calcStats({ str: s, dex: d, int: i }, level);
      const score = objectiveScore(stats, weights);
      if (score > bestScore) {
        bestScore = score;
        best = { str: s, dex: d, int: i };
      }
    }
  }
  return best;
}
