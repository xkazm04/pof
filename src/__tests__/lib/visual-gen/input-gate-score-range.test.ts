import { describe, it, expect } from 'vitest';
import { parseGateReply, gateInputImage, summarizeInputGate, inputGateRefusal } from '@/lib/visual-gen/input-gate';

const IMG = { mime: 'image/png', base64: 'AAAA' };

describe('input gate — a SCORE outside the 0-10 protocol is not a verdict', () => {
  it('refuses to parse a score above 10 (a grader answering on a 0-100 scale)', () => {
    const r = parseGateReply('SCORE=40; DEFECTS=cluttered background, two subjects; VERDICT=poor input.');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/0-10/);
  });

  it('still parses an in-range score, including the 10 ceiling', () => {
    expect(parseGateReply('SCORE=10; DEFECTS=none; VERDICT=clean.')).toMatchObject({ ok: true, score: 10 });
    expect(parseGateReply('SCORE=0; DEFECTS=blank; VERDICT=empty.')).toMatchObject({ ok: true, score: 0 });
  });

  it('a 40/100 reply leaves the gate unavailable instead of PASSING the image to paid generation', async () => {
    const card = await gateInputImage(IMG, {
      vision: async () => 'SCORE=40; DEFECTS=cluttered background; VERDICT=poor input.',
    });
    expect(card.ok).toBe(false);
    const outcome = summarizeInputGate(card);
    expect(outcome.ran).toBe(false);
    expect(inputGateRefusal(outcome)).toBeNull();
  });
});
