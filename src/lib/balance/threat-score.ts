/**
 * Threat score (ECW Phase 10-B, idea 3bf34f3d flavor). A transparent weighted
 * sum of an archetype's stats into a single "how dangerous is this enemy?"
 * number, plus its percentile vs the roster — for encounter budgeting. Pure.
 */

export interface StatRow {
  label: string;
  value: number;
}

export interface ThreatContribution {
  label: string;
  weight: number;
  contribution: number;
}

/** Keyword → weight. Offense weighted highest; unknown stats get a small default. */
const WEIGHTS: Array<{ keywords: string[]; weight: number }> = [
  { keywords: ['damage', 'dmg', 'atk', 'attack', 'power'], weight: 0.5 },
  { keywords: ['health', 'hp'], weight: 0.3 },
  { keywords: ['armor', 'def', 'resist'], weight: 0.25 },
  { keywords: ['speed', 'agility'], weight: 0.15 },
  { keywords: ['crit'], weight: 0.2 },
];
const DEFAULT_WEIGHT = 0.1;

function weightForLabel(label: string): number {
  const lower = label.toLowerCase();
  for (const { keywords, weight } of WEIGHTS) {
    if (keywords.some((k) => lower.includes(k))) return weight;
  }
  return DEFAULT_WEIGHT;
}

/** Per-stat threat contribution, sorted by contribution descending. */
export function threatContributions(stats: StatRow[]): ThreatContribution[] {
  return stats
    .map((s) => {
      const weight = weightForLabel(s.label);
      return { label: s.label, weight, contribution: s.value * weight };
    })
    .sort((a, b) => b.contribution - a.contribution);
}

/** Single threat score = sum of weighted stat contributions (rounded). */
export function computeThreatScore(stats: StatRow[]): number {
  const total = threatContributions(stats).reduce((s, c) => s + c.contribution, 0);
  return Math.round(total);
}

/**
 * Percentile of `score` within `rosterScores` (0–100). 100 = highest in the
 * roster, 0 = lowest. A single-entry roster (just itself) returns 100.
 */
export function threatPercentile(score: number, rosterScores: number[]): number {
  if (rosterScores.length <= 1) return 100;
  const below = rosterScores.filter((s) => s < score).length;
  return Math.round((below / (rosterScores.length - 1)) * 100);
}
