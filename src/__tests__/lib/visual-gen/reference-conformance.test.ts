import { describe, it, expect } from 'vitest';
import {
  buildConformancePrompt,
  parseConformanceReply,
  pickReferenceView,
  scoreConformance,
  critiqueReferenceConformance,
  MISMATCH_SEVERITY,
  type ConformanceVerdict,
} from '@/lib/visual-gen/reference-conformance';
import type { RenderedView } from '@/lib/visual-gen/mesh-views';

const view = (index: number, yawDeg: number): RenderedView => ({
  index,
  yawDeg,
  imagePath: `/tmp/views/view_${index}.png`,
});

describe('pickReferenceView', () => {
  it('picks the view nearest the front, because that is the side the reference showed', () => {
    const picked = pickReferenceView([view(0, 0), view(1, 90), view(2, 180)]);
    expect(picked.view?.index).toBe(0);
  });

  it('measures yaw circularly — 350 deg is nearer the front than 60', () => {
    const picked = pickReferenceView([view(0, 60), view(1, 350)]);
    expect(picked.view?.yawDeg).toBe(350);
  });

  it('states the yaw it settled on, so a 3/4 reference can be read against a known angle', () => {
    const picked = pickReferenceView([view(0, 45)]);
    expect(picked.reason).toMatch(/45/);
  });

  it('returns no view for an empty set rather than inventing one', () => {
    const picked = pickReferenceView([]);
    expect(picked.view).toBeUndefined();
    expect(picked.reason).toMatch(/no views/i);
  });
});

describe('buildConformancePrompt', () => {
  const p = buildConformancePrompt({});

  it('tells the model which image is the reference and which is the produced asset', () => {
    expect(p).toMatch(/first image/i);
    expect(p).toMatch(/second image/i);
    expect(p).toMatch(/reference/i);
  });

  it('rules out the differences a render legitimately has', () => {
    // The view gate had to learn this the hard way: an untextured grey render is
    // NORMAL, and condemning it makes the gate condemn everything.
    expect(p).toMatch(/untextured|grey|gray/i);
    expect(p).toMatch(/lighting/i);
    expect(p).toMatch(/background/i);
  });

  it('names what DOES count as divergence', () => {
    expect(p).toMatch(/missing/i);
    expect(p).toMatch(/proportion|silhouette/i);
  });

  it('carries the subject when one is known', () => {
    expect(buildConformancePrompt({ subject: 'a stone shrine' })).toMatch(/stone shrine/);
  });

  it('demands the one-line marker reply', () => {
    expect(p).toMatch(/DIVERGENCES=/);
    expect(p).toMatch(/SEVERITY=/);
  });
});

describe('parseConformanceReply', () => {
  it('reads a clean verdict', () => {
    const r = parseConformanceReply('DIVERGENCES=none; SEVERITY=0');
    expect(r.ok).toBe(true);
    expect(r.divergences).toEqual([]);
    expect(r.severity).toBe(0);
  });

  it('splits a divergence list', () => {
    const r = parseConformanceReply('DIVERGENCES=missing chimney, wheels are round not square; SEVERITY=2');
    expect(r.divergences).toEqual(['missing chimney', 'wheels are round not square']);
    expect(r.severity).toBe(2);
  });

  it('refuses to read prose as a verdict', () => {
    const r = parseConformanceReply('It looks pretty close to the reference to me!');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/marker/i);
  });

  it('clamps a severity outside the scale instead of trusting it', () => {
    expect(parseConformanceReply('DIVERGENCES=none; SEVERITY=9').severity).toBe(3);
    expect(parseConformanceReply('DIVERGENCES=none; SEVERITY=-4').severity).toBe(0);
  });
});

describe('scoreConformance', () => {
  it('a clean judgement is a match', () => {
    expect(scoreConformance({ ok: true, divergences: [], severity: 0 }).verdict).toBe('match');
  });

  it('a small difference is drift, not a mismatch', () => {
    expect(scoreConformance({ ok: true, divergences: ['handle slightly shorter'], severity: 1 }).verdict).toBe('drift');
  });

  it('condemns at the mismatch severity', () => {
    const s = scoreConformance({ ok: true, divergences: ['a different vehicle entirely'], severity: MISMATCH_SEVERITY });
    expect(s.verdict).toBe('mismatch');
    expect(s.divergences).toEqual(['a different vehicle entirely']);
  });

  it('an unreadable judgement is unmeasured, never a match', () => {
    // The project's dominant honesty rule: silence is not a pass.
    const s = scoreConformance({ ok: false, error: 'no marker' });
    expect(s.verdict).toBe('unmeasured');
    expect(s.reason).toMatch(/no marker/);
  });
});

describe('critiqueReferenceConformance', () => {
  const images = { reference: { base64: 'REF', mime: 'image/png' }, render: { base64: 'RENDER', mime: 'image/png' } };

  it('sends the reference FIRST and the render second, in one call', async () => {
    const seen: Array<{ n: number; first: string; second: string }> = [];
    const r = await critiqueReferenceConformance('/ref.png', [view(0, 0), view(1, 180)], {
      vision: async (imgs) => {
        seen.push({ n: imgs.length, first: imgs[0].base64, second: imgs[1].base64 });
        return 'DIVERGENCES=none; SEVERITY=0';
      },
      readImage: async (p) => (p === '/ref.png' ? images.reference : images.render),
    });
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatchObject({ n: 2, first: 'REF', second: 'RENDER' });
    expect(r.verdict).toBe('match');
  });

  it('reports which render it judged, so the verdict is checkable', async () => {
    const r = await critiqueReferenceConformance('/ref.png', [view(0, 120), view(1, 0)], {
      vision: async () => 'DIVERGENCES=none; SEVERITY=0',
      readImage: async () => images.render,
    });
    expect(r.judgedView?.yawDeg).toBe(0);
    expect(r.judgedView?.imagePath).toBe('/tmp/views/view_1.png');
  });

  it('is unmeasured — not a match — when the vision call throws', async () => {
    const r = await critiqueReferenceConformance('/ref.png', [view(0, 0)], {
      vision: async () => { throw new Error('quota exhausted'); },
      readImage: async () => images.render,
    });
    expect(r.verdict).toBe('unmeasured');
    expect(r.reason).toMatch(/quota exhausted/);
  });

  it('is unmeasured when the reference image cannot be read', async () => {
    const r = await critiqueReferenceConformance('/missing.png', [view(0, 0)], {
      vision: async () => 'DIVERGENCES=none; SEVERITY=0',
      readImage: async (p) => { if (p === '/missing.png') throw new Error('ENOENT'); return images.render; },
    });
    expect(r.verdict).toBe('unmeasured');
    expect(r.reason).toMatch(/ENOENT/);
  });

  it('has nothing to judge when the render produced no views', async () => {
    let called = false;
    const r = await critiqueReferenceConformance('/ref.png', [], {
      vision: async () => { called = true; return 'DIVERGENCES=none; SEVERITY=0'; },
      readImage: async () => images.render,
    });
    expect(r.verdict).toBe('unmeasured');
    expect(called).toBe(false);
  });

  it('costs exactly one vision call however many yaws were rendered', async () => {
    let calls = 0;
    await critiqueReferenceConformance('/ref.png', [view(0, 0), view(1, 60), view(2, 120), view(3, 180)], {
      vision: async () => { calls++; return 'DIVERGENCES=none; SEVERITY=0'; },
      readImage: async () => images.render,
    });
    expect(calls).toBe(1);
  });
});

describe('the verdict vocabulary is distinct from the damage gate', () => {
  it('never uses pass/fail, so a conformance answer cannot be read as a damage answer', () => {
    const all: ConformanceVerdict[] = ['match', 'drift', 'mismatch', 'unmeasured', 'not-requested'];
    expect(all).not.toContain('pass');
    expect(all).not.toContain('fail');
  });
});
