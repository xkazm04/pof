import { describe, it, expect } from 'vitest';
import {
  narrateSummary,
  formatReportCardText,
  type FightReportCard,
} from '@/lib/combat/fight-report';
import type {
  CombatSummary,
  ThreatBreakdown,
  ThreatEntry,
  EnemyThreatEntry,
  BalanceAlert,
} from '@/types/combat-simulator';

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeSummary(over: Partial<CombatSummary> = {}): CombatSummary {
  return {
    survivalRate: 0.7,
    avgFightDurationSec: 12,
    medianFightDurationSec: 11,
    avgDamageDealt: 500,
    avgDamageTaken: 300,
    avgPlayerHealthRemaining: 40,
    avgDPS: 42,
    avgEnemyDPS: 18,
    avgCritRate: 0.2,
    abilityHeatmap: {},
    damageDealtBuckets: [],
    damageTakenBuckets: [],
    durationBuckets: [],
    oneShotRate: 0,
    threatBreakdown: emptyBreakdown(),
    ...over,
  };
}

function emptyBreakdown(): ThreatBreakdown {
  return { bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 };
}

function makeSource(over: Partial<ThreatEntry> = {}): ThreatEntry {
  return {
    enemy: 'Stone Brute',
    ability: 'Charge Attack',
    abilityId: 'ga-enemy-charge',
    totalDamage: 800,
    damageShare: 0.6,
    killCount: 4,
    killShare: 0.4,
    nerfSuggestion: 'Primary killer — raise cooldown or lower baseDamage.',
    ...over,
  };
}

function makeEnemy(over: Partial<EnemyThreatEntry> = {}): EnemyThreatEntry {
  return {
    enemy: 'Stone Brute',
    totalDamage: 800,
    damageShare: 0.6,
    killCount: 4,
    killShare: 0.4,
    nerfSuggestion: 'Primary killer.',
    ...over,
  };
}

function breakdownWith(
  source: ThreatEntry,
  over: Partial<ThreatBreakdown> = {},
): ThreatBreakdown {
  return {
    bySource: [source],
    byEnemy: [makeEnemy({ enemy: source.enemy, killShare: source.killShare, damageShare: source.damageShare })],
    totalDeaths: 10,
    totalDamageTaken: 1000,
    ...over,
  };
}

function alert(over: Partial<BalanceAlert> = {}): BalanceAlert {
  return {
    severity: 'warning',
    type: 'one-shot',
    message: 'One-shot rate 8% exceeds 5% threshold',
    metric: 'oneShotRate',
    value: 0.08,
    threshold: 0.05,
    ...over,
  };
}

// ── headline (win rate) ─────────────────────────────────────────────────────

describe('narrateSummary — headline', () => {
  it('frames a fair win-rate as "usually win" with an X-of-10 count', () => {
    const card = narrateSummary(makeSummary({ survivalRate: 0.7 }), emptyBreakdown(), []);
    expect(card.band).toBe('fair');
    expect(card.winsPerTen).toBe(7);
    expect(card.headline).toMatch(/usually win/i);
    expect(card.headline).toContain('7 of 10 tries');
  });

  it('calls out a brutal fight when survival is low', () => {
    const card = narrateSummary(makeSummary({ survivalRate: 0.2 }), emptyBreakdown(), []);
    expect(card.band).toBe('brutal');
    expect(card.winsPerTen).toBe(2);
    expect(card.headline).toMatch(/brutal/i);
    expect(card.headline).toContain('2 of 10 tries');
  });

  it('flags an over-easy fight when survival is very high', () => {
    const card = narrateSummary(makeSummary({ survivalRate: 0.96 }), emptyBreakdown(), []);
    expect(card.band).toBe('easy');
    expect(card.headline).toMatch(/too easy/i);
  });

  it('marks a coin-flip survival as a tough fight', () => {
    const card = narrateSummary(makeSummary({ survivalRate: 0.45 }), emptyBreakdown(), []);
    expect(card.band).toBe('tough');
    expect(card.headline).toMatch(/tough/i);
    expect(card.headline).toContain('5 of 10');
  });
});

// ── verdict (pace) ──────────────────────────────────────────────────────────

describe('narrateSummary — verdict (pace)', () => {
  it('reports a typical fight length in plain seconds', () => {
    const card = narrateSummary(makeSummary({ avgFightDurationSec: 12 }), emptyBreakdown(), []);
    expect(card.verdict).toContain('about 12 seconds');
  });

  it('flags very short fights', () => {
    const card = narrateSummary(makeSummary({ avgFightDurationSec: 1.5 }), emptyBreakdown(), []);
    expect(card.verdict).toMatch(/flash|quick/i);
  });

  it('flags very long fights as a slog', () => {
    const card = narrateSummary(makeSummary({ avgFightDurationSec: 75 }), emptyBreakdown(), []);
    expect(card.verdict).toMatch(/drag|long/i);
  });
});

// ── topFix (threat breakdown) ───────────────────────────────────────────────

describe('narrateSummary — top fix', () => {
  it('names the dominant killer and suggests softening it', () => {
    const breakdown = breakdownWith(makeSource({ killShare: 0.4, killCount: 4 }));
    const card = narrateSummary(makeSummary({ survivalRate: 0.6 }), breakdown, []);
    expect(card.topFix).toBeTruthy();
    expect(card.topFix!).toContain('Stone Brute');
    expect(card.topFix!).toContain('Charge Attack');
    expect(card.topFix!).toContain('4 of every 10 deaths');
    expect(card.topFix!.toLowerCase()).toContain('soften');
  });

  it('has no top fix when the player never dies', () => {
    const card = narrateSummary(makeSummary({ survivalRate: 0.95 }), emptyBreakdown(), []);
    expect(card.topFix).toBeNull();
  });

  it('says danger is spread out when no single attack dominates', () => {
    const breakdown = breakdownWith(makeSource({ killShare: 0.15, killCount: 2, damageShare: 0.2 }));
    const card = narrateSummary(makeSummary({ survivalRate: 0.5 }), breakdown, []);
    expect(card.topFix).toBeTruthy();
    expect(card.topFix!.toLowerCase()).not.toContain('soften');
    expect(card.topFix!.toLowerCase()).toMatch(/spread|no single/i);
  });
});

// ── notes (alerts) ──────────────────────────────────────────────────────────

describe('narrateSummary — notes', () => {
  it('translates warning/critical alerts into plain notes', () => {
    const card = narrateSummary(makeSummary(), emptyBreakdown(), [alert({ type: 'one-shot' })]);
    expect(card.notes.length).toBe(1);
    expect(card.notes[0].toLowerCase()).toMatch(/instant|react/);
  });

  it('drops info-level alerts and survival alerts already covered by the headline', () => {
    const card = narrateSummary(makeSummary(), emptyBreakdown(), [
      alert({ severity: 'info', type: 'ability-unused' }),
      alert({ severity: 'warning', type: 'survival-low' }),
    ]);
    expect(card.notes).toEqual([]);
  });

  it('caps notes at three', () => {
    const card = narrateSummary(makeSummary(), emptyBreakdown(), [
      alert({ type: 'one-shot' }),
      alert({ type: 'too-long' }),
      alert({ type: 'ability-unused' }),
      alert({ type: 'dps-bottleneck' }),
      alert({ type: 'overkill' }),
    ]);
    expect(card.notes.length).toBe(3);
  });
});

// ── shareable text ──────────────────────────────────────────────────────────

describe('formatReportCardText', () => {
  it('renders a shareable plain-text block with headline, verdict, fix and notes', () => {
    const card: FightReportCard = {
      band: 'fair',
      winsPerTen: 7,
      headline: 'You usually win (7 of 10 tries).',
      verdict: 'A typical fight lasts about 12 seconds.',
      topFix: 'Soften it to make the fight fairer.',
      notes: ['Watch out: some hits kill you instantly.'],
    };
    const text = formatReportCardText(card, 'Lvl 5 vs 3x Grunt');
    expect(text).toContain('Lvl 5 vs 3x Grunt');
    expect(text).toContain('You usually win (7 of 10 tries).');
    expect(text).toContain('A typical fight lasts about 12 seconds.');
    expect(text).toContain('Soften it to make the fight fairer.');
    expect(text).toContain('• Watch out: some hits kill you instantly.');
  });

  it('omits the fix line and notes when absent', () => {
    const card: FightReportCard = {
      band: 'easy',
      winsPerTen: 10,
      headline: 'You win almost every fight.',
      verdict: 'A typical fight lasts about 5 seconds.',
      topFix: null,
      notes: [],
    };
    const text = formatReportCardText(card);
    expect(text).toContain('You win almost every fight.');
    expect(text).not.toContain('•');
  });
});
