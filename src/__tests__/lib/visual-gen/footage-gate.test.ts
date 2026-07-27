import { describe, it, expect, vi } from 'vitest';
import {
  buildFootageGatePrompt,
  parseFfprobeDuration,
  buildFfprobeArgs,
  buildFfmpegSampleArgs,
  gateFootage,
} from '@/lib/visual-gen/footage-gate';
import type { VisionImage } from '@/lib/anim-critique/critique';

const FRAME: VisionImage = { mime: 'image/png', base64: 'aGVsbG8=' };
const sample = vi.fn(async () => [FRAME, FRAME, FRAME]);

describe('buildFootageGatePrompt', () => {
  it('names fused feet as the body-solve disqualifier and tolerates blob hands', () => {
    const p = buildFootageGatePrompt('body');
    expect(p).toMatch(/f(ee|oo)t/i);
    expect(p).toMatch(/fuse|merge/i);
    expect(p).toMatch(/disqualif|foot contact|root motion/i);
    expect(p).toMatch(/hands?/i);
    expect(p).toMatch(/finger|do not solve|don't solve|not fail/i);
    expect(p).toMatch(/mocap|markerless|motion capture/i);
  });

  it('adds face criteria only for a face purpose', () => {
    expect(buildFootageGatePrompt('body')).not.toMatch(/facial landmark/i);
    expect(buildFootageGatePrompt('body+face')).toMatch(/face|facial/i);
  });

  it('demands the one-line SCORE/DEFECTS/VERDICT protocol', () => {
    const p = buildFootageGatePrompt();
    expect(p).toMatch(/SCORE=<0-10/);
    expect(p).toMatch(/DEFECTS=/);
    expect(p).toMatch(/VERDICT=/);
  });
});

describe('ffprobe/ffmpeg pure cores', () => {
  it('parses an ffprobe duration line', () => {
    expect(parseFfprobeDuration('4.833333\n')).toBeCloseTo(4.833, 2);
    expect(parseFfprobeDuration('garbage')).toBeNull();
    expect(parseFfprobeDuration('')).toBeNull();
    expect(parseFfprobeDuration('0.0')).toBeNull();
  });

  it('builds ffprobe args that emit a bare duration', () => {
    const args = buildFfprobeArgs('C:/clips/dance.mp4');
    expect(args).toContain('C:/clips/dance.mp4');
    expect(args.join(' ')).toMatch(/format=duration/);
  });

  it('builds ffmpeg args that sample N frames evenly across the duration', () => {
    const args = buildFfmpegSampleArgs('in.mp4', 'out/frame_%02d.png', 8, 4.8);
    const joined = args.join(' ');
    expect(args).toContain('in.mp4');
    expect(args).toContain('out/frame_%02d.png');
    expect(joined).toMatch(/fps=/);
    expect(joined).toMatch(/-frames:v 8/);
  });
});

describe('gateFootage', () => {
  it('passes clean footage through sample → vision → scorecard', async () => {
    const vision = vi.fn(async (images: VisionImage[]) =>
      images.length ? 'SCORE=8; DEFECTS=none; VERDICT=trackable full-body clip' : 'SCORE=0; DEFECTS=empty; VERDICT=no frames');
    const card = await gateFootage('clip.mp4', { sample, vision });
    expect(card.ok).toBe(true);
    if (card.ok) {
      expect(card.verdict).toBe('pass');
      expect(card.score).toBe(80);
      expect(card.frames).toBe(3);
    }
    // the sampled frames reached the vision seam
    expect(vision.mock.calls[0][0]).toHaveLength(3);
  });

  it('fails footage with fused feet and surfaces the defects as reasons', async () => {
    const vision = vi.fn(async () => 'SCORE=3; DEFECTS=feet fuse into one mass frames 4-8, hands blob; VERDICT=unsuitable for body solve');
    const card = await gateFootage('clip.mp4', { sample, vision });
    expect(card.ok).toBe(true);
    if (card.ok) {
      expect(card.verdict).toBe('fail');
      expect(card.reasons.join(' ')).toMatch(/feet fuse/);
    }
  });

  it('reports a vision failure as ok:false with the reason — never a fake verdict', async () => {
    const vision = vi.fn(async () => { throw new Error('QWEN_API_KEY not set'); });
    const card = await gateFootage('clip.mp4', { sample, vision });
    expect(card.ok).toBe(false);
    if (!card.ok) expect(card.error).toMatch(/QWEN_API_KEY/);
  });

  it('reports a sampling failure (missing ffmpeg / unreadable clip) as ok:false', async () => {
    const badSample = vi.fn(async () => { throw new Error('ffmpeg exited 1: No such file'); });
    const vision = vi.fn(async () => 'SCORE=9; DEFECTS=none; VERDICT=ok');
    const card = await gateFootage('missing.mp4', { sample: badSample, vision });
    expect(card.ok).toBe(false);
    if (!card.ok) expect(card.error).toMatch(/ffmpeg/);
    expect(vision).not.toHaveBeenCalled();
  });

  it('reports an unparseable vision reply as ok:false with the raw text kept', async () => {
    const vision = vi.fn(async () => 'I cannot rate this video, sorry.');
    const card = await gateFootage('clip.mp4', { sample, vision });
    expect(card.ok).toBe(false);
    if (!card.ok) expect(card.raw).toMatch(/cannot rate/);
  });

  it('reports zero sampled frames as ok:false instead of judging nothing', async () => {
    const emptySample = vi.fn(async () => []);
    const vision = vi.fn(async () => 'SCORE=9; DEFECTS=none; VERDICT=ok');
    const card = await gateFootage('clip.mp4', { sample: emptySample, vision });
    expect(card.ok).toBe(false);
    expect(vision).not.toHaveBeenCalled();
  });
});
