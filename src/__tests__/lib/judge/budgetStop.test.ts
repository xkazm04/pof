/**
 * Budget stop behaviour (Direction: judge-budget-stops-inflight).
 *
 * The fleet's budget gate halted only workers that had NOT yet been scheduled, so a stop
 * overshot by up to the pool width (4 concurrent Opus/high spawns) — and the run's closing line
 * printed a bare total that read as if the ceiling had held. These tests pin the deliberate
 * behaviour: DRAIN (never kill) what is in flight, start nothing new — including the 2nd/3rd
 * draw of a `--median 3` step — and report the actual spend against the ceiling with the
 * overshoot and any unmeasured spawns named.
 */
import { describe, it, expect } from 'vitest';
import { runDrainPool, DEFAULT_JUDGE_CONCURRENCY } from '@/lib/judge/fleetPlan';
import { judgeSpendCeiling, summarizeJudgeSpend, type JudgeSpendTotals } from '@/lib/judge/spendMeter';

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('runDrainPool — a stop halts scheduling and drains what is in flight', () => {
  it('starts nothing new after the stop, lets the in-flight draws finish, and reports the width', async () => {
    let stop = false;
    const settled: number[] = [];
    const started: number[] = [];
    // 8 items, 3 workers. Item 0 trips the stop quickly; items 1 and 2 are still running when
    // it does — MORE THAN ONE draw in flight, which is the whole failure mode.
    const pool = await runDrainPool([0, 1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      started.push(n);
      await tick(n === 0 ? 5 : 40);
      if (n === 0) stop = true;
      settled.push(n);
      return n;
    }, { stopRequested: () => stop });

    expect(pool.stopped).toBe(true);
    // Only the three claimed before the stop ever ran.
    expect(started.sort()).toEqual([0, 1, 2]);
    // And every one of them ran to COMPLETION — draining, not killing.
    expect(settled.sort()).toEqual([0, 1, 2]);
    expect(pool.started).toBe(3);
    expect(pool.unstarted).toBe(5);
    // The overshoot width: two draws were mid-flight when the stop was first observed.
    expect(pool.drainedAtStop).toBe(2);
    // Results stay input-ordered; never-started items are null, not silently dropped.
    expect(pool.results).toEqual([0, 1, 2, null, null, null, null, null]);
  });

  it('without a stop it runs everything in input order, bounded by the limit', async () => {
    let peak = 0, inFlight = 0;
    const pool = await runDrainPool([1, 2, 3, 4, 5, 6], 3, async (n) => {
      inFlight++; peak = Math.max(peak, inFlight);
      await tick(5);
      inFlight--;
      return n * 2;
    }, { stopRequested: () => false });
    expect(pool.results).toEqual([2, 4, 6, 8, 10, 12]);
    expect(pool.stopped).toBe(false);
    expect(pool.drainedAtStop).toBe(0);
    expect(pool.unstarted).toBe(0);
    expect(peak).toBeLessThanOrEqual(3);
  });

  it('a stop that is already tripped spawns nothing at all', async () => {
    let ran = 0;
    const pool = await runDrainPool([1, 2, 3], DEFAULT_JUDGE_CONCURRENCY, async () => { ran++; return 1; }, { stopRequested: () => true });
    expect(ran).toBe(0);
    expect(pool.started).toBe(0);
    expect(pool.unstarted).toBe(3);
    expect(pool.drainedAtStop).toBe(0);
  });
});

describe('judgeSpendCeiling', () => {
  it('is the tighter of the configured remainders', () => {
    expect(judgeSpendCeiling({ dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: 4, monthlyRemainingUsd: 30 })).toBe(4);
    expect(judgeSpendCeiling({ dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: null, monthlyRemainingUsd: 30 })).toBe(30);
  });

  it('is null when no budget is configured — never a fake $0 ceiling', () => {
    expect(judgeSpendCeiling(null)).toBeNull();
    expect(judgeSpendCeiling({ dailyExceeded: false, monthlyExceeded: false, dailyRemainingUsd: null, monthlyRemainingUsd: null })).toBeNull();
  });

  it('an already-blown budget is a ceiling of zero, not a negative allowance', () => {
    expect(judgeSpendCeiling({ dailyExceeded: true, monthlyExceeded: false, dailyRemainingUsd: -3, monthlyRemainingUsd: 10 })).toBe(0);
  });
});

describe('summarizeJudgeSpend — the closing line cannot imply the ceiling held', () => {
  const totals = (over: Partial<JudgeSpendTotals> = {}): JudgeSpendTotals => ({ costUsd: 6, spawns: 6, unknownCost: 0, ...over });

  it('states spend against the ceiling and names the overshoot after a stop', () => {
    const r = summarizeJudgeSpend({
      totals: totals(),
      ceilingUsd: 5,
      atStop: { costUsd: 4, spawns: 4, unknownCost: 0 },
      drainedAtStop: 2,
      stopReason: 'budget guardrail refused judge-visual',
    });
    expect(r.overshootUsd).toBe(2);
    expect(r.overshootSpawns).toBe(2);
    expect(r.exceededCeiling).toBe(true);
    const text = r.lines.join('\n');
    expect(text).toContain('$5.00 ceiling');
    expect(text).toContain('CEILING EXCEEDED by $1.00');
    expect(text).toContain('$2.00 was spent AFTER it across 2 spawn(s)');
    expect(text).toContain('drained, not killed');
    expect(text).toContain('budget guardrail refused judge-visual');
  });

  it('says outright when there was no ceiling to hold', () => {
    const r = summarizeJudgeSpend({ totals: totals(), ceilingUsd: null });
    expect(r.exceededCeiling).toBe(false);
    expect(r.lines.join('\n')).toContain('no budget configured, so this run had no ceiling to hold');
    expect(r.lines.join('\n')).not.toContain('AFTER it');
  });

  it('an unmeasured spawn makes the total a FLOOR, and the line says so', () => {
    const r = summarizeJudgeSpend({ totals: totals({ unknownCost: 2 }), ceilingUsd: 20 });
    expect(r.totalIsFloor).toBe(true);
    const text = r.lines.join('\n');
    expect(text).toContain('2 spawn(s) reported no cost');
    expect(text).toContain('unmeasured, not free');
    expect(text).toContain('FLOOR');
  });

  it('a stop with nothing in flight says that rather than claiming a drain', () => {
    const r = summarizeJudgeSpend({ totals: totals({ costUsd: 4, spawns: 4 }), ceilingUsd: 5, atStop: { costUsd: 4, spawns: 4, unknownCost: 0 }, drainedAtStop: 0 });
    expect(r.overshootUsd).toBe(0);
    expect(r.lines.join('\n')).toContain('no draw was in flight when it tripped');
  });
});

describe('the reported total is truthful when the gate trips mid-flight', () => {
  /**
   * A faithful miniature of the harness: a spend ledger, a stop that snapshots it, the pool's
   * drain policy, and the per-step median loop that must not START a further draw after a stop.
   * Each simulated draw costs $1, so "what was reported" and "what was actually drawn" are
   * directly comparable.
   */
  async function fleet(opts: { median: number; concurrency: number; stopAfterDraws: number; honourStopBetweenDraws: boolean }) {
    const spend: JudgeSpendTotals = { costUsd: 0, spawns: 0, unknownCost: 0 };
    let budgetStop: string | null = null;
    let atStop: JudgeSpendTotals | null = null;
    let realDraws = 0;

    const stopRun = (reason: string) => {
      if (budgetStop) return;
      budgetStop = reason;
      atStop = { ...spend };
    };
    const draw = async (unmeasured: boolean) => {
      realDraws++;
      await tick(10);
      spend.spawns += 1;
      // An unparseable CLI envelope: recorded, cost unknown — counted, never treated as free.
      if (unmeasured) spend.unknownCost += 1; else spend.costUsd += 1;
      if (realDraws >= opts.stopAfterDraws) stopRun('budget guardrail refused judge-visual');
    };

    const targets = [0, 1, 2, 3, 4, 5, 6, 7];
    const pool = await runDrainPool(targets, opts.concurrency, async (t) => {
      for (let i = 0; i < opts.median; i++) {
        if (i > 0 && opts.honourStopBetweenDraws && budgetStop) break;
        await draw(t === 1 && i === 0); // one step's first draw reports no cost
      }
      return t;
    }, { stopRequested: () => budgetStop !== null });

    const report = summarizeJudgeSpend({ totals: spend, ceilingUsd: 3, atStop, drainedAtStop: pool.drainedAtStop, stopReason: budgetStop });
    return { spend, report, pool, realDraws };
  }

  it('reports every draw that actually happened, including the drained ones', async () => {
    const { spend, report, pool, realDraws } = await fleet({ median: 1, concurrency: 4, stopAfterDraws: 1, honourStopBetweenDraws: true });
    // Every spawn that ran is in the ledger: nothing is lost by stopping.
    expect(spend.spawns).toBe(realDraws);
    expect(report.spawns).toBe(realDraws);
    // 4 workers were mid-flight when the 1st draw tripped the gate, so 4 draws happened.
    expect(realDraws).toBe(4);
    expect(pool.drainedAtStop).toBe(3);
    expect(pool.unstarted).toBe(4);
    // Three spawns landed after the stop; only $2 of them could be measured, because one of the
    // drained spawns reported no cost. The report states BOTH numbers rather than the tidier one.
    expect(report.overshootSpawns).toBe(3);
    expect(report.overshootUsd).toBe(2);
    // The measured $3 lands exactly ON the $3 ceiling — so nothing "exceeded" it arithmetically,
    // and yet an unmeasured spawn means staying within budget cannot be claimed. That is exactly
    // what the FLOOR line is for: the total is a lower bound, not a measurement.
    expect(report.exceededCeiling).toBe(false);
    expect(spend.unknownCost).toBe(1);
    expect(report.totalIsFloor).toBe(true);
    expect(report.lines.join('\n')).toContain('unmeasured, not free');
    expect(report.lines.join('\n')).toContain('FLOOR');
  });

  it('honouring the stop between draws is what bounds the overshoot (measured)', async () => {
    const bounded = await fleet({ median: 3, concurrency: 4, stopAfterDraws: 1, honourStopBetweenDraws: true });
    const unbounded = await fleet({ median: 3, concurrency: 4, stopAfterDraws: 1, honourStopBetweenDraws: false });
    // Old behaviour: the stop only halted scheduling, so each in-flight step still took its full
    // median — 4 workers x 3 draws. New behaviour: one draw per in-flight worker.
    expect(unbounded.realDraws).toBe(12);
    expect(bounded.realDraws).toBe(4);
    expect(bounded.report.overshootSpawns).toBeLessThan(unbounded.report.overshootSpawns);
    // Both are reported truthfully — the fix bounds the overshoot, it does not hide it.
    expect(unbounded.report.spawns).toBe(unbounded.realDraws);
    expect(bounded.report.spawns).toBe(bounded.realDraws);
  });
});
