// @vitest-environment node
/**
 * loopRemedy — a Tier-1 loop failure routes to the fix that was MEASURED to address it
 * (docs/research/motion-constraint-fix-path-spec.md, 2026-08-19), never to a guess.
 *
 * The plan is the measured recipe exactly: pin BOTH endpoints to frame 0's pose plus ONE
 * velocity-matched frame at T-2 (raw walk 141.8 mm fail -> velJump 15.73 mm warn). Two
 * measured traps live in the data as anti-entries: pinning only the last frame made the
 * seam worse (141.8 -> 153.5) and raising cfg_weight's constraint component bent the
 * motion instead of tightening the pin (15.73 -> 15.85 -> 18.39).
 */
import { describe, it, expect } from 'vitest';
import { scoreLoopClosure, type LoopMetrics } from '@/lib/motion-gate';
import { LOOP_REMEDIES, routeLoopRemedy, type LoopRemedyTable } from '@/lib/motion-gate/loopRemedy';

/** The raw seed-1 walk from the spec's measured table. */
const RAW_WALK: LoopMetrics = { poseGapMm: 141.8, worstJointMm: 381.01, velJumpMm: 25.94, rootTravelMm: 5645.6, frames: 80 };
const CTX = { frames: 80, seed: 1, prompt: 'a person walks forward' };

describe('routeLoopRemedy: a measured fail gets the measured fix', () => {
  it('fail on poseGap -> seam-pin, BOTH endpoints + velocity frame T-2, expected warn (not pass)', () => {
    const card = scoreLoopClosure(RAW_WALK);
    expect(card.verdict).toBe('fail');
    expect(card.worstAxis).toBe('poseGap');
    const plan = routeLoopRemedy(card, CTX);
    expect(plan).toMatchObject({
      remedy: 'seam-pin',
      pins: { fullbody: [0, 79], velocity: [78] },
      expected: 'warn',
      expectedAxis: 'velJump',
      seed: 1,
      prompt: 'a person walks forward',
      unaddressed: [],
    });
    if (plan.remedy !== 'seam-pin') throw new Error('unreachable');
    // Never the last frame alone, and never the unmeasured 4-frame set [0,1,78,79].
    expect(plan.pins.fullbody).toContain(0);
    expect(plan.pins.velocity).toEqual([78]);
    expect(plan.reason).toMatch(/warn/);
    expect(plan.reason).not.toMatch(/\bwill pass\b/);
  });

  it('the pins follow the clip length: a 40-frame clip pins [0,39] + [38]', () => {
    const card = scoreLoopClosure({ ...RAW_WALK, frames: 40 });
    const plan = routeLoopRemedy(card, { ...CTX, frames: 40 });
    expect(plan).toMatchObject({ remedy: 'seam-pin', pins: { fullbody: [0, 39], velocity: [38] } });
  });

  it('pass -> none (already loops); n/a -> none (one-shot); fail without a seed -> none (seed unknown)', () => {
    const clean = scoreLoopClosure({ poseGapMm: 1, worstJointMm: 2, velJumpMm: 3, rootTravelMm: 0, frames: 80 });
    expect(clean.verdict).toBe('pass');
    const p = routeLoopRemedy(clean, CTX);
    expect(p.remedy).toBe('none');
    expect(p.reason).toContain('already loops');

    const oneshot = scoreLoopClosure(RAW_WALK, 'oneshot');
    const o = routeLoopRemedy(oneshot, CTX);
    expect(o.remedy).toBe('none');
    expect(o.reason).toContain('one-shot');

    const s = routeLoopRemedy(scoreLoopClosure(RAW_WALK), { ...CTX, seed: undefined });
    expect(s.remedy).toBe('none');
    expect(s.reason).toContain('seed unknown');
  });

  it('refuses a plan it cannot place: under 4 frames or an empty prompt -> none with the reason', () => {
    const card = scoreLoopClosure(RAW_WALK);
    expect(routeLoopRemedy(card, { ...CTX, frames: 3 }).reason).toMatch(/frames/);
    expect(routeLoopRemedy(card, { ...CTX, prompt: '  ' }).reason).toMatch(/prompt/);
  });
});

describe('LOOP_REMEDIES: remedy -> classes as data, anti-entries kept', () => {
  it('seam-pin cures poseGap + worstJoint, only partially velJump, and carries both measured traps', () => {
    const seam = LOOP_REMEDIES.find((r) => r.remedy === 'seam-pin');
    expect(seam).toBeDefined();
    expect(seam!.cures).toEqual(['poseGap', 'worstJoint']);
    expect(seam!.partial).toEqual(['velJump']);
    const anti = seam!.antiEntries.map((a) => a.id);
    expect(anti).toEqual(['pin-last-only', 'raise cfg_weight constraint component']);
    expect(seam!.antiEntries[0].measured).toMatch(/141\.8.*153\.5/);
    expect(seam!.antiEntries[1].measured).toMatch(/15\.73.*18\.39/);
  });

  it('an axis no remedy names is returned in `unaddressed`, never silently mapped', () => {
    const table: LoopRemedyTable = [
      { ...LOOP_REMEDIES[0], cures: ['poseGap', 'worstJoint'], partial: [] },
    ];
    // velJump alone fails: no remedy in this table names it.
    const card = scoreLoopClosure({ poseGapMm: 1, worstJointMm: 2, velJumpMm: 90, rootTravelMm: 0, frames: 80 });
    expect(card.worstAxis).toBe('velJump');
    const plan = routeLoopRemedy(card, CTX, table);
    expect(plan.remedy).toBe('none');
    expect(plan.unaddressed).toEqual(['velJump']);
  });

  it('a velJump-only defect is not routed to a remedy that only partially addresses it', () => {
    const card = scoreLoopClosure({ poseGapMm: 1, worstJointMm: 2, velJumpMm: 30, rootTravelMm: 0, frames: 80 });
    const plan = routeLoopRemedy(card, CTX);
    expect(plan.remedy).toBe('none');
    expect(plan.reason).toMatch(/partial/);
    expect(plan.unaddressed).toEqual([]);
  });
});
