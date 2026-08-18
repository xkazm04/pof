/**
 * Balance Health Report — translates jargon-dense SimResults into plain prose
 * with concrete tuning recommendations a non-technical designer can act on.
 *
 * Pure functions only; no React, no formatters that depend on UI state.
 */

import { ARMOUR_HIT_COEFF } from '@/lib/combat/canon-kernel';
import type { SimResults, SimScenario } from './data';

export type HealthSeverity = 'good' | 'info' | 'warning' | 'critical';
export type HealthGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface HealthFinding {
  id: string;
  severity: HealthSeverity;
  title: string;
  /** 1–2 sentence plain-prose explanation. No jargon. */
  narrative: string;
  /** Concrete tuning suggestion, e.g. "+15% player health". Omitted when fight is healthy. */
  suggestion?: string;
  /** Optional numeric anchor shown as a small chip. */
  anchor?: { label: string; value: string };
}

export interface BalanceHealthReport {
  grade: HealthGrade;
  /** 0–100 underlying score; surfaced so callers can color-code consistently. */
  score: number;
  /** One-line verdict, e.g. "This fight is too punishing for the player". */
  headline: string;
  /** 2–3 sentence plain-prose summary of the whole encounter. */
  narrative: string;
  findings: HealthFinding[];
  /** 2–4 action items in plain language ranked by impact. */
  topRecommendations: string[];
}

/* ── Helpers ─────────────────────────────────────────────────────────────── */

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** Map a 0–100 score to a letter grade. */
function scoreToGrade(score: number): HealthGrade {
  if (score >= 88) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

/** Bell-curve scoring: 100 at target, 0 at endpoints. */
function curveScore(value: number, target: number, tolerance: number): number {
  const dist = Math.abs(value - target);
  const norm = Math.min(1, dist / tolerance);
  return Math.round(100 * (1 - norm));
}

/* ── Survival assessment ─────────────────────────────────────────────────── */

function assessSurvival(results: SimResults, _scenario: SimScenario): { score: number; finding: HealthFinding } {
  const s = results.survivalRate;
  const score = curveScore(s, 0.65, 0.55);

  if (s < 0.2) {
    const boost = Math.min(60, Math.round((0.55 - s) * 100));
    return {
      score,
      finding: {
        id: 'survival',
        severity: 'critical',
        title: 'Players die almost every fight',
        narrative: `Players survive only ${pct(s)} of these encounters. As-is, this fight will feel unfair and turn players away from the area.`,
        suggestion: `Try +${boost}% player health, or cut enemy damage by ~${Math.round(boost / 2)}%.`,
        anchor: { label: 'Survival', value: pct(s) },
      },
    };
  }
  if (s < 0.45) {
    const boost = Math.max(10, Math.round((0.6 - s) * 80));
    return {
      score,
      finding: {
        id: 'survival',
        severity: 'warning',
        title: 'This fight is too punishing',
        narrative: `Players die ${pct(1 - s)} of the time here. That's beyond "challenging" — most players will get stuck and complain.`,
        suggestion: `Try +${boost}% player health below this level, or +${Math.round(boost / 1.5)}% armor.`,
        anchor: { label: 'Survival', value: pct(s) },
      },
    };
  }
  if (s > 0.97) {
    return {
      score,
      finding: {
        id: 'survival',
        severity: 'warning',
        title: 'This fight is a pushover',
        narrative: `Players win ${pct(s)} of the time and barely break a sweat. Trivial encounters waste the player's time and dilute the rest of the content.`,
        suggestion: `Try +20% enemy health, or add one more enemy to the pack.`,
        anchor: { label: 'Survival', value: pct(s) },
      },
    };
  }
  if (s > 0.85) {
    return {
      score,
      finding: {
        id: 'survival',
        severity: 'info',
        title: 'Comfortable for the player',
        narrative: `Players win ${pct(s)} of the time. Solid for normal-mode trash, a touch easy for a feature encounter.`,
        anchor: { label: 'Survival', value: pct(s) },
      },
    };
  }
  return {
    score,
    finding: {
      id: 'survival',
      severity: 'good',
      title: 'Win rate is in the sweet spot',
      narrative: `Players win ${pct(s)} of the time — challenging without feeling unfair. This is the kind of fight that earns a "tough but satisfying" review.`,
      anchor: { label: 'Survival', value: pct(s) },
    },
  };
}

/* ── Fight duration (TTK) assessment ─────────────────────────────────────── */

function assessDuration(results: SimResults): { score: number; finding: HealthFinding } {
  const t = results.ttkStats.mean;
  const score = curveScore(Math.log2(Math.max(0.5, t)), Math.log2(4), 3);

  if (t < 1.0) {
    return {
      score,
      finding: {
        id: 'duration',
        severity: 'warning',
        title: 'Fights end before they start',
        narrative: `An average encounter wraps up in ${t.toFixed(1)} seconds. There's no time for the player to use abilities or feel like they fought anything.`,
        suggestion: 'Try +40% enemy health to give combat room to breathe.',
        anchor: { label: 'Avg fight', value: `${t.toFixed(1)}s` },
      },
    };
  }
  if (t > 45) {
    return {
      score,
      finding: {
        id: 'duration',
        severity: 'critical',
        title: 'Fights drag on too long',
        narrative: `An average encounter takes ${t.toFixed(0)} seconds — long enough that players will skip the area or pull aggro and run. Sustained tension turns into boredom.`,
        suggestion: `Try -${Math.min(50, Math.round((1 - 20 / t) * 100))}% enemy health, or +25% player damage.`,
        anchor: { label: 'Avg fight', value: `${t.toFixed(0)}s` },
      },
    };
  }
  if (t > 20) {
    return {
      score,
      finding: {
        id: 'duration',
        severity: 'warning',
        title: 'Fights run a bit long',
        narrative: `An average encounter takes ${t.toFixed(0)} seconds. Fine for a mini-boss; too slow for routine combat.`,
        suggestion: 'Try -20% enemy health for trash packs at this level.',
        anchor: { label: 'Avg fight', value: `${t.toFixed(0)}s` },
      },
    };
  }
  return {
    score,
    finding: {
      id: 'duration',
      severity: 'good',
      title: 'Fight length feels right',
      narrative: `An average encounter wraps in ${t.toFixed(1)} seconds — long enough to use a couple of abilities, short enough to keep momentum.`,
      anchor: { label: 'Avg fight', value: `${t.toFixed(1)}s` },
    },
  };
}

/* ── Consistency (RNG swing) assessment ──────────────────────────────────── */

function assessConsistency(results: SimResults): { score: number; finding: HealthFinding } | null {
  const mean = results.ttkStats.mean;
  if (mean <= 0) return null;
  const cv = results.ttkStats.stdDev / mean;
  const score = curveScore(cv, 0.35, 0.5);

  if (cv > 0.7) {
    return {
      score,
      finding: {
        id: 'consistency',
        severity: 'warning',
        title: 'Outcomes swing wildly on luck',
        narrative: `Fight length varies by ±${Math.round(cv * 100)}% around the average. Two players fighting the same pack will have very different experiences, which makes the game feel random instead of skill-based.`,
        suggestion: 'Try -20% crit damage multiplier, or cap crit chance below 25%.',
        anchor: { label: 'Spread', value: `±${Math.round(cv * 100)}%` },
      },
    };
  }
  if (cv < 0.12) {
    return {
      score,
      finding: {
        id: 'consistency',
        severity: 'info',
        title: 'Outcomes are very predictable',
        narrative: `Almost every fight resolves the same way. Reliable, but players may feel combat lacks excitement — there are no "barely escaped" or "perfect roll" moments.`,
        suggestion: 'Consider raising crit chance to ~15% for more flavor.',
        anchor: { label: 'Spread', value: `±${Math.round(cv * 100)}%` },
      },
    };
  }
  return {
    score,
    finding: {
      id: 'consistency',
      severity: 'good',
      title: 'Healthy variance fight-to-fight',
      narrative: `Fights vary by ±${Math.round(cv * 100)}% in length — enough to feel different each time, not so much that the outcome feels random.`,
      anchor: { label: 'Spread', value: `±${Math.round(cv * 100)}%` },
    },
  };
}

/* ── Defense (armor) assessment ──────────────────────────────────────────── */

/**
 * Canon armour is soft-capped AGAINST THE HIT SIZE:
 *
 *     mitigation(A, H) = A / (A + 5·H)          (ARMOUR_HIT_COEFF = 5)
 *
 * so a mitigation percentage is not a property of an armour rating — it is a
 * property of the RATIO between the rating and the hit it is measured against.
 * The pre-canon bands (0.08 / 0.30 / 0.45) were bare percentages calibrated
 * against the retired `armour/(armour+100)` curve, where a rating alone DID have
 * a fixed percentage. Under canon they graded a quantity whose definition had
 * changed underneath them.
 *
 * The bands below are therefore stated in the one hit-independent quantity the
 * canon curve has: `ratio = armourRating / referenceHit` (`SimResults.armorRefHit`).
 * Mitigation and effective HP follow from it exactly:
 *
 *     mitigation = r / (r + 5)            EHP multiplier = 1 + r/5
 *
 * DERIVATION — what is intended to read weak / fair / strong:
 *  - `weak` r = 1 — the armour RATING equals ONE raw incoming hit: 16.7%
 *    mitigation, +20% effective health. The hit is the soft-cap's own yardstick;
 *    below one hit the build sits on the steep, near-worthless part of the curve
 *    and the entire armour stat is worth less than a fifth of a health bar, so
 *    armour affixes lose to plain health affixes and the loot category is dead.
 *  - `target` r = 2.5 — +50% effective health (33.3% mitigation): the largest
 *    single defensive contributor without eclipsing the others.
 *  - `dominant` r = 10 — armour alone TRIPLES effective health (66.7%
 *    mitigation). Past this, evasion/block/resists are rounding errors.
 *
 * These are ratios, not percentages: they survive the reference hit changing (a
 * bigger enemy simply needs proportionally more armour to read the same), which
 * is exactly what the retired constants could not do. Every rendered number
 * names the reference hit it is quoted against.
 */
export const ARMOUR_HIT_RATIO_BANDS = {
  /** Below this the armour stat is not worth a gear slot. r = 1 → 16.7% mit, EHP ×1.20. */
  weak: 1,
  /** Intended "armour pulls its weight" centre. r = 2.5 → 33.3% mit, EHP ×1.50. */
  target: 2.5,
  /** At/above this, armour eclipses every other defence. r = 10 → 66.7% mit, EHP ×3.00. */
  dominant: 10,
} as const;

/** Canon mitigation fraction for an armour:hit ratio — `r / (r + 5)`. */
export function mitigationAtRatio(ratio: number): number {
  if (!(ratio > 0)) return 0;
  return ratio / (ratio + ARMOUR_HIT_COEFF);
}

/**
 * Invert the canon soft-cap: the armour:hit ratio a mitigation fraction implies,
 * `r = 5·m / (1 − m)`. Derived from the mitigation itself, so it holds for
 * whatever rating/hit pair produced it.
 */
export function armourHitRatio(mitigation: number): number {
  if (!(mitigation > 0)) return 0;
  if (mitigation >= 1) return Infinity;
  return (ARMOUR_HIT_COEFF * mitigation) / (1 - mitigation);
}

/** Effective-HP multiplier armour buys at a given ratio — `1 + r/5`. */
export function ehpMultiplierAtRatio(ratio: number): number {
  return 1 + ratio / ARMOUR_HIT_COEFF;
}

export type DefenceBand = 'weak' | 'healthy' | 'dominant';

/**
 * Which band a measured mitigation fraction falls in, via its implied ratio.
 * The comparison carries a relative epsilon: a ratio is recovered through two
 * float divisions, so a build sitting EXACTLY on a boundary (r = 1 → m = 1/6 →
 * r = 0.9999999999999999) must not fall to the wrong side of its own band.
 */
export function defenceBand(mitigation: number): DefenceBand {
  const r = armourHitRatio(mitigation);
  const EPS = 1e-9;
  if (r < ARMOUR_HIT_RATIO_BANDS.weak * (1 - EPS)) return 'weak';
  if (r >= ARMOUR_HIT_RATIO_BANDS.dominant * (1 - EPS)) return 'dominant';
  return 'healthy';
}

const TARGET_MIT = mitigationAtRatio(ARMOUR_HIT_RATIO_BANDS.target);
/** Zero marks at the dominant edge (and, symmetrically, at zero armour); the weak edge scores 50. */
const MIT_TOLERANCE = mitigationAtRatio(ARMOUR_HIT_RATIO_BANDS.dominant) - TARGET_MIT;

/**
 * 0–100 defence subscore for a measured mitigation fraction: a bell curve
 * centred on the target ratio, reaching zero at the dominant edge (and,
 * symmetrically, below zero armour). The weak edge scores exactly 50.
 */
export function defenceScore(mitigation: number): number {
  return curveScore(mitigation, TARGET_MIT, MIT_TOLERANCE);
}

/** "+20% effective health" / "×3 effective health" phrasing for a ratio. */
function ehpPhrase(ratio: number): string {
  const mult = ehpMultiplierAtRatio(ratio);
  if (!Number.isFinite(mult)) return 'effectively unkillable by physical hits';
  return mult >= 2
    ? `×${mult.toFixed(mult % 1 === 0 ? 0 : 1)} effective health`
    : `+${Math.round((mult - 1) * 100)}% effective health`;
}

/** `score: null` = not gradable (no reference hit) — reported, but kept out of the average. */
function assessDefense(results: SimResults): { score: number | null; finding: HealthFinding } {
  const refHit = results.armorRefHit;
  const mit = results.armorMitigation;

  // Canon mitigation is only defined against a hit. With no incoming hit there is
  // nothing to grade — say so rather than scoring a build that was never measured.
  if (!(refHit > 0)) {
    return {
      score: null,
      finding: {
        id: 'defense',
        severity: 'info',
        title: 'Armor could not be graded',
        narrative: `This scenario lands no enemy hit, and canon armor is soft-capped against hit size — without a reference hit there is no mitigation percentage to grade. Add an enemy to measure defense.`,
        anchor: { label: 'Armor blocks', value: 'n/a' },
      },
    };
  }

  const ratio = armourHitRatio(mit);
  const band = defenceBand(mit);
  const score = defenceScore(mit);
  const hit = Math.round(refHit);
  const ratioText = `${ratio.toFixed(ratio < 10 ? 2 : 1)}× the ${hit}-damage reference hit`;
  const anchor = { label: `Armor blocks (vs ${hit} hit)`, value: pct(mit) };
  const targetArmor = roundTo(ARMOUR_HIT_RATIO_BANDS.target * refHit, 5);

  if (band === 'weak') {
    return {
      score,
      finding: {
        id: 'defense',
        severity: 'warning',
        title: 'Armor is barely doing anything',
        narrative: `The player's armor rating is only ${ratioText}, so it blocks ${pct(mit)} of that hit — ${ehpPhrase(ratio)}. Canon armor is soft-capped against hit size: below a rating of one whole hit (${hit}) the stat is worth less than a plain health affix, and players will ignore that whole loot category.`,
        suggestion: `Raise armor to ~${targetArmor} (${ARMOUR_HIT_RATIO_BANDS.target}× the ${hit}-damage reference hit) for ${ehpPhrase(ARMOUR_HIT_RATIO_BANDS.target)}, or cut enemy hit size — under canon it is the ratio, not the rating, that moves the number.`,
        anchor,
      },
    };
  }
  if (band === 'dominant') {
    return {
      score,
      finding: {
        id: 'defense',
        severity: 'warning',
        title: 'Armor dominates the fight',
        narrative: `The player's armor rating is ${ratioText}, blocking ${pct(mit)} of it — ${ehpPhrase(ratio)} from armor alone. Combat will revolve around stacking armor; evasion, block and resists become rounding errors.`,
        suggestion: `Lower armor toward ~${targetArmor} (${ARMOUR_HIT_RATIO_BANDS.target}× the ${hit}-damage reference hit), or add an armor-pierce stat on tougher enemies.`,
        anchor,
      },
    };
  }
  return {
    score,
    finding: {
      id: 'defense',
      severity: 'good',
      title: 'Armor pulls its weight',
      narrative: `The player's armor rating is ${ratioText}, blocking ${pct(mit)} of it — ${ehpPhrase(ratio)}. Meaningful enough that gearing matters, not so high that it eclipses other defenses.`,
      anchor,
    },
  };
}

/* ── Win margin (how close are the wins?) ────────────────────────────────── */

function assessWinMargin(results: SimResults, scenario: SimScenario): HealthFinding | null {
  const wins = results.iterations.filter(it => it.playerSurvived);
  if (wins.length < 20) return null;

  const playerMaxHp = scenario.player.maxHealth;
  if (playerMaxHp <= 0) return null;

  const avgRemaining = wins.reduce((s, w) => s + w.playerHpRemaining, 0) / wins.length;
  const remainingPct = avgRemaining / playerMaxHp;

  if (remainingPct > 0.85 && results.survivalRate > 0.7) {
    return {
      id: 'margin',
      severity: 'info',
      title: 'Wins barely scratch the player',
      narrative: `When players win, they end with ${pct(remainingPct)} of their health left. The fight reads as a chore rather than a real test.`,
      suggestion: 'Either raise enemy damage by ~15% or stretch fights longer so health pressure builds.',
      anchor: { label: 'Avg HP on win', value: pct(remainingPct) },
    };
  }
  if (remainingPct < 0.15 && results.survivalRate > 0.4) {
    return {
      id: 'margin',
      severity: 'warning',
      title: 'Every win is a narrow escape',
      narrative: `When players survive, they limp out with only ${pct(remainingPct)} of their health. That feels exciting once or twice — across a whole zone it becomes exhausting.`,
      suggestion: 'Add a healing pickup mid-fight, or shave 10% off enemy damage.',
      anchor: { label: 'Avg HP on win', value: pct(remainingPct) },
    };
  }
  return null;
}

/* ── Overkill waste ──────────────────────────────────────────────────────── */

function assessOverkill(results: SimResults): HealthFinding | null {
  const totalDamage = results.iterations.reduce((s, it) => s + it.totalDamage, 0);
  const totalOverkill = results.iterations.reduce((s, it) => s + it.overkill, 0);
  if (totalDamage <= 0) return null;
  const ratio = totalOverkill / totalDamage;

  if (ratio > 0.35) {
    return {
      id: 'overkill',
      severity: 'info',
      title: 'A lot of damage is wasted on overkill',
      narrative: `${pct(ratio)} of damage spills past enemies after they die. Players are over-committing because they can't tell when a target will fall.`,
      suggestion: 'Add a clearer low-HP visual on enemies, or smaller execute window for finishing moves.',
      anchor: { label: 'Wasted', value: pct(ratio) },
    };
  }
  return null;
}

/* ── Top recommendation extraction ───────────────────────────────────────── */

function buildRecommendations(findings: HealthFinding[]): string[] {
  const rank = { critical: 0, warning: 1, info: 2, good: 3 } as const;
  return findings
    .filter(f => f.suggestion)
    .sort((a, b) => rank[a.severity] - rank[b.severity])
    .slice(0, 4)
    .map(f => f.suggestion!);
}

/* ── Headline + narrative composition ────────────────────────────────────── */

function composeHeadline(grade: HealthGrade, results: SimResults): string {
  const s = results.survivalRate;
  if (grade === 'A') return 'This encounter is in great shape.';
  if (grade === 'B') return 'Solid encounter with a couple of small adjustments to consider.';
  if (grade === 'C') return 'Workable, but a few rough edges to smooth out.';
  if (grade === 'D') return s < 0.4 ? 'This fight is too punishing for the player.' : 'This fight needs meaningful retuning.';
  return s < 0.3 ? 'This encounter is brutally unfair as tuned.' : 'This encounter is well outside the healthy range.';
}

function composeNarrative(results: SimResults, scenario: SimScenario): string {
  const s = results.survivalRate;
  const t = results.ttkStats.mean;
  const enemyCount = scenario.enemies.reduce((sum, e) => sum + e.count, 0);
  const lvl = scenario.player.level;

  const winPhrase =
    s > 0.85 ? 'win comfortably' :
    s > 0.6 ? 'usually win' :
    s > 0.4 ? 'win about half the time' :
    s > 0.2 ? 'lose most fights' :
    'almost always die';

  const lengthPhrase =
    t < 1 ? 'in under a second' :
    t < 3 ? `in about ${t.toFixed(1)} seconds` :
    t < 10 ? `in roughly ${t.toFixed(0)} seconds` :
    t < 30 ? `over ${Math.round(t)} seconds of sustained combat` :
    `dragging out past ${Math.round(t)} seconds`;

  return `A level ${lvl} player facing ${enemyCount} enemies will ${winPhrase}, with fights resolving ${lengthPhrase}. ${
    s < 0.45 ? 'Players will feel this area is unfair and may quit before reaching the next checkpoint. ' :
    s > 0.95 ? 'The encounter offers little resistance — designers should expect players to breeze past without engaging with combat systems. ' :
    'Pacing is roughly where it should be for an engaging encounter. '
  }See findings below for specifics and concrete tuning levers.`;
}

/* ── Public entry point ──────────────────────────────────────────────────── */

export function buildBalanceHealthReport(results: SimResults, scenario: SimScenario): BalanceHealthReport {
  const survival = assessSurvival(results, scenario);
  const duration = assessDuration(results);
  const consistency = assessConsistency(results);
  const defense = assessDefense(results);
  const margin = assessWinMargin(results, scenario);
  const overkill = assessOverkill(results);

  const findings: HealthFinding[] = [
    survival.finding,
    duration.finding,
    defense.finding,
    ...(consistency ? [consistency.finding] : []),
    ...(margin ? [margin] : []),
    ...(overkill ? [overkill] : []),
  ];

  // Severity-first ordering, then preserve insertion order
  const rank = { critical: 0, warning: 1, info: 2, good: 3 } as const;
  findings.sort((a, b) => rank[a.severity] - rank[b.severity]);

  const subScores = [
    survival.score,
    duration.score,
    ...(defense.score !== null ? [defense.score] : []),
    ...(consistency ? [consistency.score] : []),
  ];
  const score = Math.round(subScores.reduce((s, v) => s + v, 0) / subScores.length);
  const grade = scoreToGrade(score);

  return {
    grade,
    score,
    headline: composeHeadline(grade, results),
    narrative: composeNarrative(results, scenario),
    findings,
    topRecommendations: buildRecommendations(findings),
  };
}
