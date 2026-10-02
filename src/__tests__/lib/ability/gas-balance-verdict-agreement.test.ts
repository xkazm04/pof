/**
 * One encounter-band law: the GAS Balance health report, the level-sweep
 * breakpoints and the survival badges must read the SAME verdict for the same
 * fight, because they all derive it from `@/lib/balance/encounter-bands`.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { detectBreakpoints } from '@/components/modules/core-engine/sub_ability/gas-balance/simulation';
import { buildBalanceHealthReport } from '@/components/modules/core-engine/sub_ability/gas-balance/balanceHealth';
import { SCENARIO_PRESETS } from '@/components/modules/core-engine/sub_ability/gas-balance/data';
import type { SimResults } from '@/components/modules/core-engine/sub_ability/gas-balance/data';
import { survivalTone } from '@/lib/balance/encounter-bands';
import { STATUS_WARNING } from '@/lib/chart-colors';
import { narrateSummary } from '@/lib/combat/fight-report';
import type { CombatSummary, ThreatBreakdown } from '@/types/combat-simulator';

const SCENARIO = SCENARIO_PRESETS[0];
const GAS_DIR = path.resolve(__dirname, '../../../components/modules/core-engine/sub_ability/gas-balance');

function resultsAt(survivalRate: number, ttk: number): SimResults {
  return {
    scenarioId: 'grid',
    iterations: [],
    ttkStats: { mean: ttk, median: ttk, p10: ttk, p90: ttk, min: ttk, max: ttk, stdDev: ttk * 0.3 },
    dpsStats: { mean: 1, median: 1, min: 1, max: 1 },
    critRate: 0,
    survivalRate,
    effectiveHp: 500,
    armorMitigation: 0.3,
    armorRefHit: 40,
    seed: 1,
    timestamp: 0,
  };
}

function reportFlags(s: number, t: number): boolean {
  const rep = buildBalanceHealthReport(resultsAt(s, t), SCENARIO);
  return rep.findings.some(
    f => (f.id === 'survival' || f.id === 'duration') && (f.severity === 'warning' || f.severity === 'critical'),
  );
}

describe('report and sweep agree over the survival x TTK grid', () => {
  it('147/147 grid points: a sweep breakpoint exists exactly when the report flags survival or duration', () => {
    const disagreements: string[] = [];
    let total = 0;
    for (let si = 0; si <= 20; si++) {
      const s = si / 20;
      for (const t of [0.5, 2, 4, 10, 25, 50, 70]) {
        total++;
        const sweep = detectBreakpoints([{ level: 1, ttk: t, survivalRate: s, dps: 1, ehp: 500 }]).length > 0;
        const report = reportFlags(s, t);
        if (sweep !== report) disagreements.push(`s=${s} t=${t} report=${report} sweep=${sweep}`);
      }
    }
    expect(total).toBe(147);
    expect(disagreements).toEqual([]);
  });

  it('a level at 21% survival is a breakpoint naming the brutal band', () => {
    const bps = detectBreakpoints([{ level: 9, survivalRate: 0.21, ttk: 9.8, dps: 50, ehp: 500 }]);
    expect(bps).toHaveLength(1);
    expect(bps[0].level).toBe(9);
    expect(bps[0].reason).toMatch(/brutal/i);
  });
});

describe('the report does not contradict itself', () => {
  it('at 96% survival the finding and the narrative name the same (easy) band', () => {
    const rep = buildBalanceHealthReport(resultsAt(0.96, 4), SCENARIO);
    const f = rep.findings.find(x => x.id === 'survival')!;
    expect(f.severity).toBe('warning');
    expect(f.narrative).toMatch(/\beasy band\b/);
    expect(rep.narrative).toMatch(/\beasy band\b/);
    expect(rep.narrative).not.toMatch(/\b(fair|tough|brutal) band\b/);
  });
});

describe('survival badges read the band tone', () => {
  it('survivalTone(0.55) is the tough band warning tone', () => {
    expect(survivalTone(0.55)).toBe(STATUS_WARNING);
  });

  it('the Survival StatBadge and the sweep-table Survival cell colour by survivalTone', () => {
    const summary = fs.readFileSync(path.join(GAS_DIR, 'ResultsSummary.tsx'), 'utf8');
    const sweep = fs.readFileSync(path.join(GAS_DIR, 'LevelSweepPanel.tsx'), 'utf8');
    expect(summary).toMatch(/label="Survival"[^\n]*color=\{survivalTone\(results\.survivalRate\)\}/);
    expect(sweep).toMatch(/color: survivalTone\(p\.survivalRate\)/);
  });
});

describe('source guard — no inline survival cuts in gas-balance', () => {
  it('0 matches of an inline survival-rate comparison across gas-balance/*.ts(x)', () => {
    const re = /survivalRate\s*[<>]=?\s*0\.\d|\bs\s*[<>]=?\s*0\.\d/g;
    const hits: string[] = [];
    for (const name of fs.readdirSync(GAS_DIR)) {
      if (!/\.tsx?$/.test(name)) continue;
      const src = fs.readFileSync(path.join(GAS_DIR, name), 'utf8');
      src.split(/\r?\n/).forEach((line, i) => {
        if (line.match(re)) hits.push(`${name}:${i + 1}`);
      });
    }
    expect(hits).toEqual([]);
  });
});

describe('[guard] the Combat Simulator headline keeps its bands', () => {
  const breakdown: ThreatBreakdown = { bySource: [], byEnemy: [], totalDeaths: 0, totalDamageTaken: 0 };
  const summary = (survivalRate: number) => ({ survivalRate, avgFightDurationSec: 12 }) as CombatSummary;
  it.each([
    [0.7, /usually win/],
    [0.2, /brutal/],
    [0.96, /too easy/],
    [0.45, /tough/],
  ] as const)('survival %s', (rate, re) => {
    expect(narrateSummary(summary(rate), breakdown, []).headline).toMatch(re);
  });
});
