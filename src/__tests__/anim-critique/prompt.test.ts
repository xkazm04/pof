import { describe, it, expect } from 'vitest';
import { buildCritiquePrompt } from '@/lib/anim-critique/prompt';

const CTX = {
  name: 'AM_SwordSlashC',
  intent: 'a 1.2s overhead two-handed sword slash; should read as a weighty, decisive strike',
  frameCount: 6,
  durationSeconds: 1.2,
};

describe('buildCritiquePrompt', () => {
  it('states the motion intent verbatim', () => {
    expect(buildCritiquePrompt(CTX)).toContain('weighty, decisive strike');
  });

  it('tells the judge it is looking at a frame sequence and how many frames', () => {
    const p = buildCritiquePrompt(CTX);
    expect(p).toMatch(/6\s+frames/i);
  });

  it('asks for all six scoring dimensions', () => {
    const p = buildCritiquePrompt(CTX);
    for (const d of ['anticipation', 'weight', 'timing', 'followThrough', 'silhouette', 'believability']) {
      expect(p).toContain(d);
    }
  });

  it('instructs to judge against professional standards and NOT grade on a curve', () => {
    const p = buildCritiquePrompt(CTX).toLowerCase();
    expect(p).toContain('professional');
    expect(p).toMatch(/do not grade on a curve|not relative|absolute/);
  });

  it('demands a JSON-only response with reasons and topFix', () => {
    const p = buildCritiquePrompt(CTX);
    expect(p).toMatch(/only.*json/i);
    expect(p).toContain('reasons');
    expect(p).toContain('topFix');
  });
});

describe('buildCritiquePrompt states the sampling', () => {
  const SAMPLED = {
    ...CTX,
    frameCount: 10,
    sampling: { kept: 10, available: 14, uniform: false, stride: null, gaps: [1, 2] },
  };

  it('says how many of the captured frames the judge is actually seeing', () => {
    expect(buildCritiquePrompt(SAMPLED)).toMatch(/10 of the 14/);
  });

  it('warns that the strip is not evenly spaced and names the gaps', () => {
    const p = buildCritiquePrompt(SAMPLED);
    expect(p).toMatch(/not uniform|uneven/i);
    expect(p).toMatch(/1-2|1 and 2/);
  });

  it('forbids scoring a dropped in-between as a timing defect', () => {
    const p = buildCritiquePrompt(SAMPLED).toLowerCase();
    expect(p).toMatch(/dropped|sampler/);
    expect(p).toMatch(/do not.*(timing|penali|defect)/);
  });

  it('is byte-identical to the old prompt when the whole strip is shown', () => {
    const full = { ...CTX, sampling: { kept: 6, available: 6, uniform: true, stride: 1, gaps: [1] } };
    expect(buildCritiquePrompt(full)).toBe(buildCritiquePrompt(CTX));
  });
});
