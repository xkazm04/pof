import { describe, it, expect } from 'vitest';
import {
  buildInputGatePrompt,
  parseGateReply,
  scoreInputGate,
  parseVisionImage,
  gateInputImage,
  thresholdsFor,
  GRADER_THRESHOLDS,
} from '@/lib/visual-gen/input-gate';

const PNG_URL = `data:image/png;base64,${Buffer.from('fake-png').toString('base64')}`;

describe('buildInputGatePrompt', () => {
  it('encodes the image→3D input criteria and the exact one-line reply format', () => {
    const p = buildInputGatePrompt('warrior');
    expect(p).toMatch(/warrior/);
    expect(p).toMatch(/single subject|one subject|exactly one/i);
    expect(p).toMatch(/background/i);
    expect(p).toMatch(/A-?pose|canonical|limbs uncrossed/i);
    expect(p).toMatch(/occlu/i);
    expect(p).toMatch(/SCORE=[\s\S]*DEFECTS=[\s\S]*VERDICT=/);
  });
});

describe('parseGateReply', () => {
  it('parses the happy one-line protocol', () => {
    const r = parseGateReply('SCORE=8; DEFECTS=none; VERDICT=Clean A-pose concept on white.');
    expect(r.ok).toBe(true);
    expect(r.score).toBe(8);
    expect(r.defects).toEqual([]);
    expect(r.verdict).toMatch(/Clean A-pose/);
  });

  it('parses defects into a list and tolerates surrounding chatter/fences', () => {
    const r = parseGateReply('```\nSure!\nSCORE=4; DEFECTS=busy background, crossed arms; VERDICT=Needs a cleaner input.\n```');
    expect(r.ok).toBe(true);
    expect(r.score).toBe(4);
    expect(r.defects).toEqual(['busy background', 'crossed arms']);
  });

  it('fails without a SCORE marker', () => {
    const r = parseGateReply('I cannot judge this image.');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/SCORE/i);
  });
});

describe('scoreInputGate', () => {
  it('maps score to pass/warn/fail on the gap-loop thresholds (pass ≥7, fail <5)', () => {
    expect(scoreInputGate({ ok: true, score: 8, defects: [], verdict: 'good' }).verdict).toBe('pass');
    expect(scoreInputGate({ ok: true, score: 6, defects: ['soft occlusion'], verdict: 'meh' }).verdict).toBe('warn');
    expect(scoreInputGate({ ok: true, score: 3, defects: ['busy background'], verdict: 'bad' }).verdict).toBe('fail');
  });

  it('carries defects into reasons so failures are actionable (Rule 4)', () => {
    const card = scoreInputGate({ ok: true, score: 4, defects: ['busy background', 'crossed arms'], verdict: 'v' });
    expect(card.reasons).toEqual(expect.arrayContaining(['busy background', 'crossed arms']));
  });
});

describe('parseVisionImage', () => {
  it('splits a data URL into mime + base64', () => {
    expect(parseVisionImage(PNG_URL)).toEqual({ mime: 'image/png', base64: Buffer.from('fake-png').toString('base64') });
  });

  it('rejects non-image or malformed data URLs', () => {
    expect(parseVisionImage('data:text/plain;base64,aGk=')).toBeNull();
    expect(parseVisionImage('not a data url')).toBeNull();
  });
});

describe('gateInputImage (injected vision seam)', () => {
  it('runs the vision seam and returns a scored card', async () => {
    const card = await gateInputImage(
      { mime: 'image/png', base64: 'x' },
      { vision: async () => 'SCORE=9; DEFECTS=none; VERDICT=Ideal mesher input.', subject: 'chair' },
    );
    if (!card.ok) throw new Error(`expected ok card, got: ${card.error}`);
    expect(card.verdict).toBe('pass');
    expect(card.score).toBe(90); // VLM 0-10 scaled to the shared Scorecard 0-100 range
  });

  it('reports a vision failure as ok:false with the reason (never a fake verdict)', async () => {
    const card = await gateInputImage(
      { mime: 'image/png', base64: 'x' },
      { vision: async () => { throw new Error('QWEN_API_KEY not set'); } },
    );
    if (card.ok) throw new Error('expected a failure card');
    expect(card.error).toMatch(/QWEN_API_KEY/);
    expect(card.verdict).toBeUndefined();
  });

  it('reports an unparseable reply as ok:false with the raw text preserved', async () => {
    const card = await gateInputImage(
      { mime: 'image/png', base64: 'x' },
      { vision: async () => 'gibberish' },
    );
    if (card.ok) throw new Error('expected a failure card');
    expect(card.raw).toBe('gibberish');
  });
});

describe('thresholdsFor (a threshold is fitted to its grader)', () => {
  it("uses the answering model's refitted row when one exists", () => {
    const { thresholds, source } = thresholdsFor('qwen3.8:27b');
    expect(source).toBe('grader');
    expect(thresholds).toEqual(GRADER_THRESHOLDS['qwen3.8:27b']);
  });

  it('falls back to the default line for an unmeasured or unreported model', () => {
    expect(thresholdsFor('some-new-vl:7b')).toEqual({ thresholds: { passAt: 7, failBelow: 5 }, source: 'default' });
    expect(thresholdsFor(undefined).source).toBe('default');
  });

  it('lets an explicit caller override win, layered over the grader row', () => {
    const { thresholds, source } = thresholdsFor('qwen3.8:27b', { passAt: 10 });
    expect(source).toBe('caller');
    expect(thresholds).toEqual({ ...GRADER_THRESHOLDS['qwen3.8:27b'], passAt: 10 });
  });
});

describe("gateInputImage grades on the answering model's line", () => {
  const answer = (text: string, model: string) => async () => ({ text, model, attribution: 'answered' as const, fellBackFrom: [] });

  it('refuses a local-27B score that the default line would only warn on', async () => {
    const reply = 'SCORE=6; DEFECTS=dark gradient backdrop; VERDICT=Emblem on a dark field.';
    const local = await gateInputImage({ mime: 'image/png', base64: 'x' }, { vision: answer(reply, 'qwen3.8:27b') });
    const unattributed = await gateInputImage({ mime: 'image/png', base64: 'x' }, { vision: async () => reply });
    if (!local.ok || !unattributed.ok) throw new Error('expected ok cards');
    expect(local.verdict).toBe('fail');
    expect(local.model).toBe('qwen3.8:27b');
    expect(local.thresholdsFrom).toBe('grader');
    expect(unattributed.verdict).toBe('warn');
    expect(unattributed.thresholdsFrom).toBe('default');
  });

  it('still passes a clean input from the same model', async () => {
    const card = await gateInputImage({ mime: 'image/png', base64: 'x' },
      { vision: answer('SCORE=10; DEFECTS=none; VERDICT=Ideal.', 'qwen3.8:27b') });
    if (!card.ok) throw new Error('expected ok card');
    expect(card.verdict).toBe('pass');
  });
});
