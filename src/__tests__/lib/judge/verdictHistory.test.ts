import { describe, it, expect, vi, beforeEach } from 'vitest';

// In-memory DB so the test never touches ~/.pof/pof.db.
vi.mock('@/lib/db', async () => {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(':memory:');
  return { getDb: () => db };
});

import { getDb } from '@/lib/db';
import {
  upsertVerdict, listVerdicts, listVerdictHistory, VERDICT_HISTORY_LIMIT, type JudgeVerdict,
} from '@/lib/status/judge-verdicts-db';
import { bridgeJudgeVerdict } from '@/lib/catalog/acceptance/judgeBridge';
import { buildVerdictTrend } from '@/lib/judge/verdictTrend';
import type { AcceptanceResult } from '@/lib/catalog/acceptance/types';

/**
 * A RE-JUDGE MUST NOT DESTROY THE RECORD.
 *
 * `judge_verdicts` keeps one row per (catalog, entity, step, judge), so the second judging run
 * overwrote the first — and the single question a quality loop exists to answer, "did my fix
 * actually improve this?", could not be answered from the data. The fix is an ADDITIVE
 * append-only log; these tests pin BOTH halves of the contract:
 *
 *  (1) history is preserved and BOUNDED, and
 *  (2) ACCEPTANCE IS UNCHANGED — `judge_verdicts` still holds exactly one row per judge class,
 *      so `bridgeJudgeVerdict` still sees exactly one applicable verdict and grades identically.
 */

function base(partial: Partial<JudgeVerdict> = {}): JudgeVerdict {
  return {
    catalogId: 'items', entityId: 'sword', step: 'Economy',
    judge: 'llm-panel', verdict: 'pass', score: 70,
    findings: 'Prices reconcile with the declared power budget.', model: 'opus',
    ...partial,
  };
}

const CLEAN: AcceptanceResult = { label: 'Economy sound', status: 'pass', tier: 'L0', detail: 'ok' };

beforeEach(() => {
  try { getDb().exec('DELETE FROM judge_verdicts; DELETE FROM judge_verdict_history;'); } catch { /* not created yet */ }
});

describe('judge verdict history — the record survives a re-judge', () => {
  it('keeps every judgment while the CURRENT verdict stays exactly one row', () => {
    upsertVerdict(base({ score: 41, verdict: 'fail', findings: 'Faucet outruns the sink by 4x.' }));
    upsertVerdict(base({ score: 58, verdict: 'fail', findings: 'Closer, still 40% over.' }));
    upsertVerdict(base({ score: 77, findings: 'Within the canon envelope.' }));

    const current = listVerdicts('items');
    expect(current).toHaveLength(1);                 // unambiguous: one "verdict now"
    expect(current[0].score).toBe(77);               // …and it is the newest
    expect(current[0].verdict).toBe('pass');

    const history = listVerdictHistory('items', 'sword', 'Economy', 'llm-panel');
    expect(history.map((h) => h.score)).toEqual([41, 58, 77]);   // oldest first
    expect(history[0].findings).toContain('4x');                 // the PRIOR reasoning survives
  });

  it('makes the trend retrievable — the question the loop exists to answer', () => {
    for (const s of [41, 58, 77]) upsertVerdict(base({ score: s, verdict: s >= 60 ? 'pass' : 'fail' }));
    const trend = buildVerdictTrend(listVerdictHistory('items', 'sword', 'Economy', 'llm-panel'));
    expect(trend.direction).toBe('improved');
    expect(trend.delta).toBe(36);
  });

  it('keeps judge classes apart (a vision score is not a panel score)', () => {
    upsertVerdict(base({ score: 30 }));
    upsertVerdict(base({ judge: 'vlm', score: 90, model: 'qwen3-vl-4b' }));
    upsertVerdict(base({ score: 50 }));
    expect(listVerdictHistory('items', 'sword', 'Economy', 'llm-panel').map((h) => h.score)).toEqual([30, 50]);
    expect(listVerdictHistory('items', 'sword', 'Economy', 'vlm').map((h) => h.score)).toEqual([90]);
    expect(listVerdictHistory('items', 'sword', 'Economy')).toHaveLength(3); // all classes when unfiltered
    expect(listVerdicts('items')).toHaveLength(2);  // one CURRENT row per judge class — unchanged
  });

  it('is BOUNDED: retention never exceeds the stated cap', () => {
    for (let i = 0; i < VERDICT_HISTORY_LIMIT + 12; i++) upsertVerdict(base({ score: i }));
    const history = listVerdictHistory('items', 'sword', 'Economy', 'llm-panel');
    expect(history).toHaveLength(VERDICT_HISTORY_LIMIT);
    // The window keeps the NEWEST judgments — the oldest are what get pruned.
    expect(history[history.length - 1].score).toBe(VERDICT_HISTORY_LIMIT + 11);
    expect(history[0].score).toBe(12);
    expect(listVerdicts('items')).toHaveLength(1);
  });

  it('round-trips the full verdict payload into history (dimensions, binding, rubric)', () => {
    upsertVerdict(base({ score: 64, dimensions: { clarity: 60, rigor: 68 }, contentHash: 'v2:abc', rubricVersion: 3, effort: 'high' }));
    const [h] = listVerdictHistory('items', 'sword', 'Economy', 'llm-panel');
    expect(h.dimensions).toEqual({ clarity: 60, rigor: 68 });
    expect(h.contentHash).toBe('v2:abc');
    expect(h.rubricVersion).toBe(3);
    expect(h.effort).toBe('high');
    expect(h.judgedAt).toBeTruthy();
  });

  it('stamps the current row and its newest history entry with the SAME timestamp', () => {
    upsertVerdict(base());
    const history = listVerdictHistory('items', 'sword', 'Economy', 'llm-panel');
    expect(history[history.length - 1].judgedAt).toBe(listVerdicts('items')[0].judgedAt);
  });
});

describe('ACCEPTANCE IS UNCHANGED by the history log', () => {
  it('bridgeJudgeVerdict sees exactly ONE applicable verdict per judge class after N re-judges', () => {
    for (const s of [10, 20, 30, 40]) upsertVerdict(base({ score: s, verdict: 'fail', findings: `run ${s}` }));
    upsertVerdict(base({ score: 88, verdict: 'pass', findings: 'fixed' }));

    const applicable = listVerdicts('items').filter((v) => v.judge === 'llm-panel');
    expect(applicable).toHaveLength(1);
    // The four superseded FAILs are in the log, and none of them reaches acceptance.
    expect(listVerdictHistory('items', 'sword', 'Economy', 'llm-panel').filter((h) => h.verdict === 'fail')).toHaveLength(4);
    expect(bridgeJudgeVerdict(CLEAN, applicable, 'llm-panel')).toEqual(CLEAN);
  });

  it('grades identically to a world where only the latest verdict was ever written', () => {
    // World A: the same step judged five times (history accumulates).
    for (const s of [90, 12, 70, 33, 25]) upsertVerdict(base({ score: s, verdict: s >= 60 ? 'pass' : 'fail', findings: `run ${s}` }));
    // Meaningful: five judgments are on record, and the one acceptance sees is the LATEST.
    expect(listVerdictHistory('items', 'sword', 'Economy', 'llm-panel')).toHaveLength(5);
    expect(listVerdicts('items')[0].score).toBe(25);
    const withHistory = bridgeJudgeVerdict(CLEAN, listVerdicts('items'), 'llm-panel');

    // World B: a fresh table holding only that last verdict.
    getDb().exec('DELETE FROM judge_verdicts; DELETE FROM judge_verdict_history;');
    upsertVerdict(base({ score: 25, verdict: 'fail', findings: 'run 25' }));
    const withoutHistory = bridgeJudgeVerdict(CLEAN, listVerdicts('items'), 'llm-panel');

    // Byte-for-byte the same acceptance result — the log is invisible to grading.
    expect(withHistory).toEqual(withoutHistory);
    expect(withHistory.judge?.score).toBe(25); // and it is the LATEST verdict that spoke
  });

  it('no acceptance module reads the history table', async () => {
    // Structural pin: the log is EVIDENCE. If a checker ever grades on it, the two surfaces can
    // diverge and "which verdict counts" gains a second definition.
    const fs = await import('node:fs/promises');
    const dir = 'src/lib/catalog/acceptance';
    for (const f of await fs.readdir(dir)) {
      if (!f.endsWith('.ts')) continue;
      const src = await fs.readFile(`${dir}/${f}`, 'utf8');
      expect(src.includes('listVerdictHistory'), `${f} must not read the judgment log`).toBe(false);
      expect(src.includes('judge_verdict_history'), `${f} must not read the judgment log`).toBe(false);
    }
  });
});
