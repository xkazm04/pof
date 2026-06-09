import type {
  CombatSummary,
  ThreatBreakdown,
  BalanceAlert,
} from '@/types/combat-simulator';

/**
 * Plain-language "Fight Report Card" layer for the Combat Simulator's Simple Mode.
 *
 * Turns the jargon-dense Monte-Carlo output (survival rate, DPS, threat shares,
 * balance alerts) into a narrated card any non-technical stakeholder grasps in
 * one read — the consumer-grade framing the idea calls for:
 *
 *   "You usually win (7 of 10 tries), it takes about 12 seconds, and the thing
 *    most likely to kill you is the Stone Brute charge (it landed the killing
 *    blow in 4 of every 10 deaths) — soften that charge to make it fairer."
 *
 * Mirrors the Prompt Evolution view's Simple/Advanced split
 * (`@/lib/prompt-evolution/plain-language`). Everything here is a pure function
 * derived from the supplied records — no DOM, no wall-clock — so it stays
 * unit-testable and screenshot-stable.
 */

/** Overall difficulty band, derived from survival rate. */
export type ReportBand = 'easy' | 'fair' | 'tough' | 'brutal';

export interface FightReportCard {
  /** Difficulty band (drives color + the "too easy / brutal" framing). */
  band: ReportBand;
  /** Wins out of 10 tries (0–10), the headline framing of survival rate. */
  winsPerTen: number;
  /** "You usually win (7 of 10 tries)." */
  headline: string;
  /** Pace sentence: "A typical fight lasts about 12 seconds." */
  verdict: string;
  /** Top threat + a plain fix, or null when the player rarely dies. */
  topFix: string | null;
  /** Up to three secondary call-outs translated from balance alerts. */
  notes: string[];
}

/** A single attack must own at least this share of deaths to earn a "soften it". */
const DOMINANT_KILLER_SHARE = 0.3;

function clampTen(n: number): number {
  return Math.max(0, Math.min(10, n));
}

/** Survival rate (0–1) → wins out of 10 tries, the headline's plain framing. */
function winsOutOfTen(rate: number): number {
  return clampTen(Math.round(rate * 10));
}

function difficultyBand(rate: number): ReportBand {
  if (rate >= 0.9) return 'easy';
  if (rate >= 0.6) return 'fair';
  if (rate >= 0.35) return 'tough';
  return 'brutal';
}

/** Format a fight length in plain seconds ("12 seconds", "1.5 seconds"). */
function plainSeconds(sec: number): string {
  const v = sec < 10 ? sec.toFixed(1) : String(Math.round(sec));
  return `${v} second${v === '1' ? '' : 's'}`;
}

function buildHeadline(band: ReportBand, winsPerTen: number): string {
  switch (band) {
    case 'easy':
      return `You win almost every fight (${winsPerTen} of 10 tries) — this encounter may be too easy.`;
    case 'fair':
      return `You usually win (${winsPerTen} of 10 tries).`;
    case 'tough':
      return `This is a tough fight — you win about ${winsPerTen} of 10 tries.`;
    case 'brutal':
      return `This fight is brutal — you only win ${winsPerTen} of 10 tries.`;
  }
}

function buildVerdict(avgFightDurationSec: number): string {
  const dur = plainSeconds(avgFightDurationSec);
  if (avgFightDurationSec < 3) {
    return `Fights are over in a flash — about ${dur} each, which can feel too quick to land.`;
  }
  if (avgFightDurationSec > 30) {
    return `Fights drag on — about ${dur} each, long enough to start feeling like a slog.`;
  }
  return `A typical fight lasts about ${dur}.`;
}

function buildTopFix(threatBreakdown: ThreatBreakdown): string | null {
  const top = threatBreakdown.bySource[0];
  // Player essentially never dies → nothing to nerf.
  if (threatBreakdown.totalDeaths === 0 || !top || top.killShare <= 0) {
    return null;
  }
  if (top.killShare >= DOMINANT_KILLER_SHARE) {
    const killsPerTen = clampTen(Math.max(1, Math.round(top.killShare * 10)));
    return `The thing most likely to kill you is the ${top.enemy}'s ${top.ability} — `
      + `it landed the killing blow in ${killsPerTen} of every 10 deaths. `
      + `Soften it to make the fight fairer.`;
  }
  // Deaths exist but no single attack dominates — don't over-claim a culprit.
  return `No single attack dominates your deaths — the ${top.enemy}'s ${top.ability} is the most `
    + `common cause, but the danger is spread across several sources.`;
}

/** Plain one-liner for a balance alert, or null when it has no Simple-Mode voice. */
export function plainAlert(alert: BalanceAlert): string | null {
  switch (alert.type) {
    case 'one-shot':
      return 'Watch out: some hits kill you instantly, before you can react.';
    case 'too-long':
      return 'Fights run long — they may start to feel like a grind.';
    case 'too-short':
      return 'Fights end almost instantly — they may feel unsatisfying.';
    case 'ability-unused':
      return 'Some abilities almost never get used — they may need a reason to exist.';
    case 'dps-bottleneck':
      return 'Your damage is low for this fight — enemies take a long time to drop.';
    case 'overkill':
      return 'You overkill enemies — your hits are stronger than they need to be.';
    // survival-low / survival-high are already covered by the headline.
    case 'survival-low':
    case 'survival-high':
      return null;
  }
}

/**
 * Build the plain-language Fight Report Card from a finished simulation's
 * summary, threat breakdown, and balance alerts.
 */
export function narrateSummary(
  summary: CombatSummary,
  threatBreakdown: ThreatBreakdown,
  alerts: BalanceAlert[],
): FightReportCard {
  const band = difficultyBand(summary.survivalRate);
  const winsPerTen = winsOutOfTen(summary.survivalRate);

  const notes = alerts
    .filter((a) => a.severity !== 'info')
    .map(plainAlert)
    .filter((s): s is string => Boolean(s))
    .slice(0, 3);

  return {
    band,
    winsPerTen,
    headline: buildHeadline(band, winsPerTen),
    verdict: buildVerdict(summary.avgFightDurationSec),
    topFix: buildTopFix(threatBreakdown),
    notes,
  };
}

/**
 * Render a Fight Report Card as a shareable plain-text block (for copy-to-
 * clipboard / pasting into a doc). Pure: no clipboard, no DOM.
 */
export function formatReportCardText(card: FightReportCard, scenarioName?: string): string {
  const lines: string[] = [scenarioName ? `Fight Report — ${scenarioName}` : 'Fight Report', ''];
  lines.push(card.headline, card.verdict);
  if (card.topFix) lines.push(card.topFix);
  if (card.notes.length > 0) {
    lines.push('');
    for (const note of card.notes) lines.push(`• ${note}`);
  }
  return lines.join('\n');
}
