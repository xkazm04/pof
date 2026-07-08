import { describe, it, expect } from 'vitest';
import { buildRubricPrompt, parseJudgeResult, RUBRIC_VERSION, BANDS } from '@/lib/judge/rubrics';
import { DIMENSIONS, deliverableClassOf } from '@/lib/judge/dimensions';
import { bandOf, computeAgreement, type CalibrationTarget } from '@/lib/judge/calibration';

describe('strict rubric (WS2)', () => {
  it('rubric version is the strict era (>= 2)', () => {
    expect(RUBRIC_VERSION).toBeGreaterThanOrEqual(2);
  });

  it('prompt embeds the strictness contract, the anchors, and every dimension', () => {
    const p = buildRubricPrompt('2d-art', { subject: 'items :: Icon 2D Art', payload: 'an image' });
    expect(p).toMatch(/LEAD REVIEWER/);
    expect(p).toMatch(/Default to a LOWER score/);
    expect(p).toMatch(/Path of Exile 2/);
    for (const d of DIMENSIONS['2d-art']) expect(p).toContain(d.key);
    expect(p).toMatch(/verdict/); // output contract present
  });

  it('gates pass on the shippable band', () => {
    const p = buildRubricPrompt('text-config', { subject: 's', payload: 'x' });
    expect(p).toContain(String(BANDS.shippable));
  });

  it('parses a well-formed verdict and clamps the score', () => {
    const r = parseJudgeResult('noise {"dimensions":{"silhouette":40},"score":120,"verdict":"fail","findings":"generic blob, no material read","fix":"add value hierarchy"} trailing');
    expect(r).not.toBeNull();
    expect(r!.score).toBe(100);
    expect(r!.verdict).toBe('fail');
    expect(r!.fix).toMatch(/value hierarchy/);
  });

  it('rejects unparseable / malformed output', () => {
    expect(parseJudgeResult('the asset looks fine to me')).toBeNull();
    expect(parseJudgeResult('{"score":50}')).toBeNull(); // no verdict
  });

  it('maps deliverables to rubric classes', () => {
    expect(deliverableClassOf('2d-art')).toBe('2d-art');
    expect(deliverableClassOf('audio')).toBe('audio');
    expect(deliverableClassOf('unknown')).toBeNull();
  });
});

describe('calibration (WS2)', () => {
  it('bands split at the agreed thresholds', () => {
    expect(bandOf(95)).toBe('shippable');
    expect(bandOf(90)).toBe('shippable');
    expect(bandOf(80)).toBe('placeholder');
    expect(bandOf(69)).toBe('fail');
  });

  it('computes agreement on band, not raw score', () => {
    const targets: CalibrationTarget[] = [
      { catalogId: 'c', entityId: 'e', step: 'A', label: 'fail' },
      { catalogId: 'c', entityId: 'e', step: 'B', label: 'shippable' },
      { catalogId: 'c', entityId: 'e', step: 'C', label: 'placeholder' }, // unscored → ignored
    ];
    const scores = { 'c::e::A': 30, 'c::e::B': 60 }; // B: human shippable, judge fail → disagree
    const r = computeAgreement(targets, scores);
    expect(r.scored).toBe(2);
    expect(r.agreed).toBe(1);
    expect(r.rate).toBe(0.5);
    expect(r.disagreements[0].key).toBe('c::e::B');
  });
});
