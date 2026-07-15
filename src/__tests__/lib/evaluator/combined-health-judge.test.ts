import { describe, it, expect } from 'vitest';
import {
  computeProjectHealth,
  aggregateJudgeByModule,
  detectJudgeDiscrepancies,
  judgeDiscrepancy,
  type ModuleJudgeSignal,
} from '@/lib/evaluator/combined-health';
import type { ModuleCorrelation } from '@/lib/evaluator/correlation-engine';
import type { JudgeVerdict } from '@/lib/status/judge-verdicts-db';

function mod(partial: Partial<ModuleCorrelation> = {}): ModuleCorrelation {
  return {
    moduleId: 'arpg-inventory', label: 'Inventory',
    avgQuality: 4, pctComplete: 0.8, totalFeatures: 10, implemented: 8, partial: 1, missing: 1,
    blockedCount: 1, dependencyCount: 2, sessionCount: 3, successRate: 1, avgDurationMs: 0,
    scannerScore: null, issueCount: 0, hasData: true, ...partial,
  };
}

function verdict(partial: Partial<JudgeVerdict>): JudgeVerdict {
  return {
    catalogId: 'items', entityId: 'sword', step: 'Icon 2D Art',
    judge: 'llm-panel', verdict: 'pass', score: 90, findings: 'f', model: 'opus', ...partial,
  };
}

describe('combined-health — backward compatibility (no verdicts)', () => {
  // The exact historical composite for the mod() fixture:
  //  quality 80, dep 90, coverage 80, activity 30, combined 78.
  const EXPECTED = { quality: 80, dependencyHealth: 90, coverage: 80, activity: 30, combined: 78 };

  it('produces the identical breakdown when no judge map is passed', () => {
    const h = computeProjectHealth([mod()]);
    expect(h.moduleScores[0].breakdown).toEqual(EXPECTED);
    // No judge keys leak in.
    expect(h.moduleScores[0].breakdown).not.toHaveProperty('judgedContent');
    expect(h.moduleScores[0].breakdown).not.toHaveProperty('discrepancy');
  });

  it('is identical with an empty judge map or a map missing this module', () => {
    const withEmpty = computeProjectHealth([mod()], new Map());
    const withOther = computeProjectHealth([mod()], new Map([['some-other', { avgScore: 10, count: 1, failCount: 1 }]]));
    expect(withEmpty.moduleScores[0].breakdown).toEqual(EXPECTED);
    expect(withOther.moduleScores[0].breakdown).toEqual(EXPECTED);
  });
});

describe('combined-health — judged-content fusion', () => {
  it('folds the judged term in with the documented weights', () => {
    const judge = new Map<string, ModuleJudgeSignal>([['arpg-inventory', { avgScore: 50, count: 4, failCount: 2 }]]);
    const b = computeProjectHealth([mod()], judge).moduleScores[0].breakdown;
    // 80*.30 + 50*.25 + 90*.20 + 80*.15 + 30*.10 = 69.5 → 70
    expect(b.combined).toBe(70);
    expect(b.judgedContent).toBe(50);
    expect(b.discrepancy).toBe(true);
    expect(b.discrepancyReason).toContain('2 of 4');
  });

  it('does NOT flag a discrepancy when the judges also pass', () => {
    const judge = new Map<string, ModuleJudgeSignal>([['arpg-inventory', { avgScore: 92, count: 3, failCount: 0 }]]);
    const b = computeProjectHealth([mod()], judge).moduleScores[0].breakdown;
    expect(b.judgedContent).toBe(92);
    expect(b.discrepancy).toBe(false);
    expect(b.discrepancyReason).toBeUndefined();
  });

  it('does NOT flag when matrix quality is itself low (no false green to expose)', () => {
    // avgQuality 2 → matrix quality 40, below the healthy line.
    const judge = new Map<string, ModuleJudgeSignal>([['arpg-inventory', { avgScore: 30, count: 2, failCount: 2 }]]);
    const b = computeProjectHealth([mod({ avgQuality: 2 })], judge).moduleScores[0].breakdown;
    expect(b.discrepancy).toBe(false);
  });
});

describe('judgeDiscrepancy (pure rule)', () => {
  it('flags healthy matrix + failing judge', () => {
    expect(judgeDiscrepancy(85, { avgScore: 60, count: 2, failCount: 0 }).discrepancy).toBe(true);
    expect(judgeDiscrepancy(85, { avgScore: 95, count: 2, failCount: 1 }).discrepancy).toBe(true);
  });
  it('does not flag when either side is fine', () => {
    expect(judgeDiscrepancy(60, { avgScore: 30, count: 2, failCount: 2 }).discrepancy).toBe(false);
    expect(judgeDiscrepancy(85, { avgScore: 95, count: 2, failCount: 0 }).discrepancy).toBe(false);
  });
});

describe('aggregateJudgeByModule — catalog→module mapping', () => {
  it('maps catalogs to their owning module and EXCLUDES unmapped catalogs', () => {
    const map = aggregateJudgeByModule([
      verdict({ catalogId: 'items', score: 80 }),               // → arpg-inventory
      verdict({ catalogId: 'loot-tables', step: 'Drops', score: 40, verdict: 'fail' }), // → arpg-loot
      verdict({ catalogId: 'totally-unmapped', step: 'X', score: 10, verdict: 'fail' }), // excluded
    ]);
    expect(map.get('arpg-inventory')).toEqual({ avgScore: 80, count: 1, failCount: 0 });
    expect(map.get('arpg-loot')).toEqual({ avgScore: 40, count: 1, failCount: 1 });
    expect(map.has('arpg-gas')).toBe(false); // no silent fallback attribution
    // The unmapped catalog contributed to no module at all.
    const total = [...map.values()].reduce((n, s) => n + s.count, 0);
    expect(total).toBe(2);
  });

  it('de-dupes to the newest rubric per (catalog, entity, step)', () => {
    const map = aggregateJudgeByModule([
      verdict({ score: 40, verdict: 'fail', rubricVersion: 2 }),
      verdict({ score: 95, verdict: 'pass', rubricVersion: 3 }),
    ]);
    // Only the v3 verdict counts.
    expect(map.get('arpg-inventory')).toEqual({ avgScore: 95, count: 1, failCount: 0 });
  });
});

describe('detectJudgeDiscrepancies — badge input', () => {
  const cells = [
    { moduleId: 'arpg-inventory', label: 'Inventory', avgQuality: 4.5 }, // matrix 90 (healthy)
    { moduleId: 'arpg-loot', label: 'Loot', avgQuality: null },          // no matrix quality
  ];

  it('flags a healthy-matrix module whose content judges failed', () => {
    const judge = new Map<string, ModuleJudgeSignal>([['arpg-inventory', { avgScore: 40, count: 2, failCount: 1 }]]);
    const flags = detectJudgeDiscrepancies(cells, judge);
    expect(flags).toHaveLength(1);
    expect(flags[0].moduleId).toBe('arpg-inventory');
    expect(flags[0].matrixQuality).toBe(90);
    expect(flags[0].judgedContent).toBe(40);
    expect(flags[0].reason).toContain('healthy');
  });

  it('never flags a module with no matrix quality', () => {
    const judge = new Map<string, ModuleJudgeSignal>([['arpg-loot', { avgScore: 5, count: 3, failCount: 3 }]]);
    expect(detectJudgeDiscrepancies(cells, judge)).toHaveLength(0);
  });
});
