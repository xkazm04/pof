/**
 * POST /api/verify/animation — the route had NO test at all.
 *
 * It caps the filmstrip at 10 frames and used to subsample the rest away silently, so the
 * judge was asked to score TIMING ("even, metronomic spacing reads robotic", "cite frames
 * 2-3 jump with no in-between") on a strip whose spacing the sampler had itself made
 * uneven — for a 14-frame capture the kept gaps are 1,2,1,2,1,2,1,2,1. Neither the response
 * nor the CLI said how many frames existed. "The sampling is part of the instrument."
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CARD = JSON.stringify({
  dimensions: { anticipation: 80, weight: 80, timing: 80, followThrough: 80, silhouette: 80, believability: 80 },
  reasons: ['clear windup'],
  topFix: 'nothing major',
});

const seen = vi.hoisted(() => ({ prompts: [] as string[], images: [] as number[] }));

const stubSeam = () => async (images: { base64: string; mime: string }[], prompt: string) => {
  seen.prompts.push(prompt);
  seen.images.push(images.length);
  return { text: CARD, model: 'qwen3.8-27b', attribution: 'answered' as const, fellBackFrom: ['qwen3.7-flash'] };
};

vi.mock('@/lib/anim-critique/qwen', () => ({ makeQwenVisionAttributed: () => stubSeam() }));
vi.mock('@/lib/anim-critique/gemini', () => ({ makeGeminiVisionAttributed: () => stubSeam() }));

const { POST } = await import('@/app/api/verify/animation/route');
const { buildCritiquePrompt } = await import('@/lib/anim-critique/prompt');

let dir: string;

function makeDir(frames: number): string {
  const d = mkdtempSync(join(tmpdir(), 'lot-a-anim-'));
  for (let i = 0; i < frames; i++) {
    writeFileSync(join(d, `frame_${String(i).padStart(2, '0')}.png`), Buffer.from(`PNG${i}`));
  }
  return d;
}

function post(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/verify/animation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function data(body: unknown) {
  const res = await POST(post(body));
  const env = await res.json();
  expect(env.success).toBe(true);
  return env.data;
}

beforeAll(() => { dir = makeDir(14); });
afterAll(() => { rmSync(dir, { recursive: true, force: true }); });

const BASE = { name: 'AM_SwordSlashC', intent: 'overhead two-handed sword slash', provider: 'qwen' };

describe('POST /api/verify/animation — sampling honesty', () => {
  it('reports kept-of-available and that the strip is NOT evenly spaced', async () => {
    seen.prompts.length = 0;
    const d = await data({ ...BASE, frameDir: dir });
    expect(d.frames).toHaveLength(10);
    expect(d.sampled).toMatchObject({ kept: 10, available: 14, uniform: false });
  });

  it('tells the judge the strip was sampled, and not to score dropped in-betweens as a timing defect', async () => {
    seen.prompts.length = 0;
    await data({ ...BASE, frameDir: dir });
    const p = seen.prompts[0];
    expect(p).toMatch(/10 of the 14/);
    expect(p.toLowerCase()).toContain('sampl');
    expect(p.toLowerCase()).toMatch(/not.*(timing|defect)/);
    expect(p).toMatch(/not uniform|uneven|1-2/i);
  });

  it('a full-strip request is byte-identical to the unsampled prompt and reports uniform', async () => {
    seen.prompts.length = 0;
    const d = await data({ ...BASE, frameDir: dir, maxFrames: 40 });
    expect(d.frames).toHaveLength(14);
    expect(d.sampled).toMatchObject({ kept: 14, available: 14, uniform: true });
    expect(seen.prompts[0]).toBe(
      buildCritiquePrompt({ name: BASE.name, intent: BASE.intent, frameCount: 14 }),
    );
  });

  it('says available/uniform are UNKNOWN when the caller supplied the paths itself', async () => {
    const d = await data({ ...BASE, framePaths: [join(dir, 'frame_00.png'), join(dir, 'frame_05.png')] });
    expect(d.sampled.kept).toBe(2);
    expect(d.sampled.available).toBeNull();
    expect(d.sampled.uniform).toBeNull();
  });

  it('names the model that answered, and the fallback trail, beside the requested provider', async () => {
    const d = await data({ ...BASE, frameDir: dir });
    expect(d.provider).toBe('qwen');
    expect(d.vision).toMatchObject({ model: 'qwen3.8-27b', fellBackFrom: ['qwen3.7-flash'] });
  });

  it('carries the capping dimension of the verdict', async () => {
    const d = await data({ ...BASE, frameDir: dir });
    expect(d.verdict).toBe('pass');
    expect(d.worstDimension).toBeTruthy();
  });

  it('400s without name/intent and 404s on a missing frameDir', async () => {
    const bad = await POST(post({ frameDir: dir }));
    expect(bad.status).toBe(400);
    const missing = await POST(post({ ...BASE, frameDir: join(dir, 'nope') }));
    expect(missing.status).toBe(404);
  });
});

/**
 * Tier-1 composed into the route: the numeric loop gate runs BEFORE the paid vision call,
 * and its verdict is reported BESIDE the Tier-2 craft card — each with its own basis,
 * never merged into one number ("three questions, and they do not average").
 */
function loopMarkers(over: Record<string, number | string> = {}): string {
  const base: Record<string, number | string> = {
    POSE_GAP_MM: 3.2, WORST_JOINT_MM: 8.1, VEL_JUMP_MM: 4.0, ROOT_TRAVEL_MM: 2100, FRAMES: 90,
  };
  return Object.entries({ ...base, ...over }).map(([k, v]) => `POF_LOOP_${k}=${v}`).join('\n');
}

describe('POST /api/verify/animation — Tier-1 integrity gate', () => {
  it('reports Tier-1 as NOT RUN when the caller supplied no loop markers', async () => {
    const d = await data({ ...BASE, frameDir: dir });
    expect(d.tier1.status).toBe('not-run');
    expect(d.tier1.basis).toMatch(/integrity/i);
    expect(d.tier2.status).toBe('ran');
    expect(d.verdict).toBe('pass'); // the Tier-2 card is untouched
  });

  it('a clip that does not loop is gated: no vision call, and craft reads NOT RUN', async () => {
    seen.prompts.length = 0;
    const d = await data({
      ...BASE, frameDir: dir,
      loopMarkers: loopMarkers({ POSE_GAP_MM: 141.8, WORST_JOINT_MM: 260, VEL_JUMP_MM: 90 }),
    });
    expect(seen.prompts).toHaveLength(0); // the paid pass never happened
    expect(d.gated).toBe(true);
    expect(d.tier1.status).toBe('fail');
    expect(d.tier1.card.metrics.poseGapMm).toBe(141.8);
    expect(d.tier2.status).toBe('not-run');
    expect(d.verdict).toBeUndefined(); // no craft verdict was measured, so none is reported
  });

  it('a one-shot clip reports Tier-1 n/a and still gets the craft card', async () => {
    seen.prompts.length = 0;
    const d = await data({
      ...BASE, frameDir: dir, loopIntent: 'oneshot', loopMarkers: loopMarkers({ POSE_GAP_MM: 900 }),
    });
    expect(d.tier1.status).toBe('n/a');
    expect(seen.prompts).toHaveLength(1);
    expect(d.verdict).toBe('pass');
  });

  it('a broken extractor run is reported verbatim as `error`, never as a pass', async () => {
    const d = await data({
      ...BASE, frameDir: dir, loopMarkers: "POF_LOOP_ERROR=missing key 'posed_joints' (have: a,b)",
    });
    expect(d.tier1.status).toBe('error');
    expect(d.tier1.error).toBe("missing key 'posed_joints' (have: a,b)");
    expect(d.tier2.status).toBe('ran');
  });
});
