import { describe, it, expect, vi } from 'vitest';
import { critiqueAnimation } from '@/lib/anim-critique/critique';

const CTX = { name: 'AM_SwordSlashC', intent: 'overhead two-handed sword slash', frameCount: 3 };
const STIFF = JSON.stringify({
  dimensions: { anticipation: 15, weight: 20, timing: 40, followThrough: 10, silhouette: 45, believability: 20 },
  reasons: ['no windup before the strike', 'blade stops dead'],
  topFix: 'add a pull-back anticipation pose',
});
const fakeRead = async () => Buffer.from('PNGDATA');

describe('critiqueAnimation', () => {
  it('reads the frames, judges them, and returns a scored card', async () => {
    let seen: { images: unknown[]; prompt: string } | undefined;
    const callVision = vi.fn(async (images: unknown[], prompt: string) => { seen = { images, prompt }; return STIFF; });
    const r = await critiqueAnimation(['a.png', 'b.png', 'c.png'], CTX, { callVision, readFile: fakeRead });
    expect(r.ok).toBe(true);
    expect(r.card?.verdict).toBe('fail');
    expect(r.card?.score).toBe(25); // (15+20+40+10+45+20)/6 = 25
    expect(r.card?.topFix).toBe('add a pull-back anticipation pose');
    expect(r.card?.reasons).toHaveLength(2);
    expect(seen?.images).toHaveLength(3); // the whole filmstrip went to the model
    expect(seen?.prompt).toContain('overhead two-handed sword slash');
  });

  it('surfaces an error when the model output cannot be parsed', async () => {
    const r = await critiqueAnimation(['a.png'], CTX, { callVision: async () => 'looks fine to me', readFile: fakeRead });
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('errors when no frames are provided', async () => {
    const r = await critiqueAnimation([], CTX, { callVision: async () => STIFF, readFile: fakeRead });
    expect(r.ok).toBe(false);
  });

  it('surfaces a model/transport error instead of throwing', async () => {
    const r = await critiqueAnimation(['a.png'], CTX, {
      callVision: async () => { throw new Error('GEMINI_API_KEY not set'); },
      readFile: fakeRead,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toContain('GEMINI_API_KEY');
  });
});
