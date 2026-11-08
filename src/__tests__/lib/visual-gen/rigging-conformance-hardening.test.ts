import { describe, it, expect } from 'vitest';
import {
  parseConformanceReply,
  scoreConformance,
} from '@/lib/visual-gen/reference-conformance';

describe('reference conformance: a reply outside the scale is not a verdict', () => {
  it('refuses a severity below the scale rather than reading it as a match', () => {
    const reply = parseConformanceReply('DIVERGENCES=none; SEVERITY=-1');
    expect(reply.ok).toBe(false);
    expect(scoreConformance(reply).verdict).toBe('unmeasured');
  });

  it('still reads every value on the scale', () => {
    for (const s of [0, 1, 2, 3]) {
      expect(parseConformanceReply(`DIVERGENCES=none; SEVERITY=${s}`).severity).toBe(s);
    }
  });
});
