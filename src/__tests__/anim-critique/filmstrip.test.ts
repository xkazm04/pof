import { describe, it, expect } from 'vitest';
import { resolveFilmstrip, sampleFilmstrip } from '@/lib/anim-critique/filmstrip';

describe('resolveFilmstrip', () => {
  it('orders frame_NN numerically and drops side-cam + non-frames', () => {
    const r = resolveFilmstrip(['frame_00.png', 'frame_10.png', 'frame_02.png', 'frame_00_side.png', 'readme.txt']);
    expect(r).toEqual(['frame_00.png', 'frame_02.png', 'frame_10.png']);
  });

  it('handles shot_NN capture naming too', () => {
    expect(resolveFilmstrip(['shot_01.png', 'shot_00.png'])).toEqual(['shot_00.png', 'shot_01.png']);
  });

  it('selects the side camera when asked', () => {
    const r = resolveFilmstrip(['frame_00.png', 'frame_00_side.png', 'frame_01_side.png'], { cam: 'side' });
    expect(r).toEqual(['frame_00_side.png', 'frame_01_side.png']);
  });

  it('returns empty when nothing matches', () => {
    expect(resolveFilmstrip(['notes.txt', 'thumb.jpg'])).toEqual([]);
  });

  it('prefers frame_ over shot_ and never interleaves the two capture sources', () => {
    const r = resolveFilmstrip(['frame_00.png', 'shot_00.png', 'frame_01.png', 'shot_01.png']);
    expect(r).toEqual(['frame_00.png', 'frame_01.png']);
  });

  it('subsamples evenly to maxFrames, keeping the first and last', () => {
    const files = ['frame_00.png', 'frame_01.png', 'frame_02.png', 'frame_03.png', 'frame_04.png', 'frame_05.png'];
    const r = resolveFilmstrip(files, { maxFrames: 3 });
    expect(r).toHaveLength(3);
    expect(r[0]).toBe('frame_00.png');
    expect(r[2]).toBe('frame_05.png');
  });
});

describe('sampleFilmstrip reports the sampling as part of the instrument', () => {
  const files = (n: number) =>
    Array.from({ length: n }, (_, i) => `frame_${String(i).padStart(2, '0')}.png`);

  it('reports kept-of-available and a NON-uniform stride for the real 14 -> 10 case', () => {
    const s = sampleFilmstrip(files(14), { maxFrames: 10 });
    expect(s.frames).toHaveLength(10);
    expect(s.kept).toBe(10);
    expect(s.available).toBe(14);
    expect(s.uniform).toBe(false);
    expect(s.stride).toBeNull();
    expect(s.gaps).toEqual([1, 2]); // the sampler's own 1,2,1,2 rhythm, ascending distinct
  });

  it('reports a uniform stride when the subsample divides evenly', () => {
    const s = sampleFilmstrip(files(9), { maxFrames: 5 });
    expect(s.kept).toBe(5);
    expect(s.uniform).toBe(true);
    expect(s.stride).toBe(2);
  });

  it('a full strip is uniform with stride 1 and keeps every frame', () => {
    const s = sampleFilmstrip(files(6), { maxFrames: 20 });
    expect(s.frames).toEqual(files(6));
    expect(s.kept).toBe(6);
    expect(s.available).toBe(6);
    expect(s.uniform).toBe(true);
    expect(s.stride).toBe(1);
  });

  it('resolveFilmstrip still returns exactly the frames sampleFilmstrip keeps', () => {
    const opts = { maxFrames: 10 as const };
    expect(resolveFilmstrip(files(14), opts)).toEqual(sampleFilmstrip(files(14), opts).frames);
  });
});
