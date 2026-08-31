import { describe, it, expect } from 'vitest';
import {
  SEVERITY_MAX,
  FAIL_SEVERITY,
  buildViewCritiquePrompt,
  parseViewCritiqueReply,
  scoreViewGate,
  critiqueMeshViews,
  type ViewVerdict,
} from '@/lib/visual-gen/view-critique';
import type { RenderedView } from '@/lib/visual-gen/mesh-views';

const view = (index: number, yawDeg: number): RenderedView => ({
  index, yawDeg, imagePath: `C:/v/view_0${index}.png`,
});

const verdict = (index: number, severity: number, defects: string[] = []): ViewVerdict => ({
  index, yawDeg: index * 90, imagePath: `C:/v/view_0${index}.png`, severity, defects,
});

describe('buildViewCritiquePrompt', () => {
  it('tells the model which side of the asset it is looking at', () => {
    const p = buildViewCritiquePrompt({ viewIndex: 2, yawDeg: 180, totalViews: 4 });
    expect(p).toMatch(/180/);
    expect(p).toMatch(/back|rear|behind|opposite/i);
  });

  it('calls the front view the front', () => {
    expect(buildViewCritiquePrompt({ viewIndex: 0, yawDeg: 0, totalViews: 4 })).toMatch(/front/i);
  });

  it('rules the RENDER out of scope so lighting is not reported as a mesh defect', () => {
    const p = buildViewCritiquePrompt({ viewIndex: 1, yawDeg: 90, totalViews: 4 });
    expect(p).toMatch(/lighting|background|render/i);
    expect(p).toMatch(/not|ignore|do not/i);
  });

  it('exempts an untextured surface — most generator output arrives untextured', () => {
    // Live control 2026-08-31: a clean subdivided Suzanne was failed at severity 3 for
    // "flat untextured or blank areas". Being untextured is a normal state, not a defect.
    const p = buildViewCritiquePrompt({ viewIndex: 0, yawDeg: 0, totalViews: 3 });
    expect(p).toMatch(/untextured|flat colour|flat color|single colour|single color/i);
    expect(p).toMatch(/not a defect|is normal|do not report/i);
  });

  it('does not ask whether the asset is IDENTIFIABLE from this angle', () => {
    // The same control failed for "shape that does not read as the subject from this
    // angle" — which the back of a chair, or the back of a head, never does. Asking that
    // question guarantees a failure on every non-front view.
    const p = buildViewCritiquePrompt({ viewIndex: 2, yawDeg: 180, totalViews: 3 });
    expect(p).not.toMatch(/does not read as the subject from this angle/i);
    expect(p).toMatch(/back|side/i);
    expect(p).toMatch(/less detail|little detail|legitimately|expected/i);
  });

  it('names the subject when one is known, so "wrong shape" is judgeable', () => {
    expect(buildViewCritiquePrompt({ viewIndex: 0, yawDeg: 0, totalViews: 4, subject: 'a wooden crate' }))
      .toMatch(/wooden crate/);
  });

  it('demands the one-line marker protocol', () => {
    const p = buildViewCritiquePrompt({ viewIndex: 0, yawDeg: 0, totalViews: 4 });
    expect(p).toMatch(/DEFECTS=/);
    expect(p).toMatch(/SEVERITY=/);
  });
});

describe('parseViewCritiqueReply', () => {
  it('reads defects and severity off the marker line', () => {
    const r = parseViewCritiqueReply('DEFECTS=smeared texture, missing geometry; SEVERITY=3');
    expect(r.ok).toBe(true);
    expect(r.defects).toEqual(['smeared texture', 'missing geometry']);
    expect(r.severity).toBe(3);
  });

  it('reads a clean view as zero defects, not as unparseable', () => {
    const r = parseViewCritiqueReply('DEFECTS=none; SEVERITY=0');
    expect(r.ok).toBe(true);
    expect(r.defects).toEqual([]);
    expect(r.severity).toBe(0);
  });

  it('survives the model wrapping its answer in prose', () => {
    const r = parseViewCritiqueReply('Looking at this view I can see issues.\nDEFECTS=hole in the mesh; SEVERITY=2\nHope that helps!');
    expect(r.ok).toBe(true);
    expect(r.severity).toBe(2);
  });

  it('rejects a reply with no marker instead of inventing a clean verdict', () => {
    const r = parseViewCritiqueReply('The mesh looks fine to me.');
    expect(r.ok).toBe(false);
    expect(r.error).toBeTruthy();
  });

  it('clamps a severity the model pushed out of range', () => {
    expect(parseViewCritiqueReply('DEFECTS=x; SEVERITY=9').severity).toBe(SEVERITY_MAX);
    expect(parseViewCritiqueReply('DEFECTS=x; SEVERITY=-4').severity).toBe(0);
  });

  it('rejects a non-numeric severity rather than defaulting it to clean', () => {
    const r = parseViewCritiqueReply('DEFECTS=x; SEVERITY=bad');
    expect(r.ok).toBe(false);
  });
});

describe('scoreViewGate — the worst view decides', () => {
  it('fails the mesh when a single view is bad, however good the others are', () => {
    // The whole point: 3 clean views must not average away a broken back.
    const g = scoreViewGate([verdict(0, 0), verdict(1, 0), verdict(2, 3, ['smeared face']), verdict(3, 0)]);
    expect(g.verdict).toBe('fail');
    expect(g.worst!.index).toBe(2);
    expect(g.reason).toMatch(/smeared face/);
  });

  it('names the yaw of the failing view so the defect is findable', () => {
    const g = scoreViewGate([verdict(0, 0), verdict(2, 3, ['hole'])]);
    expect(g.reason).toMatch(/180/);
    expect(g.worst!.imagePath).toBe('C:/v/view_02.png');
  });

  it('passes when every view is clean or merely blemished', () => {
    expect(scoreViewGate([verdict(0, 1, ['slight seam']), verdict(1, 0)]).verdict).toBe('pass');
  });

  it('condemns on any single SEVERE view', () => {
    expect(scoreViewGate([verdict(0, 0), verdict(1, SEVERITY_MAX, ['hole'])]).verdict).toBe('fail');
  });

  it('warns — does not condemn — on ONE moderate view among clean ones', () => {
    // Calibrated on a live control 2026-08-31: a known-good Suzanne scored [2,0,0], and a
    // single moderate view is the observed false-positive mode. Real defects showed either
    // a severe view or a PATTERN of moderate ones.
    const g = scoreViewGate([verdict(0, FAIL_SEVERITY, ['fused parts']), verdict(1, 0), verdict(2, 0)]);
    expect(g.verdict).toBe('warn');
    expect(g.reason).toMatch(/one|single|corrobor/i);
    expect(g.worst!.severity).toBe(FAIL_SEVERITY);
  });

  it('condemns when moderate damage repeats across views', () => {
    // saber_hilt.glb, live: [2,2,2] — corroborated, so it is the mesh, not the angle.
    const g = scoreViewGate([verdict(0, 2, ['ragged']), verdict(1, 2, ['ragged']), verdict(2, 2, ['fused'])]);
    expect(g.verdict).toBe('fail');
  });

  it('is unmeasured — never pass — when there are no views at all', () => {
    const g = scoreViewGate([]);
    expect(g.verdict).toBe('unmeasured');
    expect(g.reason).toBeTruthy();
  });
});

describe('critiqueMeshViews', () => {
  const images = { readImage: async () => ({ base64: 'AAA', mime: 'image/png' }) };

  it('judges every rendered view', async () => {
    const seen: string[] = [];
    const g = await critiqueMeshViews([view(0, 0), view(1, 90)], {
      ...images,
      vision: async (imgs, prompt) => { seen.push(prompt); return 'DEFECTS=none; SEVERITY=0'; },
    });
    expect(seen).toHaveLength(2);
    expect(g.verdict).toBe('pass');
    expect(g.views).toHaveLength(2);
  });

  it('catches the broken back face a structural gate cannot see', async () => {
    const g = await critiqueMeshViews([view(0, 0), view(2, 180)], {
      ...images,
      vision: async (_i, prompt) =>
        /180/.test(prompt) ? 'DEFECTS=flat smeared texture, no detail; SEVERITY=3' : 'DEFECTS=none; SEVERITY=0',
    });
    expect(g.verdict).toBe('fail');
    expect(g.worst!.yawDeg).toBe(180);
  });

  it('reports unmeasured when a view could not be judged — a gap is not a pass', async () => {
    const g = await critiqueMeshViews([view(0, 0), view(1, 90)], {
      ...images,
      vision: async (_i, prompt) => (/90/.test(prompt) ? 'I cannot tell.' : 'DEFECTS=none; SEVERITY=0'),
    });
    expect(g.verdict).toBe('unmeasured');
    expect(g.reason).toMatch(/1 of 2|could not/i);
  });

  it('still fails when an unjudgeable view sits beside a clearly broken one', async () => {
    // A defect that WAS seen outranks a gap in coverage — the mesh is already condemned.
    const g = await critiqueMeshViews([view(0, 0), view(2, 180)], {
      ...images,
      vision: async (_i, prompt) => (/180/.test(prompt) ? 'DEFECTS=hole; SEVERITY=3' : 'no idea'),
    });
    expect(g.verdict).toBe('fail');
  });

  it('reports unmeasured when the vision call throws', async () => {
    const g = await critiqueMeshViews([view(0, 0)], {
      ...images,
      vision: async () => { throw new Error('quota exhausted'); },
    });
    expect(g.verdict).toBe('unmeasured');
    expect(g.reason).toMatch(/quota/);
  });

  it('is unmeasured with no views rather than silently clean', async () => {
    const g = await critiqueMeshViews([], { ...images, vision: async () => 'DEFECTS=none; SEVERITY=0' });
    expect(g.verdict).toBe('unmeasured');
  });
});
