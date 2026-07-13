import { describe, it, expect } from 'vitest';
import {
  buildStyleDnaPrompt,
  parseStyleDnaReply,
  styleDnaToPromptFragment,
  distillStyleDna,
  type StyleDna,
} from '@/lib/visual-gen/style-dna';

const REPLY =
  'PALETTE=desaturated teal, rust orange, bone white; MATERIALS=aged brass, cracked porcelain; ' +
  'MOOD=melancholic, whimsical-macabre; RENDER=painterly, soft rim light; MOTIFS=clockwork, playing cards';

const DNA: StyleDna = {
  palette: ['desaturated teal', 'rust orange', 'bone white'],
  materials: ['aged brass', 'cracked porcelain'],
  mood: ['melancholic', 'whimsical-macabre'],
  render: ['painterly', 'soft rim light'],
  motifs: ['clockwork', 'playing cards'],
};

describe('buildStyleDnaPrompt', () => {
  it('asks for the five style dimensions in the one-line marker protocol', () => {
    const p = buildStyleDnaPrompt(4);
    expect(p).toMatch(/4 images|four images|mood board/i);
    expect(p).toMatch(/PALETTE=[\s\S]*MATERIALS=[\s\S]*MOOD=[\s\S]*RENDER=[\s\S]*MOTIFS=/);
    expect(p).toMatch(/comma/i);
  });
});

describe('parseStyleDnaReply', () => {
  it('parses all five dimensions into trimmed lists', () => {
    const r = parseStyleDnaReply(REPLY);
    expect(r.ok).toBe(true);
    expect(r.dna).toEqual(DNA);
  });

  it('tolerates fences/chatter and treats none as empty', () => {
    const r = parseStyleDnaReply('```\nHere you go:\nPALETTE=indigo; MATERIALS=none; MOOD=serene; RENDER=cel shaded; MOTIFS=none\n```');
    expect(r.ok).toBe(true);
    expect(r.dna?.materials).toEqual([]);
    expect(r.dna?.motifs).toEqual([]);
    expect(r.dna?.palette).toEqual(['indigo']);
  });

  it('fails without a PALETTE marker', () => {
    const r = parseStyleDnaReply('nice pictures!');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/PALETTE/i);
  });
});

describe('styleDnaToPromptFragment', () => {
  it('builds a compact injectable fragment naming the dimensions', () => {
    const f = styleDnaToPromptFragment(DNA);
    expect(f).toMatch(/desaturated teal/);
    expect(f).toMatch(/aged brass/);
    expect(f).toMatch(/painterly/);
    expect(f.length).toBeLessThan(400);
  });

  it('caps each dimension so a verbose VLM cannot blow the prompt budget', () => {
    const bloated: StyleDna = {
      palette: Array.from({ length: 12 }, (_, i) => `color-${i}`),
      materials: [],
      mood: [],
      render: [],
      motifs: [],
    };
    const f = styleDnaToPromptFragment(bloated);
    expect(f).toMatch(/color-3/);
    expect(f).not.toMatch(/color-4/);
  });

  it('skips empty dimensions instead of emitting dangling labels', () => {
    const f = styleDnaToPromptFragment({ ...DNA, motifs: [] });
    expect(f).not.toMatch(/motif/i);
  });
});

describe('distillStyleDna (injected vision seam)', () => {
  const img = { mime: 'image/png', base64: 'x' };

  it('distills a mood board into a StyleDna', async () => {
    const r = await distillStyleDna([img, img], { vision: async () => REPLY });
    if (!r.ok) throw new Error(`expected ok, got: ${r.error}`);
    expect(r.dna).toEqual(DNA);
    expect(r.raw).toBe(REPLY);
  });

  it('requires at least one image', async () => {
    const r = await distillStyleDna([], { vision: async () => REPLY });
    expect(r.ok).toBe(false);
  });

  it('reports vision failure with the reason (never a fake DNA)', async () => {
    const r = await distillStyleDna([img], { vision: async () => { throw new Error('QWEN_API_KEY not set'); } });
    if (r.ok) throw new Error('expected failure');
    expect(r.error).toMatch(/QWEN_API_KEY/);
  });

  it('reports an unparseable reply with the raw preserved', async () => {
    const r = await distillStyleDna([img], { vision: async () => 'gibberish' });
    if (r.ok) throw new Error('expected failure');
    expect(r.raw).toBe('gibberish');
  });
});
