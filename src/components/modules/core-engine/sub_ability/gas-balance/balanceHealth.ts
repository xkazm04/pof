/**
 * Balance Health Report — translates jargon-dense SimResults into plain prose
 * with concrete tuning recommendations a non-technical designer can act on.
 *
 * Pure functions only; no React, no formatters that depend on UI state.
 */

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

function assessDefense(results: SimResults, scenario: SimScenario): { score: number; finding: HealthFinding } {
  const mit = results.armorMitigation;
  const score = curveScore(mit, 0.3, 0.45);

  if (mit < 0.08) {
    return {
      score,
      finding: {
        id: 'defense',
        severity: 'warning',
        title: 'Armor is barely doing anything',
        narrative: `The player's armor blocks only ${pct(mit)} of incoming damage. Armor stats on gear will feel pointless — players will ignore that whole loot category.`,
        suggestion: `Try raising starting armor to ~${roundTo(scenario.player.armor + 30, 5)}, or boost armor scaling per level.`,
        anchor: { label: 'Armor blocks', value: pct(mit) },
      },
    };
  }
  if (mit > 0.7) {
    return {
      score,
      finding: {
        id: 'defense',
        severity: 'warning',
        title: 'Armor dominates the fight',
        narrative: `The player's armor blocks ${pct(mit)} of incoming damage. Combat will revolve around stacking armor; other defensive stats and abilities will feel weak.`,
        suggestion: 'Try lowering armor scaling, or add an armor-pierce stat on tougher enemies.',
        anchor: { label: 'Armor blocks', value: pct(mit) },
      },
    };
  }
  return {
    score,
    finding: {
      id: 'defense',
      severity: 'good',
      title: 'Armor pulls its weight',
      narrative: `The player's armor blocks about ${pct(mit)} of incoming damage — meaningful enough that gearing matters, not so high that it eclipses other defenses.`,
      anchor: { label: 'Armor blocks', value: pct(mit) },
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
  const defense = assessDefense(results, scenario);
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
    defense.score,
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
