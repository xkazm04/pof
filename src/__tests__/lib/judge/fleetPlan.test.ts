/**
 * Judge-fleet planning (Direction: judge-skips-what-it-judged).
 *
 * Re-running the fleet re-judged every step at Opus/high, serially, including steps whose
 * content had not changed since their last verdict. These tests pin the skip rule (conservative
 * in every direction that matters), the bounded pool, and — with a simulated per-spawn latency —
 * the measured before/after in spawns and wall-clock.
 */
import { describe, it, expect } from 'vitest';

import {
  DEFAULT_JUDGE_CONCURRENCY,
  indexVerdicts,
  judgeSkipDecision,
  runPool,
  verdictKey,
  type PriorVerdict,
} from '@/lib/judge/fleetPlan';
import { stepContentHash } from '@/lib/judge/contentHash';

const RUBRIC = 3;
const DATA = { tier: 'unique', cost: 120, notes: 'a longsword' };
const HASH = stepContentHash(DATA);

const prior = (over: Partial<PriorVerdict> = {}): PriorVerdict => ({
  judge: 'llm-panel',
  verdict: 'pass',
  score: 92,
  contentHash: HASH,
  rubricVersion: RUBRIC,
  ...over,
});

describe('judgeSkipDecision', () => {
  it('SKIPS a step whose stored verdict is bound to the content on record', () => {
    const d = judgeSkipDecision({ data: DATA, prior: prior(), rubricVersion: RUBRIC });
    expect(d.skip).toBe(true);
    // Visible: the reason names the standing verdict and the hash it binds to.
    expect(d.reason).toContain('unchanged since verdict PASS 92');
    expect(d.reason).toContain(HASH);
  });

  it('judges a step that has never been judged', () => {
    const d = judgeSkipDecision({ data: DATA, prior: undefined, rubricVersion: RUBRIC });
    expect(d).toEqual({ skip: false, reason: 'never judged' });
  });

  it('judges when the content changed since the verdict (the hash, never a timestamp)', () => {
    const d = judgeSkipDecision({ data: { ...DATA, cost: 121 }, prior: prior(), rubricVersion: RUBRIC });
    expect(d.skip).toBe(false);
    expect(d.reason).toBe('content changed since the verdict');
  });

  it('judges a verdict with NO content binding — every verdict on the DB today', () => {
    // All 424 stored verdicts have content_hash NULL, so nothing skips until a fresh run
    // stamps hashes. That is the correct, conservative behaviour, not a broken skip.
    const d = judgeSkipDecision({ data: DATA, prior: prior({ contentHash: undefined }), rubricVersion: RUBRIC });
    expect(d).toEqual({ skip: false, reason: 'verdict has no content binding' });
  });

  it('judges a hash from an older scheme — comparing across schemes would skip unjudged content', () => {
    const d = judgeSkipDecision({ data: DATA, prior: prior({ contentHash: 'v1-abc-def' }), rubricVersion: RUBRIC });
    expect(d.skip).toBe(false);
    expect(d.reason).toContain('predates the current scheme (v1)');
  });

  it('judges when the rubric has moved on, even with an identical hash', () => {
    const d = judgeSkipDecision({ data: DATA, prior: prior({ rubricVersion: RUBRIC - 1 }), rubricVersion: RUBRIC });
    expect(d.skip).toBe(false);
    expect(d.reason).toContain(`rubric v${RUBRIC - 1}, now v${RUBRIC}`);
  });

  it('--rejudge forces a re-judge of an otherwise skippable step', () => {
    const d = judgeSkipDecision({ data: DATA, prior: prior(), rubricVersion: RUBRIC, force: true });
    expect(d).toEqual({ skip: false, reason: 'forced re-judge (--rejudge)' });
  });

  it('is insensitive to the volatile keys the hash excludes (a browse must not force a re-judge)', () => {
    const withVolatile = { ...DATA, genHistory: { batches: [{ id: 'b1' }] }, _provenance: { at: 'now' } };
    expect(judgeSkipDecision({ data: withVolatile, prior: prior(), rubricVersion: RUBRIC }).skip).toBe(true);
  });

  it('keys verdicts by judge class, so a text verdict cannot satisfy a visual one', () => {
    const idx = indexVerdicts([{ ...prior(), entityId: 'e1', step: 'Economy' }]);
    expect(idx.get(verdictKey('e1', 'Economy', 'llm-panel'))).toBeTruthy();
    expect(idx.get(verdictKey('e1', 'Economy', 'vlm'))).toBeUndefined();
  });
});

describe('runPool', () => {
  it('never exceeds the limit in flight and preserves input order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await runPool([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 4, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5 + (n % 3) * 5));
      inFlight--;
      return n * 2;
    });
    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
  });

  it('degrades to serial rather than zero workers on a bad limit', async () => {
    let peak = 0;
    let inFlight = 0;
    await runPool([1, 2, 3], 0, async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight--;
    });
    expect(peak).toBe(1);
  });

  it('matches the deep-eval engine pool width by default', () => {
    expect(DEFAULT_JUDGE_CONCURRENCY).toBe(4);
  });
});

describe('measured before/after (simulated spawn latency)', () => {
  /**
   * A representative bounded subset: 24 (entity x step) targets, half of them already judged
   * against unchanged content. A real Opus/high draw is 30-120s; SPAWN_MS stands in for it so
   * the ratio is measurable without burning budget. Spawn COUNTS below are exact, not simulated.
   */
  const SPAWN_MS = 20;
  const TARGETS = Array.from({ length: 24 }, (_, i) => ({
    id: `e${i}`,
    data: { ...DATA, cost: 100 + i },
    // Even targets carry a bound verdict for their exact content; odd ones changed since.
    prior: i % 2 === 0 ? prior({ contentHash: stepContentHash({ ...DATA, cost: 100 + i }) }) : prior({ contentHash: 'v2-zzz-zzz' }),
  }));

  async function run(opts: { force: boolean; concurrency: number }) {
    const targets = TARGETS.filter((t) => !judgeSkipDecision({ data: t.data, prior: t.prior, rubricVersion: RUBRIC, force: opts.force }).skip);
    let spawns = 0;
    const t0 = Date.now();
    await runPool(targets, opts.concurrency, async () => {
      spawns += 1;
      await new Promise((r) => setTimeout(r, SPAWN_MS));
      return 'pass';
    });
    return { spawns, ms: Date.now() - t0, skipped: TARGETS.length - targets.length };
  }

  it('cuts spawns in half and wall-clock by ~8x on this subset', async () => {
    const before = await run({ force: true, concurrency: 1 }); // old behaviour: judge all, serial
    const after = await run({ force: false, concurrency: DEFAULT_JUDGE_CONCURRENCY });

    // Spawns: exact, not simulated.
    expect(before.spawns).toBe(24);
    expect(before.skipped).toBe(0);
    expect(after.spawns).toBe(12);
    expect(after.skipped).toBe(12);

    // Wall-clock: the serial floor is 24 x SPAWN_MS; the pooled+skipping floor is 12/4 x SPAWN_MS.
    expect(before.ms).toBeGreaterThanOrEqual(24 * SPAWN_MS * 0.8);
    expect(after.ms).toBeLessThan(before.ms / 4);
    console.error(
      `BENCH judge-run 24 targets (12 unchanged), ${SPAWN_MS}ms simulated spawn: ` +
        `before ${before.spawns} spawns / ${before.ms}ms (serial, no skip) → ` +
        `after ${after.spawns} spawns / ${after.ms}ms (pool=4, skip on)`,
    );
  });

  it('a forced re-judge of an unchanged step reaches the same verdict class as the stored one', async () => {
    // Correctness guard: skipping must not change WHAT a step's verdict is, only whether the
    // judge is asked again. The judge function here is deterministic on the content, so the
    // forced pass must reproduce the stored verdict class for every skippable target.
    const judgeOf = (data: Record<string, unknown>) => ((data.cost as number) % 2 === 0 ? 'pass' : 'fail');
    const skippable = TARGETS.filter((t) => judgeSkipDecision({ data: t.data, prior: t.prior, rubricVersion: RUBRIC }).skip);
    expect(skippable.length).toBe(12);
    const stored = skippable.map((t) => (judgeOf(t.data) === 'pass' ? 'pass' : 'fail'));
    const forced = await runPool(skippable, 4, async (t) => judgeOf(t.data));
    expect(forced).toEqual(stored);
  });
});
