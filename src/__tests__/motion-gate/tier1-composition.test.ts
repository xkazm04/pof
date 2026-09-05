/**
 * Tier-1 (numeric loop closure) composed BEFORE the Tier-2 vision pass.
 *
 * Until this file existed, `src/lib/motion-gate/` was imported by exactly one thing — its
 * own test. Its header claimed it "Runs BEFORE the Tier-2 VLM aesthetic pass", a claim no
 * code made true: a clip measured at 141.8 mm of pose gap (a walk that provably does not
 * loop) still cost a filmstrip render plus a paid vision call, and could come back `pass`
 * from six dimensions none of which is a loop check.
 *
 * Two rules from ai-registry `game-production/motion-quality-gating` are pinned here:
 *  - "three questions, and they do not average" — integrity (Tier-1) and craft (Tier-2)
 *    are reported side by side, each with its own basis; neither is folded into the other.
 *  - "never manufacture a number to complete a report" — a gate that did not run reads as
 *    `not-run`, and an unmeasurable one (`n/a`, `error`) is never rendered as a pass.
 */
import { describe, it, expect, vi } from 'vitest';
import { parseLoopMetrics, scoreLoopClosure, type LoopMetrics } from '@/lib/motion-gate';
import { resolveTier1, tier1Blocks, TIER1_NOT_RUN } from '@/lib/anim-critique/tier1';
import { critiqueAnimation } from '@/lib/anim-critique/critique';

const CLEAN: LoopMetrics = { poseGapMm: 3.2, worstJointMm: 8.1, velJumpMm: 4.0, rootTravelMm: 2100, frames: 90 };
/** The measured raw-ARDY walk: 141.8 mm of RMS pose gap — it does not loop. */
const BROKEN: LoopMetrics = { poseGapMm: 141.8, worstJointMm: 260, velJumpMm: 90, rootTravelMm: 2100, frames: 90 };

const CARD = JSON.stringify({
  dimensions: { anticipation: 80, weight: 80, timing: 80, followThrough: 80, silhouette: 80, believability: 80 },
  reasons: ['clear windup'],
  topFix: 'nothing major',
});
const fakeRead = async () => Buffer.from('PNGDATA');
const CTX = { name: 'AM_Walk_Fwd', intent: 'looping forward walk cycle', frameCount: 3 };

function markers(over: Record<string, number | string> = {}): string {
  const base: Record<string, number | string> = {
    POSE_GAP_MM: 3.2, WORST_JOINT_MM: 8.1, VEL_JUMP_MM: 4.0, ROOT_TRAVEL_MM: 2100, FRAMES: 90,
  };
  return Object.entries({ ...base, ...over }).map(([k, v]) => `POF_LOOP_${k}=${v}`).join('\n');
}

describe('parseLoopMetrics surfaces the extractor’s own diagnosis', () => {
  it('returns POF_LOOP_ERROR verbatim instead of the generic missing-marker message', () => {
    const line = "POF_LOOP_ERROR=missing key 'posed_joints' (have: a,b)";
    const r = parseLoopMetrics(line);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("missing key 'posed_joints' (have: a,b)");
    expect(r.error).not.toMatch(/missing loop marker/);
  });

  it('still reports genuinely absent markers when the extractor said nothing at all', () => {
    const r = parseLoopMetrics('some unrelated log line\n');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/missing loop marker/);
  });
});

describe('resolveTier1', () => {
  it('reads the extractor’s marker text and scores it', () => {
    const r = resolveTier1({ markers: markers() });
    expect(r.status).toBe('pass');
    expect(r.card?.metrics.poseGapMm).toBe(3.2);
    expect(r.basis).toMatch(/integrity/i);
  });

  it('reports a broken extractor run as `error` with the verbatim cause — never as a pass', () => {
    const r = resolveTier1({ markers: "POF_LOOP_ERROR=missing key 'posed_joints' (have: a,b)" });
    expect(r.status).toBe('error');
    expect(r.error).toBe("missing key 'posed_joints' (have: a,b)");
    expect(tier1Blocks(r)).toBe(false); // an un-run gate does not gate; it also does not pass
  });

  it('reports NOT RUN when no Tier-1 input was supplied', () => {
    expect(resolveTier1().status).toBe('not-run');
    expect(resolveTier1({}).status).toBe('not-run');
    expect(TIER1_NOT_RUN.reason).toMatch(/not a pass/i);
  });

  it('passes a one-shot clip through as n/a and never as a pass', () => {
    const r = resolveTier1({ markers: markers({ POSE_GAP_MM: 900 }), intent: 'oneshot' });
    expect(r.status).toBe('n/a');
    expect(tier1Blocks(r)).toBe(false);
  });

  it('blocks only on a measured fail', () => {
    expect(tier1Blocks(resolveTier1({ card: scoreLoopClosure(BROKEN) }))).toBe(true);
    expect(tier1Blocks(resolveTier1({ card: scoreLoopClosure(CLEAN) }))).toBe(false);
  });
});

describe('critiqueAnimation composes Tier-1 before the vision call', () => {
  it('a Tier-1 fail returns the numeric card and NEVER calls the vision seam', async () => {
    const callVision = vi.fn(async () => CARD);
    const r = await critiqueAnimation(['a.png', 'b.png'], CTX, {
      callVision, readFile: fakeRead, tier1: { card: scoreLoopClosure(BROKEN) },
    });
    expect(callVision).toHaveBeenCalledTimes(0);
    expect(r.ok).toBe(true);
    expect(r.gated).toBe(true);
    expect(r.card).toBeUndefined();
    expect(r.tier1.status).toBe('fail');
    expect(r.tier1.card?.metrics.poseGapMm).toBe(141.8);
    expect(r.tier1.card?.worstAxis).toBeTruthy();
    // Craft was not measured — it must say so, not inherit the integrity verdict.
    expect(r.tier2.status).toBe('not-run');
    expect(r.tier2.basis).toMatch(/craft/i);
  });

  it('a Tier-1 n/a (one-shot) does not gate — craft is still judged, integrity stays n/a', async () => {
    const callVision = vi.fn(async () => CARD);
    const r = await critiqueAnimation(['a.png'], CTX, {
      callVision, readFile: fakeRead, tier1: { markers: markers({ POSE_GAP_MM: 900 }), intent: 'oneshot' },
    });
    expect(callVision).toHaveBeenCalledTimes(1);
    expect(r.tier1.status).toBe('n/a');
    expect(r.card?.verdict).toBe('pass');
    expect(r.tier2.status).toBe('ran');
  });

  it('a Tier-1 warn does not gate', async () => {
    const callVision = vi.fn(async () => CARD);
    const r = await critiqueAnimation(['a.png'], CTX, {
      callVision, readFile: fakeRead, tier1: { markers: markers({ POSE_GAP_MM: 25 }) },
    });
    expect(r.tier1.status).toBe('warn');
    expect(callVision).toHaveBeenCalledTimes(1);
  });

  it('with NO Tier-1 input the Tier-2 card is exactly what it was, and Tier-1 reads NOT RUN', async () => {
    const callVision = vi.fn(async () => CARD);
    const r = await critiqueAnimation(['a.png', 'b.png', 'c.png'], CTX, { callVision, readFile: fakeRead });
    expect(callVision).toHaveBeenCalledTimes(1);
    expect(r.ok).toBe(true);
    expect(r.card).toEqual({
      verdict: 'pass',
      score: 80,
      worstDimension: 'anticipation',
      worstScore: 80,
      reason: expect.any(String),
      dimensions: { anticipation: 80, weight: 80, timing: 80, followThrough: 80, silhouette: 80, believability: 80 },
      reasons: ['clear windup'],
      topFix: 'nothing major',
    });
    expect(r.tier1.status).toBe('not-run');
    expect(r.tier1.card).toBeUndefined();
  });
});
