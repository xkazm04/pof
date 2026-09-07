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

/**
 * Keyword → weight. Offense weighted highest; unknown stats get a small default.
 *
 * PROVENANCE: these weights are **unestimated**, not measured — authored from a
 * description of the game by an author who never played it. That is a specific
 * epistemic state, not a rough number: an estimate taken by someone who plays
 * errs in a known direction (toward "the player is good at this") and can be
 * corrected on sight, while an unplayed one has no direction at all. So do not
 * "correct" these toward harder or easier; read which way the ranking is wrong
 * from one session first, then move them.
 *
 * What they are load-bearing for, measured by swapping in an equally defensible
 * vector (defense level with offense, on a 12-archetype 3-tier roster): the
 * CROSS-tier ordering does not move at all — tier separation dominates, so
 * "boss vs grunt" is safe. The WITHIN-tier ordering flips in every tier, always
 * on the same pair. Since the peer-band checks in bestiary-guardrails.ts and
 * encounter budgeting both read the within-tier order, that ordering is pinned
 * by characterization tests, so a retune is a decision somebody made rather than
 * a silent edit.
 *
 * Those tests were calibrated, and their reach is narrower than "any change":
 * swapping in the full defensible vector above turns them red, while nudging one
 * weight by 0.05 leaves them green. They guard a change of STANCE, not drift.
 */
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
