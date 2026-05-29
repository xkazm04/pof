import { describe, it, expect } from 'vitest';
import { makeObservation, makeVerdict, type Observation } from '@/lib/observation/types';

describe('observation contract', () => {
  it('makeObservation stamps kind + capturedAt + data', () => {
    const o = makeObservation('state', { sampleCount: 11 }, { capturedAt: '2026-05-29T00:00:00Z' });
    expect(o.kind).toBe('state');
    expect(o.data).toEqual({ sampleCount: 11 });
    expect(o.capturedAt).toBe('2026-05-29T00:00:00Z');
  });

  it('makeVerdict carries evidence + reason and defaults status', () => {
    const ev: Observation = makeObservation('pose', { isRefPose: true }, { capturedAt: 't' });
    const v = makeVerdict('intent-1', 'T3', 'fail', [ev], 'Speed>0 but pose==refpose');
    expect(v.status).toBe('fail');
    expect(v.evidence).toHaveLength(1);
    expect(v.reason).toMatch(/refpose/);
  });
});
