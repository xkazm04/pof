import { describe, it, expect } from 'vitest';
import { resolveFilmstrip } from '@/lib/anim-critique/filmstrip';

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
